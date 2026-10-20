"""Wire the parsed options together and perform the request."""

from __future__ import annotations

import re
import socket
import ssl
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO
from urllib.parse import urljoin, urlsplit

import httpx

from . import cookies as cookiejar
from .auth import build_auth
from .body import Body, DataSource, build_body
from .diagnostics import (
    Log,
    Trace,
    connection_summary,
    format_error,
    format_header_block,
    header_pairs,
)
from .errors import (
    EXIT_HTTP_RETURNED_ERROR,
    EXIT_OK,
    EXIT_SEND_ERROR,
    ConnectError_ as ConnectFailed,
    CurLikeError,
    HostNotFound,
    OperationTimedOut,
    SSLConnectError,
    SSLPeerVerificationFailed,
    TooManyRedirects,
    TransferFailed,
    UnsupportedProtocol,
    UsageError,
)
from .output import Output, safe_write
from .retry import RetryPolicy
from .urlbuild import append_query, effective_host, expand_url_glob, normalize_url
from .version import USER_AGENT
from .writeout import integer, seconds

REDIRECT_STATUS = frozenset({301, 302, 303, 307, 308})
DEFAULT_MAX_REDIRECTS = 50


@dataclass
class Deadline:
    """A wall-clock budget shared by every redirect hop and every retry."""

    seconds: float | None = None

    def __post_init__(self) -> None:
        self.expires_at: float | None = (
            time.monotonic() + self.seconds if self.seconds else None
        )

    def check(self) -> None:
        if self.expires_at is not None and time.monotonic() >= self.expires_at:
            raise OperationTimedOut(f"operation timed out after {self.seconds} seconds")

    def timeout_for(self, connect_timeout: float | None) -> Any:
        """An httpx timeout that never outlives the remaining budget."""
        if self.expires_at is None:
            return httpx.USE_CLIENT_DEFAULT
        remaining = max(self.expires_at - time.monotonic(), 0.001)
        pool = min(remaining, connect_timeout) if connect_timeout else remaining
        return httpx.Timeout(connect=pool, read=remaining, write=remaining, pool=pool)


def run(opts: Any, stdout: BinaryIO | None = None, stderr: Any = None) -> int:
    """Execute one command line and return the process exit code."""
    log = Log(stderr, verbose=opts.verbose, silent=opts.silent, show_error=opts.show_error)

    urls = _collect_urls(opts)
    body, query = build_body(opts, DataSource())
    if query:
        urls = [append_query(url, query) for url in urls]

    method = _resolve_method(opts, body)
    headers, header_empties = _build_headers(opts, body)
    retry = _build_retry_policy(opts)
    deadline = Deadline(opts.max_time)

    output = Output(
        output=opts.output,
        remote_name=opts.remote_name,
        name_from_url=opts.name_from_url,
        include=opts.include,
        dump_header=opts.dump_header,
        write_out=opts.write_out,
        fail=opts.fail,
        fail_with_body=opts.fail_with_body,
        log=log,
        stdout=stdout,
    )

    client = _build_client(opts, _build_cookies(opts), log)
    auth_headers, auth = build_auth(opts)
    if auth_headers:
        # An explicit -H 'Authorization: ...' still wins.
        headers = {**auth_headers, **headers}

    traces: list[str] = []
    exit_code = EXIT_OK
    try:
        for index, url in enumerate(urls, start=1):
            code = _perform(
                client=client,
                opts=opts,
                log=log,
                output=output,
                method=method,
                url=url,
                headers=headers,
                header_empties=header_empties,
                body=body,
                auth=auth,
                retry=retry,
                deadline=deadline,
                traces=traces,
                index=index,
                total=len(urls),
            )
            if code:
                exit_code = code
    finally:
        client.close()
        if opts.cookie_jar:
            cookiejar.write(client.cookies, opts.cookie_jar)
        if opts.trace and traces:
            _write_trace(opts.trace, traces)

    return exit_code


def _write_trace(destination: str, traces: list[str]) -> None:
    try:
        with Path(destination).open("w", encoding="utf-8", errors="surrogateescape") as handle:
            handle.writelines(traces)
    except OSError as exc:
        raise UsageError(f"cannot write trace file '{destination}': {exc.strerror}") from exc


# --------------------------------------------------------------------------
# options -> runtime values
# --------------------------------------------------------------------------


def _collect_urls(opts: Any) -> list[str]:
    raw_urls = opts.url or []
    if not raw_urls:
        raise UsageError("no URL specified (try 'curlike --help')")

    urls: list[str] = []
    for item in raw_urls:
        for expanded in expand_url_glob(item):
            urls.append(normalize_url(expanded))
    return urls


def _resolve_method(opts: Any, body: Body) -> str:
    if opts.method is not None:
        method = opts.method.strip().upper()
        if not method:
            raise UsageError("-X/--request needs a method name")
        return method
    if opts.head:
        return "HEAD"
    if opts.upload_file:
        return "PUT"
    if opts.get:
        return "GET"
    if body.present:
        return "POST"
    return "GET"


def _build_headers(opts: Any, body: Body) -> tuple[dict[str, str], set[str]]:
    """Return ``(headers, empty_names)``.

    Precedence, lowest first: defaults < body < -A/-e < -H.
    """
    headers: dict[str, str] = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    headers.update(body.headers)

    if opts.referer:
        headers["Referer"] = opts.referer
    if opts.user_agent:
        headers["User-Agent"] = opts.user_agent
    if opts.compressed:
        headers["Accept-Encoding"] = "gzip, deflate"

    for raw in opts.header or ():
        name, separator, value = raw.partition(":")
        name = name.strip().rstrip(";").strip()
        if not name:
            raise UsageError(f"-H/--header expects 'Name: value', got '{raw}'")
        if not separator:
            # curl's "-H 'Name;'" means "send this header with no value at
            # all", which is how you blank out one of our own defaults.
            headers[name] = ""
            continue
        headers[name] = value.strip()

    return headers, {name.lower() for name, value in headers.items() if value == ""}


def _build_cookies(opts: Any) -> httpx.Cookies:
    """``-b`` accepts both inline cookie strings and Netscape jar files."""
    jar = httpx.Cookies()
    for value in opts.cookie or ():
        if "=" in value:
            for name, cookie_value in cookiejar.parse_cookie_header(value):
                jar.set(name, cookie_value)
            continue
        for cookie in cookiejar.read(value).jar:
            jar.jar.set_cookie(cookie)
    return jar


def _build_retry_policy(opts: Any) -> RetryPolicy:
    return RetryPolicy(
        retries=opts.retry or 0,
        delay=opts.retry_delay,
        max_time=opts.retry_max_time,
        all_errors=opts.retry_all_errors,
    )


def _tls_options(opts: Any, log: Log) -> tuple[Any, Any]:
    """Translate the TLS flags into httpx's ``(verify, cert)`` pair."""
    verify: Any = True
    if opts.insecure:
        verify = False
    elif opts.cacert:
        path = Path(opts.cacert)
        verify = _context_with_cadir(str(path)) if path.is_dir() else str(path)
    elif opts.capath:
        verify = _context_with_cadir(opts.capath)

    if opts.key and not opts.cert:
        raise UsageError("--key requires --cert")

    cert: Any = None
    if opts.cert:
        cert_file, key_file, password = _split_cert_spec(opts.cert)
        if key_file is None and opts.key:
            key_file = opts.key
        if password and key_file is None:
            log.warning("--cert password needs a separate --key; ignoring the password")
            password = None
        cert = (cert_file, key_file, password) if password else (cert_file, key_file)
    return verify, cert


def _context_with_cadir(capath: str) -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.load_verify_locations(capath=capath)
    return context


def _split_cert_spec(spec: str) -> tuple[str, str | None, str | None]:
    """Parse curl's ``file[:password[:keyfile]]`` certificate syntax."""
    if ":" in spec and not Path(spec).exists():
        head, _, tail = spec.partition(":")
        if ":" in tail:
            password, _, key_file = tail.partition(":")
            return head, key_file or None, password
        return head, None, tail
    return spec, None, None


def _build_client(opts: Any, jar: httpx.Cookies, log: Log) -> httpx.Client:
    if opts.http1_0:
        raise UsageError("--http1.0 is not supported; curlike speaks HTTP/1.1 and HTTP/2")

    http2 = bool(opts.http2)
    if http2:
        try:  # pragma: no cover - depends on an optional dependency
            import h2  # noqa: F401
        except ImportError as exc:  # pragma: no cover
            raise UsageError(
                "--http2 needs the 'h2' package (pip install 'curlike[http2]')"
            ) from exc

    verify, cert = _tls_options(opts, log)
    timeout = httpx.Timeout(
        connect=opts.connect_timeout,
        read=opts.max_time,
        write=opts.max_time,
        pool=opts.connect_timeout,
    )
    return httpx.Client(
        verify=verify,
        cert=cert,
        http1=not http2,
        http2=http2,
        proxy=opts.proxy,
        mounts=_proxy_mounts(opts) or None,
        timeout=timeout,
        trust_env=opts.trust_env,
        follow_redirects=False,
        cookies=jar,
    )


def _proxy_mounts(opts: Any) -> dict[str, Any]:
    """``--noproxy`` wins over ``--proxy`` for the hosts it lists."""
    mounts: dict[str, Any] = {}
    for entry in (opts.noproxy or "").split(","):
        host = entry.strip()
        if not host:
            continue
        if host == "*":
            return {"all://": None}
        mounts[f"all://{host}"] = None
    return mounts


# --------------------------------------------------------------------------
# request execution
# --------------------------------------------------------------------------


def _perform(
    *,
    client: httpx.Client,
    opts: Any,
    log: Log,
    output: Output,
    method: str,
    url: str,
    headers: dict[str, str],
    header_empties: set[str],
    body: Body,
    auth: Any,
    retry: RetryPolicy,
    deadline: Deadline,
    traces: list[str],
    index: int,
    total: int,
) -> int:
    attempt = 0
    started = time.monotonic()

    while True:
        attempt += 1
        deadline.check()
        trace = Trace()

        try:
            response, effective_url, hops = _send(
                client=client,
                method=method,
                url=url,
                headers=headers,
                header_empties=header_empties,
                body=body,
                auth=auth,
                opts=opts,
                log=log,
                deadline=deadline,
                trace=trace,
            )
        except httpx.HTTPError as exc:
            traces.append(trace.dump())
            if retry.should_retry(attempt, error=exc, elapsed=time.monotonic() - started):
                _pause(retry.delay_for(attempt), log, attempt, deadline)
                continue
            translated = _translate(exc)
            log.error(format_error(translated))
            return translated.exit_code

        if retry.should_retry(attempt, status=response.status_code, elapsed=time.monotonic() - started):
            traces.append(trace.dump())
            wait = retry.delay_for(attempt, response)
            log.info(
                f"the requested URL returned error: {response.status_code}; "
                f"attempt {attempt}/{retry.retries}, retrying in {wait:.3f}s"
            )
            response.read()
            response.close()
            _pause(wait, log, attempt, deadline)
            continue

        traces.append(trace.dump())
        return _deliver(
            response=response,
            trace=trace,
            log=log,
            output=output,
            url=url,
            effective_url=effective_url,
            hops=hops,
            index=index,
            total=total,
        )


def _pause(wait: float, log: Log, attempt: int, deadline: Deadline) -> None:
    if wait > 0:
        log.info(f"waiting {wait:.3f}s before retry {attempt + 1}")
    deadline.check()
    time.sleep(wait)


def _send(
    *,
    client: httpx.Client,
    method: str,
    url: str,
    headers: dict[str, str],
    header_empties: set[str],
    body: Body,
    auth: Any,
    opts: Any,
    log: Log,
    deadline: Deadline,
    trace: Trace,
) -> tuple[httpx.Response, str, int]:
    """Follow redirects by hand so we can log, count and cap them."""
    current_method, current_url = method, url
    content, files = body.content, body.files
    send_headers = dict(headers)
    send_empties = set(header_empties)
    hop_auth = auth
    hops = 0

    while True:
        deadline.check()
        request = client.build_request(
            current_method,
            current_url,
            headers=send_headers,
            content=content,
            files=files,
            timeout=deadline.timeout_for(opts.connect_timeout),
            extensions={"trace": trace},
        )
        # httpx fills in its own defaults for any header we left empty, so
        # blank them out again to honour "-H 'Name;'".
        for name in send_empties:
            request.headers[name] = ""
        pending_request_log = _render_request(request, opts)

        try:
            response = client.send(
                request, stream=True, follow_redirects=False, auth=hop_auth
            )
        except httpx.HTTPError:
            _emit_connection(log, trace, response=None, url=current_url)
            raise

        _emit_connection(log, trace, response=response, url=current_url)
        for line in pending_request_log:
            log.outgoing(line)
        log.outgoing("")
        log.incoming(_status_line(response))
        for name, value in header_pairs(response.headers):
            log.incoming(f"{name}: {value}")
        log.incoming("")

        location = response.headers.get("location")
        if not (opts.location and response.status_code in REDIRECT_STATUS and location):
            return response, current_url, hops

        limit = opts.max_redirs if opts.max_redirs is not None else DEFAULT_MAX_REDIRECTS
        if hops >= limit:
            response.close()
            raise TooManyRedirects(f"exceeded {limit} redirects")

        next_url = urljoin(current_url, location)
        status = response.status_code
        response.read()
        response.close()
        hops += 1
        log.info(f"Redirecting to {next_url}")

        # RFC 9110 method rewriting for 301/302/303.
        if status in (301, 302) and current_method == "POST":
            current_method, content, files = "GET", None, None
        elif status == 303 and current_method not in ("GET", "HEAD"):
            current_method, content, files = "GET", None, None

        if content is None and files is None:
            send_headers = {
                name: value
                for name, value in send_headers.items()
                if name.lower() not in ("content-type", "content-length")
            }
        if effective_host(next_url) != effective_host(current_url):
            # Never hand credentials to a host the user did not name.
            send_headers = {
                name: value
                for name, value in send_headers.items()
                if name.lower() != "authorization"
            }
            hop_auth = None
        current_url = next_url


def _render_request(request: httpx.Request, opts: Any) -> list[str]:
    """The ``>`` block, with Host first so it reads like curl's output."""
    version = "2" if opts.http2 else "1.1"
    target = request.url.raw_path.decode("ascii", "replace") or "/"
    pairs = header_pairs(request.headers)

    host = request.url.netloc.decode("ascii", "replace")
    rest = [(name, value) for name, value in pairs if name.lower() != "host"]

    lines = [f"{request.method} {target} HTTP/{version}", f"Host: {host}"]
    lines.extend(f"{name}: {value}" for name, value in rest)
    return lines


def _status_line(response: httpx.Response) -> str:
    version = response.http_version or "HTTP/1.1"
    return f"{version} {response.status_code} {response.reason_phrase or ''}".rstrip()


def _emit_connection(log: Log, trace: Trace, response: Any, url: str) -> None:
    if not log.verbose:
        return

    connecting_host, connecting_port = trace.connecting_to
    if connecting_host:
        log.info(f"Trying {connecting_host}:{connecting_port}...")

    summary = connection_summary(response, trace)
    if summary["remote_ip"]:
        log.info(
            f"Connected to {effective_host(url)} ({summary['remote_ip']}) "
            f"port {summary['remote_port']}"
        )
    if summary["alpn"]:
        log.info(f"ALPN: server accepted {summary['alpn']}")
    if summary["tls_version"]:
        cipher = f" ({summary['cipher']})" if summary["cipher"] else ""
        log.info(f"{summary['tls_version']}{cipher}")
    if summary["alpn"] == "h2" or (response is not None and response.http_version == "HTTP/2"):
        log.info("using HTTP/2")


def _deliver(
    *,
    response: httpx.Response,
    trace: Trace,
    log: Log,
    output: Output,
    url: str,
    effective_url: str,
    hops: int,
    index: int,
    total: int,
) -> int:
    """Stream the body to its destination and work out the exit code."""
    header_block = format_header_block(_status_line(response), response.headers)
    if output.dump_header:
        output.dump_headers(header_block)

    size = 0
    size_request = _request_size(response.request)
    error_code = EXIT_OK
    skip_body = output.fail and not output.fail_with_body and response.status_code >= 400

    try:
        with output.stream(url, response, index, total) as sink:
            if output.include:
                safe_write(sink, header_block.encode("utf-8", "surrogateescape"))
            try:
                if not skip_body:
                    for chunk in response.iter_bytes():
                        safe_write(sink, chunk)
                        size += len(chunk)
            except httpx.HTTPError as exc:
                log.error(f"transfer closed with outstanding read data remaining: {exc}")
                error_code = EXIT_SEND_ERROR

            context = _write_out_context(
                response=response,
                trace=trace,
                url=url,
                effective_url=effective_url,
                hops=hops,
                size=size,
                size_request=size_request,
            )
            try:
                sink.flush()
            except (OSError, ValueError):
                pass
            if output.write_out:
                output.write_format(output.write_out, context)
    finally:
        response.close()

    elapsed = trace.time_total
    if error_code:
        return error_code
    log.info(f"Request completely sent off in {size_request} bytes")
    if size:
        log.info(f"Downloaded {size} bytes in {elapsed:.3f}s")
    log.info("Closing connection")

    if (output.fail or output.fail_with_body) and response.status_code >= 400:
        return EXIT_HTTP_RETURNED_ERROR
    return EXIT_OK


def _request_size(request: httpx.Request) -> int:
    headers = sum(len(name) + len(value) + 4 for name, value in request.headers.multi_items())
    try:
        payload = request.read()
    except Exception:  # noqa: BLE001 - this number is only used for logging
        payload = b""
    return headers + len(payload)


def _write_out_context(
    *,
    response: httpx.Response,
    trace: Trace,
    url: str,
    effective_url: str,
    hops: int,
    size: int,
    size_request: int,
) -> dict[str, Any]:
    summary = connection_summary(response, trace)
    elapsed = trace.time_total
    speed = size / elapsed if elapsed > 0 else 0.0

    return {
        "http_code": str(response.status_code),
        # curl reports the bare version number, e.g. "1.1" rather than "HTTP/1.1".
        "http_version": (response.http_version or "").removeprefix("HTTP/"),
        "response_code": response.status_code,
        "content_type": response.headers.get("content-type", ""),
        "url": url,
        "url_effective": effective_url,
        "scheme": urlsplit(effective_url).scheme,
        "num_redirects": integer(hops),
        "num_connects": integer(1 if summary["remote_ip"] else 0),
        "header_count": integer(len(response.headers)),
        "size_download": integer(size),
        "size_header": integer(len(format_header_block(_status_line(response), response.headers))),
        "size_request": integer(size_request),
        "speed_download": f"{speed:.0f}",
        "time_total": seconds(elapsed),
        "time_connect": seconds(trace.time_connect),
        "time_preconnect": seconds(trace.time_preconnect),
        # curl reports DNS separately; we can only see "before connect".
        "time_namelookup": seconds(trace.time_preconnect),
        "time_appconnect": seconds(trace.time_appconnect),
        "time_pretransfer": seconds(trace.time_pretransfer),
        "time_starttransfer": seconds(trace.time_starttransfer),
        "remote_ip": summary["remote_ip"] or "",
        "remote_port": summary["remote_port"] or "",
        "local_ip": summary["local_ip"] or "",
        "local_port": summary["local_port"] or "",
        "ssl_verify_result": "0",
        "errormsg": "",
        "exitcode": "0",
    }


def _translate(exc: httpx.HTTPError) -> CurLikeError:
    """Map httpx's exception tree onto curl's exit codes."""
    if isinstance(
        exc,
        (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout),
    ):
        return OperationTimedOut("operation timed out")
    if isinstance(exc, httpx.TooManyRedirects):
        return TooManyRedirects(_clean(exc))
    if isinstance(exc, httpx.UnsupportedProtocol):
        return UnsupportedProtocol(_clean(exc))
    if isinstance(exc, httpx.ConnectError):
        return _translate_connect(exc)
    if isinstance(exc, (httpx.RemoteProtocolError, httpx.LocalProtocolError, httpx.NetworkError)):
        return TransferFailed(_clean(exc))
    return CurLikeError(_clean(exc))


def _translate_connect(exc: httpx.ConnectError) -> CurLikeError:
    """A refused connection, a bad hostname and a bad certificate all surface
    as ``ConnectError``; curl tells them apart by exit code 7, 6 and 60."""
    root = _root_cause(exc)

    if isinstance(root, socket.gaierror):
        return HostNotFound(f"Could not resolve host: {_host_of(exc)}")
    if isinstance(root, ssl.SSLCertVerificationError):
        return SSLPeerVerificationFailed(
            f"SSL certificate problem: {_certificate_reason(exc)}"
        )
    if isinstance(root, ssl.SSLError):
        return SSLConnectError(f"SSL connect error: {_certificate_reason(exc)}")
    return ConnectFailed(f"Failed to connect to {_host_of(exc)}: {_clean(exc)}")


def _root_cause(exc: BaseException) -> BaseException:
    """Dig out the exception that actually says what went wrong.

    httpx wraps httpcore, which wraps socket/ssl, so the interesting error is
    usually several ``__cause__`` / ``args[0]`` hops down rather than sitting
    on the exception we were handed.
    """
    seen: set[int] = set()
    current = exc
    while id(current) not in seen:
        seen.add(id(current))
        inner = current.__cause__ or (
            current.args[0] if current.args and isinstance(current.args[0], BaseException) else None
        )
        if inner is None or inner is current:
            return current
        current = inner
    return current


def _host_of(exc: httpx.HTTPError) -> str:
    request = getattr(exc, "request", None)
    url = getattr(request, "url", None)
    if url is None:
        return "host"
    return f"{url.host}:{url.port or (443 if url.scheme == 'https' else 80)}"


def _certificate_reason(exc: httpx.HTTPError) -> str:
    reason = getattr(_root_cause(exc), "reason", None)
    return str(reason).strip() if reason else _clean(exc)


_NOISE_RE = re.compile(r"^\[([^\]]*)\]\s*|\s*\(_ssl\.c:\d+\)\s*$")


def _clean(exc: BaseException) -> str:
    """Strip the errno/decoration httpx prepends, keeping the human part.

    ``[WinError 10061] ...`` and ``[SSL: CERTIFICATE_VERIFY_FAILED] ...``
    carry no information curl's own message does not already say.
    """
    text = str(exc).strip()
    text = _NOISE_RE.sub("", text)
    return text or type(exc).__name__