"""Error translation: httpx's tree has to land on curl's exit codes.

These build the exception shapes httpx/httpcore really produce, so they run
offline instead of needing an unreachable host.
"""

from __future__ import annotations

import socket
import ssl
import unittest

import httpcore
import httpx

from curlike.app import _translate
from curlike.errors import (
    EXIT_COULDNT_CONNECT,
    EXIT_COULDNT_RESOLVE_HOST,
    EXIT_OPERATION_TIMEDOUT,
    EXIT_PEER_FAILED_VERIFICATION,
    EXIT_READ_ERROR,
    EXIT_SEND_ERROR,
    EXIT_SSL_CONNECT_ERROR,
    EXIT_UNSUPPORTED_PROTOCOL,
    EXIT_USAGE,
)


def wrap(inner: BaseException) -> httpx.HTTPError:
    """Nest ``inner`` the way httpx nests a transport failure.

    httpx.ConnectError -> httpcore.ConnectError -> socket/ssl error, exactly
    the chain the real transport builds.
    """
    core = httpcore.ConnectError(inner)
    outer = httpx.ConnectError(str(inner), request=httpx.Request("GET", "https://host:443/x"))
    outer.__cause__ = core
    return outer


class TimeoutTests(unittest.TestCase):
    def test_timeouts_map_to_28(self):
        for factory in (
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
            httpx.WriteTimeout,
            httpx.PoolTimeout,
        ):
            translated = _translate(factory("slow", request=httpx.Request("GET", "http://h/")))
            self.assertEqual(translated.exit_code, EXIT_OPERATION_TIMEDOUT, factory)


class ConnectTests(unittest.TestCase):
    def test_refused_connection_is_7(self):
        translated = _translate(wrap(ConnectionRefusedError(10061, "refused")))
        self.assertEqual(translated.exit_code, EXIT_COULDNT_CONNECT)
        self.assertIn("Failed to connect", str(translated))

    def test_dns_failure_is_6(self):
        # Windows reports this as gaierror(11001, 'getaddrinfo failed').
        translated = _translate(wrap(socket.gaierror(11001, "getaddrinfo failed")))
        self.assertEqual(translated.exit_code, EXIT_COULDNT_RESOLVE_HOST)

    def test_dns_failure_is_6_on_posix_too(self):
        translated = _translate(wrap(socket.gaierror(-2, "Name or service not known")))
        self.assertEqual(translated.exit_code, EXIT_COULDNT_RESOLVE_HOST)

    def test_certificate_problem_is_60(self):
        error = ssl.SSLCertVerificationError(
            1, "[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed (_ssl.c:1082)"
        )
        translated = _translate(wrap(error))
        self.assertEqual(translated.exit_code, EXIT_PEER_FAILED_VERIFICATION)
        self.assertNotIn("[SSL:", str(translated))
        self.assertNotIn("_ssl.c", str(translated))

    def test_other_ssl_failure_is_35(self):
        translated = _translate(wrap(ssl.SSLError(1, "tls handshake failure")))
        self.assertEqual(translated.exit_code, EXIT_SSL_CONNECT_ERROR)

    def test_message_does_not_leak_the_windows_errno(self):
        translated = _translate(
            wrap(OSError(10061, "no route to host", None, None))
        )
        self.assertNotIn("10061", str(translated))
        self.assertNotIn("[", str(translated))


class ProtocolTests(unittest.TestCase):
    def test_unsupported_protocol_is_1(self):
        exc = httpx.UnsupportedProtocol("nope", request=httpx.Request("GET", "gopher://h/"))
        self.assertEqual(_translate(exc).exit_code, EXIT_UNSUPPORTED_PROTOCOL)

    def test_transport_failures_are_55(self):
        for factory in (httpx.RemoteProtocolError, httpx.LocalProtocolError):
            exc = factory("peer went away", request=httpx.Request("GET", "http://h/"))
            self.assertEqual(_translate(exc).exit_code, EXIT_SEND_ERROR, factory)

    def test_unknown_errors_fall_back_to_usage(self):
        self.assertEqual(_translate(httpx.HTTPError("?")).exit_code, EXIT_USAGE)


class ExitCodeTableTests(unittest.TestCase):
    def test_the_documented_codes_are_distinct(self):
        codes = [
            EXIT_USAGE,
            EXIT_UNSUPPORTED_PROTOCOL,
            EXIT_COULDNT_RESOLVE_HOST,
            EXIT_COULDNT_CONNECT,
            EXIT_READ_ERROR,
            EXIT_SSL_CONNECT_ERROR,
            EXIT_OPERATION_TIMEDOUT,
            EXIT_SEND_ERROR,
            EXIT_PEER_FAILED_VERIFICATION,
        ]
        self.assertEqual(len(codes), len(set(codes)))


if __name__ == "__main__":
    unittest.main()
