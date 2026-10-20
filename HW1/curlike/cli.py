"""Command line parsing.

Option names, short flags and exit codes all follow curl so that muscle
memory (and existing scripts) carry over.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any, Sequence

from .diagnostics import format_error
from .errors import EXIT_OK, EXIT_USAGE, CurLikeError
from .version import BANNER, NAME, VERSION

PROG = NAME

EPILOG = f"""\
examples:
  {PROG} https://example.com                 plain GET
  {PROG} -X POST --json '{{"a":1}}' /api     JSON request, POST implied
  {PROG} -F 'file=@./report.pdf' /upload     multipart upload
  {PROG} -T ./movie.mp4 https://host/store   raw PUT
  {PROG} -G -d 'q=curl' https://host/search  send the data in the query string
  {PROG} -L -o page.html --retry 3 /big      follow redirects, retry, save
  {PROG} -sS -w '%{{http_code}} %{{time_total}}\\n' -o /dev/null https://host
  {PROG} -x http://127.0.0.1:8080 https://host   send through a proxy
  {PROG} -b jar.txt -c jar.txt https://host      load and save cookies
  {PROG} https://host/a{{1..3}}/b                three requests, one command
"""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=PROG,
        description="A curl-like HTTP client: transfers URLs from the command line.",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )
    parser.add_argument("url", nargs="*", metavar="URL", help="one or more URLs to fetch")
    parser.add_argument("-h", "--help", action="help", help="show this help and exit")
    parser.add_argument(
        "-V", "--version", action="version", version=BANNER, help="show the version and exit"
    )

    request = parser.add_argument_group("request")
    request.add_argument(
        "-X", "--request", dest="method", metavar="METHOD", help="HTTP method to use"
    )
    request.add_argument(
        "-H", "--header", action="append", metavar="'Name: value'",
        help="add a request header (repeatable); 'Name;' removes one",
    )
    request.add_argument(
        "-d", "--data", action="append", metavar="DATA",
        help="form body field; @file reads the value from a file",
    )
    request.add_argument(
        "--data-raw", action="append", metavar="DATA", help="like -d but @ is not special"
    )
    request.add_argument(
        "--data-binary", action="append", metavar="DATA",
        help="like -d with no encoding; @- reads stdin",
    )
    request.add_argument(
        "--data-urlencode", action="append", metavar="DATA",
        help="URL-encode the data, supporting name@file and name=content",
    )
    request.add_argument(
        "-F", "--form", action="append", metavar="name=value",
        help="multipart field; name=@file uploads a file, name=<file reads a value",
    )
    request.add_argument(
        "--json", dest="json_data", metavar="DATA",
        help="JSON body (@file allowed); sets Content-Type and Accept",
    )
    request.add_argument(
        "-T", "--upload-file", metavar="FILE",
        help="upload FILE as the body ('-' for stdin); implies PUT",
    )
    request.add_argument(
        "-G", "--get", action="store_true",
        help="move -d data into the query string and use GET",
    )
    request.add_argument("-I", "--head", action="store_true", help="fetch headers only")
    request.add_argument("-e", "--referer", metavar="URL", help="send a Referer header")
    request.add_argument("-A", "--user-agent", metavar="NAME", help="send a User-Agent header")
    request.add_argument(
        "--compressed", action="store_true", help="ask for a compressed response"
    )

    auth = parser.add_argument_group("authentication and cookies")
    auth.add_argument(
        "-u", "--user", metavar="USER:PASSWORD", help="credentials for basic auth"
    )
    auth.add_argument("--basic", action="store_true", help="use HTTP basic auth (default)")
    auth.add_argument(
        "--digest", action="store_true", help="use HTTP digest auth (needs the h2/httpx support)"
    )
    auth.add_argument("--bearer", metavar="TOKEN", help="send 'Authorization: Bearer TOKEN'")
    auth.add_argument(
        "-b", "--cookie", action="append", metavar="DATA|FILE",
        help="'name=value' pair(s), or a Netscape cookie file to load",
    )
    auth.add_argument(
        "-c", "--cookie-jar", metavar="FILE",
        help="write received cookies to FILE ('-' for stdout)",
    )

    network = parser.add_argument_group("connection")
    network.add_argument(
        "-x", "--proxy", metavar="[PROTOCOL://]HOST[:PORT]", help="send via a proxy"
    )
    network.add_argument(
        "--noproxy", metavar="HOSTS", help="comma separated hosts that bypass --proxy"
    )
    network.add_argument(
        "--trust-env", action="store_true", help="honour HTTP_PROXY/HTTPS_PROXY/SSL_CERT_FILE"
    )
    network.add_argument(
        "-L", "--location", action="store_true", help="follow redirects"
    )
    network.add_argument(
        "--max-redirs", type=int, metavar="N", help="stop after N redirects (default 50)"
    )
    network.add_argument(
        "-m", "--max-time", type=float, metavar="SECONDS", help="give up after SECONDS"
    )
    network.add_argument(
        "--connect-timeout", type=float, metavar="SECONDS", help="TCP/TLS connect timeout"
    )
    network.add_argument(
        "--http1.1", dest="http1_1", action="store_true", help="force HTTP/1.1 (default)"
    )
    network.add_argument(
        "--http1.0",
        dest="http1_0",
        action="store_true",
        help="not supported by curlike",
    )
    network.add_argument(
        "--http2", action="store_true", help="use HTTP/2 (needs pip install 'curlike[http2]')"
    )

    tls = parser.add_argument_group("TLS")
    tls.add_argument(
        "-k", "--insecure", action="store_true", help="do not verify the server certificate"
    )
    tls.add_argument("--cacert", metavar="FILE", help="CA bundle file (or directory)")
    tls.add_argument("--capath", metavar="DIR", help="directory of hashed CA certificates")
    tls.add_argument(
        "--cert", metavar="FILE[:PASS[:KEY]]", help="client certificate (PEM/DER)"
    )
    tls.add_argument("--key", metavar="FILE", help="private key that goes with --cert")

    retry = parser.add_argument_group("retries")
    retry.add_argument(
        "--retry", type=int, metavar="N", help="retry transient failures N times"
    )
    retry.add_argument(
        "--retry-delay", type=_delay, metavar="SECONDS", help="wait between retries (default: 1,2,4...)"
    )
    retry.add_argument(
        "--retry-max-time", type=float, metavar="SECONDS", help="give up retrying after SECONDS"
    )
    retry.add_argument(
        "--retry-all-errors", action="store_true", help="retry on any error, not just transient ones"
    )

    output = parser.add_argument_group("output")
    output.add_argument("-o", "--output", metavar="FILE", help="write the body to FILE")
    output.add_argument(
        "-O", dest="name_from_url", action="store_true", help="save using the URL's file name"
    )
    output.add_argument(
        "-J", dest="remote_name", action="store_true",
        help="save using the server's Content-Disposition file name",
    )
    output.add_argument(
        "-i", "--include", action="store_true", help="print response headers before the body"
    )
    output.add_argument(
        "-D", "--dump-header", metavar="FILE", help="write response headers to FILE ('-' for stdout)"
    )
    output.add_argument(
        "-f", "--fail", action="store_true", help="exit 22 on HTTP errors, print nothing"
    )
    output.add_argument(
        "--fail-with-body", action="store_true", help="exit 22 on HTTP errors but keep the body"
    )
    output.add_argument(
        "-w", "--write-out", metavar="FORMAT", help="print variables after the transfer"
    )
    output.add_argument("--trace", metavar="FILE", help="dump low level protocol events")

    logging = parser.add_argument_group("logging")
    logging.add_argument(
        "-v", "--verbose", action="store_true", help="show the request and response in detail"
    )
    logging.add_argument("-s", "--silent", action="store_true", help="hide all output but the body")
    logging.add_argument(
        "-S", "--show-error", action="store_true", help="show errors even when silent"
    )

    return parser


def _delay(value: str) -> float | None:
    """``--retry-delay``; ``max`` keeps the exponential backoff."""
    text = value.strip()
    if text.lower() in ("max", "exponential"):
        return None
    try:
        seconds = float(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"'{value}' is not a number of seconds") from None
    if seconds < 0:
        raise argparse.ArgumentTypeError("--retry-delay cannot be negative")
    return seconds


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    return build_parser().parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point used by the console script and by ``python -m curlike``."""
    _make_console_safe()

    opts = parse_args(argv)
    opts = _normalize(opts)

    from .app import run  # imported late so --help stays fast

    try:
        return run(opts)
    except CurLikeError as exc:
        sys.stderr.write(f"{PROG}: {format_error(exc)}\n")
        return exc.exit_code
    except KeyboardInterrupt:  # pragma: no cover - interactive
        sys.stderr.write(f"\n{PROG}: (2) aborted by user\n")
        return 130
    except BrokenPipeError:  # pragma: no cover - depends on the consumer
        return EXIT_OK


def _normalize(opts: argparse.Namespace) -> argparse.Namespace:
    """Fill in derived values and reject contradictory combinations."""
    if opts.basic and opts.digest:
        raise CurLikeError("--basic and --digest are mutually exclusive")
    if opts.fail_with_body:
        opts.fail = True
    if opts.user_agent is None and opts.header:
        # nothing to do; -H is handled later where precedence is applied
        pass
    return opts


def _make_console_safe() -> None:
    """Windows consoles default to a legacy code page; force UTF-8."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):  # pragma: no cover - already wrapped
            pass


def usage_error(message: str) -> int:
    sys.stderr.write(f"{PROG}: ({EXIT_USAGE}) {message}\n")
    return EXIT_USAGE


__all__ = ["build_parser", "parse_args", "main", "VERSION", "PROG", "Any"]