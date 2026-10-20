"""Error types mapped onto the exit codes curl is famous for.

Keeping the numbers compatible means shell scripts written for curl keep
working when they are pointed at ``curlike`` instead.
"""

from __future__ import annotations

# curl-compatible exit codes (https://curl.se/libcurl/c/libcurl-errors.html)
EXIT_OK = 0
EXIT_UNSUPPORTED_PROTOCOL = 1
EXIT_USAGE = 2
EXIT_COULDNT_RESOLVE_HOST = 6
EXIT_COULDNT_CONNECT = 7
EXIT_PARTIAL_FILE = 18
EXIT_HTTP_RETURNED_ERROR = 22
EXIT_WRITE_ERROR = 23
EXIT_READ_ERROR = 26
EXIT_OPERATION_TIMEDOUT = 28
EXIT_TOO_MANY_REDIRECTS = 47
EXIT_SEND_ERROR = 55
EXIT_SSL_CONNECT_ERROR = 35
EXIT_PEER_FAILED_VERIFICATION = 60


class CurLikeError(Exception):
    """Base class for every error curlike reports to the user.

    ``exit_code`` is what ends up in ``$?`` when the error reaches the top
    level of :func:`curlike.cli.main`.
    """

    exit_code = EXIT_USAGE


class UsageError(CurLikeError):
    """The command line itself did not make sense."""

    exit_code = EXIT_USAGE


class FileReadError(CurLikeError):
    """An ``@file`` argument could not be read."""

    exit_code = EXIT_READ_ERROR


class WriteError(CurLikeError):
    """The response body could not be written to its destination."""

    exit_code = EXIT_WRITE_ERROR


class HostNotFound(CurLikeError):
    exit_code = EXIT_COULDNT_RESOLVE_HOST


class ConnectError_(CurLikeError):
    """TCP/TLS level failure; the server was never reached."""

    exit_code = EXIT_COULDNT_CONNECT


class OperationTimedOut(CurLikeError):
    """``--max-time`` or a connect/read timeout elapsed."""

    exit_code = EXIT_OPERATION_TIMEDOUT


class SSLConnectError(ConnectError_):
    exit_code = EXIT_SSL_CONNECT_ERROR


class SSLPeerVerificationFailed(CurLikeError):
    exit_code = EXIT_PEER_FAILED_VERIFICATION


class TooManyRedirects(CurLikeError):
    exit_code = EXIT_TOO_MANY_REDIRECTS


class HTTPStatusError(CurLikeError):
    """Raised for ``--fail`` style failures."""

    exit_code = EXIT_HTTP_RETURNED_ERROR


class TransferFailed(CurLikeError):
    """The connection died after the response had already started."""

    exit_code = EXIT_SEND_ERROR


class UnsupportedProtocol(UsageError):
    exit_code = EXIT_UNSUPPORTED_PROTOCOL