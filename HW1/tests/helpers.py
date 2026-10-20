"""A tiny HTTP server used by the integration tests."""

from __future__ import annotations

import base64
import gzip
import http.client
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

_LOCK = threading.Lock()
_FLAKY_HITS: dict[str, int] = {}
_SEEN: list[dict[str, Any]] = []
_PROXIED: list[dict[str, Any]] = []


def reset_state() -> None:
    with _LOCK:
        _FLAKY_HITS.clear()
        _SEEN.clear()
        _PROXIED.clear()


def seen_requests() -> list[dict[str, Any]]:
    with _LOCK:
        return list(_SEEN)


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # -- plumbing ------------------------------------------------------

    def log_message(self, *args: Any) -> None:  # keep the test output clean
        pass

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def _send(
        self,
        status: int,
        body: bytes | str = b"",
        headers: dict[str, str] | None = None,
    ) -> None:
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, payload: Any, status: int = 200) -> None:
        self._send(
            status,
            json.dumps(payload),
            {"Content-Type": "application/json"},
        )

    # -- routing -------------------------------------------------------

    def do_GET(self) -> None:
        self._route()

    do_POST = do_GET
    do_PUT = do_GET
    do_DELETE = do_GET
    do_PATCH = do_GET

    def do_HEAD(self) -> None:
        self._route()

    def _route(self) -> None:
        path, _, query = self.path.partition("?")
        body = self._read_body()

        with _LOCK:
            _SEEN.append(
                {
                    "method": self.command,
                    "path": path,
                    "query": query,
                    "headers": {k.lower(): v for k, v in self.headers.items()},
                    "body": body,
                }
            )

        if path == "/":
            self._send(200, "hello from curlike\n")
        elif path == "/echo":
            self._json(
                {
                    "method": self.command,
                    "query": query,
                    "headers": {k.lower(): v for k, v in self.headers.items()},
                    "body": body.decode("utf-8", "replace"),
                }
            )
        elif path == "/args":
            self._send(200, query)
        elif path == "/redirect":
            self._send(302, b"", {"Location": "/target"})
        elif path == "/redirect-external":
            # Same server, different hostname string -> cross-host redirect.
            self._send(302, b"", {"Location": f"{self.server.other_base_url}/target"})
        elif path == "/target":
            self._send(200, "arrived\n")
        elif path == "/loop":
            self._send(302, b"", {"Location": "/loop"})
        elif path.startswith("/status/"):
            self._send(int(path.rsplit("/", 1)[-1]), "status body")
        elif path == "/flaky":
            self._flaky()
        elif path == "/setcookie":
            self._send(200, "cookie set\n", {"Set-Cookie": "session=abc123; Path=/"})
        elif path == "/checkcookie":
            self._send(200, self.headers.get("Cookie", ""))
        elif path == "/gzip":
            payload = gzip.compress(b"compressed payload")
            self._send(
                200,
                payload,
                {"Content-Encoding": "gzip", "Content-Type": "text/plain"},
            )
        elif path == "/disposition":
            self._send(
                200,
                "a,b\n1,2\n",
                {"Content-Disposition": 'attachment; filename="report.csv"'},
            )
        elif path == "/evil-disposition":
            # A server trying to walk out of the current directory.
            self._send(
                200,
                "gotcha\n",
                {"Content-Disposition": 'attachment; filename="../../escaped.txt"'},
            )
        elif path == "/auth":
            self._auth()
        elif path == "/slow":
            time.sleep(float(query or "2"))
            self._send(200, "slow\n")
        elif path == "/retry-after":
            self._send(503, "busy\n", {"Retry-After": "1"})
        else:
            self._send(404, "not found\n")

    # -- route helpers -------------------------------------------------

    def _flaky(self) -> None:
        with _LOCK:
            _FLAKY_HITS["flaky"] = _FLAKY_HITS.get("flaky", 0) + 1
            hits = _FLAKY_HITS["flaky"]
        if hits <= 2:
            self._send(503, f"attempt {hits} failed\n")
        else:
            self._send(200, f"recovered after {hits}\n")

    def _auth(self) -> None:
        header = self.headers.get("Authorization", "")
        expected = "Basic " + base64.b64encode(b"admin:secret").decode()
        if header == expected:
            self._send(200, "welcome admin\n")
        else:
            self._send(401, "denied\n", {"WWW-Authenticate": 'Basic realm="test"'})


class _Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request: Any, client_address: Any) -> None:
        # Tests deliberately abort requests (timeouts, HEAD). A reset socket
        # is the expected outcome, not a test failure, so stay quiet.
        if not issubclass(sys.exc_info()[0] or Exception, (ConnectionError, BrokenPipeError)):
            super().handle_error(request, client_address)

    @property
    def base_url(self) -> str:
        host, port = self.server_address[:2]
        return f"http://{host}:{port}"

    @property
    def other_base_url(self) -> str:
        """Same server reached through a different host name."""
        _, port = self.server_address[:2]
        return f"http://localhost:{port}"


class TestServer:
    """Context manager that runs :class:`_Server` on a random port."""

    def __init__(self) -> None:
        self._httpd: _Server | None = None
        self._thread: threading.Thread | None = None
        self.base: str = ""

    def __enter__(self) -> "TestServer":
        self._httpd = _Server(("127.0.0.1", 0), _Handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        self.base = self._httpd.base_url
        return self

    def __exit__(self, *exc: Any) -> None:
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)


def fresh_state() -> None:
    """Call from ``setUp`` so each test starts with an empty journal."""
    reset_state()


class _ProxyHandler(BaseHTTPRequestHandler):
    """A minimal forwarding proxy: absolute-form request line, then relay."""

    protocol_version = "HTTP/1.1"

    def log_message(self, *args: Any) -> None:
        pass

    def _relay(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""

        with _LOCK:
            _PROXIED.append(
                {
                    "method": self.command,
                    "target": self.path,
                    "headers": {k.lower(): v for k, v in self.headers.items()},
                }
            )

        if not self.path.startswith(("http://", "https://")):
            # A direct request: the client ignored the proxy entirely.
            self.send_response(400)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        rest = self.path.split("://", 1)[1]
        netloc, _, tail = rest.partition("/")
        host, _, port = netloc.partition(":")
        try:
            connection = http.client.HTTPConnection(host, int(port or 80), timeout=10)
            connection.request(self.command, "/" + tail, body=body, headers=dict(self.headers))
            upstream = connection.getresponse()
            payload = upstream.read()
        except OSError as exc:
            self.send_response(502)
            self.send_header("Content-Length", "0")
            self.end_headers()
            del exc
            return

        self.send_response(upstream.status)
        for key, value in upstream.getheaders():
            if key.lower() in ("transfer-encoding", "content-length", "connection"):
                continue
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    do_GET = do_POST = do_PUT = do_HEAD = do_DELETE = do_PATCH = _relay


class ProxyServer:
    """Context manager wrapping a throwaway proxy on a random port."""

    def __init__(self) -> None:
        self._httpd: _Server | None = None
        self._thread: threading.Thread | None = None
        self.base: str = ""

    def __enter__(self) -> "ProxyServer":
        self._httpd = _Server(("127.0.0.1", 0), _ProxyHandler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        self.base = self._httpd.base_url
        return self

    def __exit__(self, *exc: Any) -> None:
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)


def proxied_requests() -> list[dict[str, Any]]:
    with _LOCK:
        return list(_PROXIED)