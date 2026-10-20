"""The retry policy behind ``--retry`` and friends."""

from __future__ import annotations

from dataclasses import dataclass, field
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

import httpx

# Status codes curl considers "worth another go".
RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})

# Transport failures that will plausibly succeed on a second attempt.
RETRYABLE_ERRORS = (httpx.TransportError,)

# ...and failures that will never succeed, so never retry them.
FATAL_ERRORS = (
    httpx.InvalidURL,
    httpx.UnsupportedProtocol,
    httpx.TooManyRedirects,
    httpx.CookieConflict,
)


@dataclass(frozen=True)
class RetryPolicy:
    """How many extra attempts to make, and how long to wait between them."""

    retries: int = 0
    delay: float | None = None
    max_time: float | None = None
    all_errors: bool = False
    statuses: frozenset[int] = field(default=RETRYABLE_STATUS)

    @property
    def enabled(self) -> bool:
        return self.retries > 0

    def should_retry(
        self,
        attempt: int,
        *,
        status: int | None = None,
        error: BaseException | None = None,
        elapsed: float = 0.0,
    ) -> bool:
        """``attempt`` is the 1-based number of tries already finished."""
        if self.retries <= 0 or attempt > self.retries:
            return False
        if self.max_time is not None and elapsed >= self.max_time:
            return False

        if error is not None:
            if isinstance(error, FATAL_ERRORS):
                return False
            return self.all_errors or isinstance(error, RETRYABLE_ERRORS)

        if status is None:
            return False
        if 300 <= status < 400:
            # curl does not retry redirects; -L handles those.
            return False
        return status in self.statuses

    def delay_for(self, attempt: int, response: httpx.Response | None = None) -> float:
        """Seconds to sleep before retry number ``attempt + 1``."""
        if response is not None:
            retry_after = parse_retry_after(response.headers.get("retry-after"))
            if retry_after is not None:
                return min(max(retry_after, 0.0), 60.0)

        if self.delay is None or self.delay <= 0:
            # curl semantics: an unset/zero --retry-delay means exponential.
            return float(2 ** (attempt - 1))
        return self.delay


def parse_retry_after(value: str | None) -> float | None:
    """Understand both the delta-seconds and the HTTP-date form."""
    if not value:
        return None

    text = value.strip()
    try:
        return max(float(text), 0.0)
    except ValueError:
        pass

    try:
        when = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    if when is None:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return max((when - datetime.now(timezone.utc)).total_seconds(), 0.0)