"""Terminal output: curl-style logging, header dumps and connection traces."""

from __future__ import annotations

import ssl
import sys
import time
from pathlib import Path
from typing import Any, TextIO

from .errors import WriteError


class Trace:
    """Collects httpcore trace events so timings are real, not guessed.

    httpx hands the ``trace`` request extension to httpcore, which then calls
    ``trace(identifier, info)`` with names such as
    ``http11.receive_response_headers.complete``. We strip the logger prefix,
    keep the first timestamp per event and the last payload, and use that to
    report connect/TLS/TTFB numbers that are actually measured.
    """

    _PREFIXES = frozenset(
        {"connection", "http10", "http11", "http2", "httpproxy", "socks", "anyio"}
    )
    _SUFFIXES = frozenset({"started", "complete", "failed"})

    def __init__(self) -> None:
        self.started_at = time.perf_counter()
        self.marks: dict[str, float] = {}
        self.payloads: dict[str, dict[str, Any]] = {}
        self.events: list[tuple[str, float, dict[str, Any]]] = []
        # Captured while the socket is still open; see __call__.
        self.local_address: Any = None
        self.peer_address: Any = None

    def __call__(self, identifier: str, info: dict[str, Any]) -> None:
        name = self._normalise(identifier)
        stamp = time.perf_counter()
        self.marks.setdefault(name, stamp)
        self.payloads[name] = info
        self.events.append((name, stamp, info))
        if name == "connect_tcp.complete":
            self._capture_addresses(info.get("return_value"))

    def _capture_addresses(self, stream: Any) -> None:
        """Record both ends of the socket now, while it is still open.

        The stream is handed back by reference, so by the time we can ask
        ``response.extensions['network_stream']`` the connection has usually
        been closed again and the addresses are gone for good.
        """
        if stream is None or self.peer_address is not None:
            return
        self.local_address = _extra(stream, "client_addr")
        self.peer_address = _extra(stream, "server_addr")

    @classmethod
    def _normalise(cls, identifier: str) -> str:
        parts = identifier.split(".")
        if len(parts) == 3 and parts[0] in cls._PREFIXES and parts[-1] in cls._SUFFIXES:
            return ".".join(parts[1:])
        return identifier

    # -- accessors ---------------------------------------------------------

    def mark(self, name: str) -> float | None:
        return self.marks.get(name)

    def payload(self, name: str) -> dict[str, Any]:
        return self.payloads.get(name, {})

    def _span(self, start_event: str, end_event: str) -> float:
        start, end = self.mark(start_event), self.mark(end_event)
        if start is None or end is None:
            return 0.0
        return max(end - start, 0.0)

    def _offset(self, event: str, fallback: float = 0.0) -> float:
        """When ``event`` happened, measured from the start of the transfer.

        curl's ``%{time_*}`` variables are offsets, not durations, so the
        numbers climb monotonically: namelookup <= connect <= appconnect <=
        pretransfer <= starttransfer <= total.
        """
        stamp = self.mark(event)
        return fallback if stamp is None else max(stamp - self.started_at, 0.0)

    @property
    def time_total(self) -> float:
        return max(time.perf_counter() - self.started_at, 0.0)

    @property
    def time_preconnect(self) -> float:
        """Time before the socket connect starts, i.e. pool wait included."""
        start = self.mark("connect_tcp.started") or self.started_at
        return max(start - self.started_at, 0.0)

    @property
    def time_namelookup(self) -> float:
        # DNS is folded into the connect attempt, so the lookup and the TCP
        # handshake share one offset. Matches what curl can observe anyway.
        return self.time_preconnect + self._span("connect_tcp.started", "connect_tcp.complete")

    @property
    def time_connect(self) -> float:
        return self._offset("connect_tcp.complete", self.time_namelookup)

    @property
    def time_appconnect(self) -> float:
        # Plain HTTP has no TLS handshake; report the connect time instead of 0.
        return self._offset("start_tls.complete", self.time_connect)

    @property
    def time_pretransfer(self) -> float:
        start = self.mark("send_request_headers.started") or self.started_at
        return max(start - self.started_at, 0.0)

    @property
    def time_starttransfer(self) -> float:
        end = self.mark("receive_response_headers.complete")
        if end is None:
            return 0.0
        return max(end - self.started_at, 0.0)

    @property
    def remote_address(self) -> tuple[str | None, int | None]:
        """Best effort peer address straight from the connect attempt."""
        info = self.payload("connect_tcp.started")
        if info.get("host"):
            return info.get("host"), info.get("port")
        value = self.payload("connect_tcp.complete").get("return_value")
        if isinstance(value, tuple) and len(value) >= 2 and isinstance(value[1], tuple):
            return value[1]
        return None, None

    @property
    def connecting_to(self) -> tuple[str | None, int | None]:
        info = self.payload("connect_tcp.started")
        return info.get("host"), info.get("port")

    def dump(self) -> str:
        lines = []
        for name, stamp, info in self.events:
            offset = stamp - self.started_at
            shown = {
                key: value for key, value in info.items() if key not in ("return_value",)
            }
            lines.append(f"{offset:>10.6f} {name} {shown}".rstrip())
        return "\n".join(lines) + ("\n" if lines else "")


def _extra(stream: Any, key: str) -> Any:
    """httpcore's streams raise for unknown keys; never let that escape."""
    getter = getattr(stream, "get_extra_info", None)
    if getter is None:
        return None
    try:
        return getter(key)
    except Exception:  # noqa: BLE001 - diagnostics must never break a request
        return None


def _ssl_object(value: Any) -> ssl.SSLObject | None:
    if isinstance(value, ssl.SSLObject):
        return value
    found = _extra(value, "ssl_object")
    return found if isinstance(found, ssl.SSLObject) else None


def _address(value: Any) -> tuple[Any, Any] | None:
    """Reduce a ``getpeername()``/``getsockname()`` result to host and port.

    IPv4 gives ``(host, port)`` but IPv6 gives the four element
    ``(host, port, flowinfo, scope_id)``, so slicing keeps both working.
    """
    if isinstance(value, tuple) and len(value) >= 2:
        return value[0], value[1]
    return None


def connection_summary(response: Any, trace: Trace) -> dict[str, Any]:
    """Everything the verbose log and ``-w`` want to know about the connection."""
    summary: dict[str, Any] = {
        "remote_ip": None,
        "remote_port": None,
        "local_ip": None,
        "local_port": None,
        "alpn": None,
        "tls_version": None,
        "cipher": None,
    }

    network_stream = None
    if response is not None:
        extensions = getattr(response, "extensions", None) or {}
        network_stream = extensions.get("network_stream")

    if network_stream is not None:
        remote = _address(_extra(network_stream, "server_addr"))
        if remote is not None:
            summary["remote_ip"], summary["remote_port"] = remote
        local = _address(_extra(network_stream, "client_addr"))
        if local is not None:
            summary["local_ip"], summary["local_port"] = local
        summary["alpn"] = _extra(network_stream, "selected_alpn_protocol")

        tls_object = _ssl_object(network_stream)
        if tls_object is not None:
            summary["tls_version"] = tls_object.version()
            cipher = tls_object.cipher()
            summary["cipher"] = cipher[0] if cipher else None
        else:
            summary["tls_version"] = _extra(network_stream, "ssl_version")

    if summary["remote_ip"] is None:
        host, port = trace.remote_address
        summary["remote_ip"], summary["remote_port"] = host, port
    local = _address(trace.local_address)
    if summary["local_ip"] is None and local is not None:
        summary["local_ip"], summary["local_port"] = local
    peer = _address(trace.peer_address)
    if summary["remote_ip"] is None and peer is not None:
        summary["remote_ip"], summary["remote_port"] = peer
    if summary["alpn"] is None:
        tls_object = _ssl_object(trace.payload("start_tls.complete").get("return_value"))
        if tls_object is not None:
            summary["alpn"] = tls_object.selected_alpn_protocol()

    return summary


class Log:
    """Writes curl-flavoured progress lines to stderr."""

    def __init__(
        self,
        stream: TextIO | None = None,
        *,
        verbose: bool = False,
        silent: bool = False,
        show_error: bool = False,
    ) -> None:
        self.stream = stream if stream is not None else sys.stderr
        self.verbose = verbose
        self.silent = silent
        self.show_error = show_error

    def _emit(self, prefix: str, message: str) -> None:
        self.stream.write(f"{prefix}{message}\n")
        self.stream.flush()

    def info(self, message: str) -> None:
        if self.verbose:
            self._emit("* ", message)

    def outgoing(self, message: str) -> None:
        if self.verbose:
            self._emit("> ", message)

    def incoming(self, message: str) -> None:
        if self.verbose:
            self._emit("< ", message)

    def warning(self, message: str) -> None:
        if not self.silent:
            self._emit("warning: ", message)

    def error(self, message: str) -> None:
        if not self.silent or self.show_error:
            self._emit("curlike: ", message)


def format_error(exc: Any) -> str:
    """``curlike: (28) operation timed out ...`` - curl's error line.

    Every error goes through here so the exit code is always visible, whether
    it was raised from the option parser or from the transfer itself.
    """
    return f"({exc.exit_code}) {exc}"


def format_header_block(status_line: str, headers: Any) -> str:
    """A status line plus headers, ending with a blank line.

    ``Headers.raw`` keeps the casing the server actually sent, which httpx's
    normalised view throws away - and that casing is what you want to read in
    a verbose log.
    """
    lines = [status_line]
    for raw_name, raw_value in header_pairs(headers):
        lines.append(f"{raw_name}: {raw_value}")
    return "\n".join(lines) + "\n\n"


def header_pairs(headers: Any) -> list[tuple[str, str]]:
    """Header pairs with original casing, falling back to the normalised view."""
    raw = getattr(headers, "raw", None)
    if raw is None:
        return [(name, value) for name, value in headers.multi_items()]
    return [
        (
            raw_name.decode("ascii", "replace"),
            raw_value.decode("ascii", "replace"),
        )
        for raw_name, raw_value in raw
    ]


class Sink:
    """A binary destination for a response body, with friendly errors."""

    def __init__(self, path: str | Path | None, stdout: Any | None = None) -> None:
        self.path = path
        self._stdout = stdout if stdout is not None else sys.stdout.buffer
        self._handle: Any = None

    def __enter__(self) -> Any:
        if self.path is None:
            return self._stdout
        try:
            self._handle = Path(self.path).open("wb")
        except OSError as exc:
            raise WriteError(f"cannot open '{self.path}' for writing: {exc.strerror}") from exc
        return self._handle

    def __exit__(self, *exc_info: Any) -> None:
        if self._handle is not None:
            try:
                self._handle.close()
            except OSError:
                pass
            self._handle = None