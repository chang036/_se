"""URL normalisation, curl-style glob expansion and query-string handling."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

from .errors import UnsupportedProtocol, UsageError

SUPPORTED_SCHEMES = ("http", "https")

_BRACE_RE = re.compile(r"\{([^{}]*)\}")
_BRACKET_RE = re.compile(r"\[([^[\]]*)\]")
_RANGE_RE = re.compile(r"(?P<start>.+?)\.\.(?P<stop>.+?)(?:\.\.(?P<step>-?\d+))?")


def normalize_url(url: str) -> str:
    """Add the default scheme and reject anything we cannot speak.

    ``example.com/api`` becomes ``http://example.com/api``; ``ftp://x`` is a
    hard error because silently downgrading it would hide a mistake.
    """
    candidate = url.strip()
    if not candidate:
        raise UsageError("empty URL")

    if "://" not in candidate:
        candidate = "http://" + candidate

    parts = urlsplit(candidate)
    if parts.scheme not in SUPPORTED_SCHEMES:
        raise UnsupportedProtocol(
            f"unsupported URL scheme '{parts.scheme}' "
            f"(curlike only speaks {', '.join(SUPPORTED_SCHEMES)})"
        )
    if not parts.netloc:
        raise UsageError(f"no host in URL: {url}")

    path = parts.path or "/"
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))


def expand_url_glob(url: str) -> list[str]:
    """Expand ``{}`` and ``[]`` the way curl does.

    ``http://x/{1..3}`` -> three URLs. ``{}`` is expanded left to right so
    multiple groups combine naturally.
    """
    match = _BRACE_RE.search(url)
    if match is None:
        return _expand_brackets(url)

    prefix, spec, suffix = url[: match.start()], match.group(1), url[match.end() :]
    expanded: list[str] = []
    for value in _expand_brace_spec(spec):
        expanded.extend(expand_url_glob(prefix + value + suffix))
    return expanded or [url]


def _expand_brace_spec(spec: str) -> list[str]:
    if spec == "":
        return [""]
    if "," in spec:
        return [item.strip() for item in spec.split(",")]

    range_match = _RANGE_RE.fullmatch(spec)
    if range_match:
        return _expand_range(
            range_match.group("start"), range_match.group("stop"), range_match.group("step")
        )
    return [spec]


def _expand_range(start: str, stop: str, step: str | None) -> list[str]:
    stride = abs(int(step)) if step else 1
    if stride == 0:
        raise UsageError("range step must not be zero")

    if len(start) == 1 and len(stop) == 1 and start.isalpha() and stop.isalpha():
        if start.islower() != stop.islower():
            raise UsageError(f"invalid range in URL: '{{{start}..{stop}}}'")
        low, high = ord(start.lower()), ord(stop.lower())
        if low > high:
            raise UsageError(f"invalid range in URL: '{{{start}..{stop}}}'")
        return [chr(value) for value in range(low, high + 1, stride)]

    if start.isdigit() and stop.isdigit():
        low, high = int(start), int(stop)
        if low > high:
            raise UsageError(f"invalid range in URL: '{{{start}..{stop}}}'")
        width = max(len(start), len(stop))
        return [str(value).zfill(width) for value in range(low, high + 1, stride)]

    raise UsageError(f"unsupported range in URL: '{{{start}..{stop}}}'")


def _expand_brackets(url: str) -> list[str]:
    """Expand the ``[1-5]`` / ``[abc]`` set syntax."""
    match = _BRACKET_RE.search(url)
    if match is None:
        return [url]

    spec = match.group(1)
    prefix, suffix = url[: match.start()], url[match.end() :]

    values: list[str] = []
    if "-" in spec and "," not in spec:
        low, _, high = spec.partition("-")
        values = _expand_range(low.strip(), high.strip(), None)
    elif "," in spec:
        values = [item.strip() for item in spec.split(",")]
    else:
        # Not something we understand - better to send it verbatim than to
        # silently rewrite the user's URL.
        return [url]

    expanded: list[str] = []
    for value in values:
        expanded.extend(_expand_brackets(prefix + value + suffix))
    return expanded or [url]


def append_query(url: str, raw_query: str) -> str:
    """Append an already-encoded query string, preserving existing params."""
    if not raw_query:
        return url
    parts = urlsplit(url)
    query = f"{parts.query}&{raw_query}" if parts.query else raw_query
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def query_params(url: str) -> list[tuple[str, str]]:
    return parse_qsl(urlsplit(url).query, keep_blank_values=True)


def with_query(url: str, params: list[tuple[str, str]]) -> str:
    """Replace the query string with ``params`` (already decoded)."""
    parts = urlsplit(url)
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(params, doseq=True), parts.fragment)
    )


def display_host(url: str) -> str:
    """The host shown in ``* Trying ...`` log lines."""
    parts = urlsplit(url)
    default_port = 443 if parts.scheme == "https" else 80
    port = parts.port or default_port
    return f"{parts.hostname or ''}:{port}"


def effective_host(url: str) -> str:
    """Hostname without any port, used for cross-host redirect checks."""
    return (urlsplit(url).hostname or "").lower()