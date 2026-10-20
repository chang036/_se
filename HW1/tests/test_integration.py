"""End-to-end tests: the real CLI in a subprocess against a local server."""

from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from tests.helpers import (
    ProxyServer,
    TestServer,
    fresh_state,
    proxied_requests,
    seen_requests,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NULL_DEVICE = "NUL" if sys.platform == "win32" else "/dev/null"


def curlike(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    # ``-m curlike`` resolves against sys.path, so the project root has to be
    # handed over explicitly whenever we run from some other directory.
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(
        [str(PROJECT_ROOT), env["PYTHONPATH"]] if env.get("PYTHONPATH") else [str(PROJECT_ROOT)]
    )
    return subprocess.run(
        [sys.executable, "-m", "curlike", *args],
        cwd=cwd or PROJECT_ROOT,
        env=env,
        capture_output=True,
        timeout=60,
    )


class ServerTestCase(unittest.TestCase):
    """Base class that boots one server for the whole class."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.server = TestServer().__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.__exit__(None, None, None)

    def setUp(self) -> None:
        fresh_state()

    def url(self, path: str) -> str:
        return self.server.base + path


class BasicGetTests(ServerTestCase):
    def test_plain_get(self):
        result = curlike(self.url("/"))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"hello from curlike\n")

    def test_method_is_get_by_default(self):
        curlike(self.url("/echo"))
        self.assertEqual(seen_requests()[-1]["method"], "GET")

    def test_include_prints_headers(self):
        result = curlike("-i", self.url("/"))
        self.assertIn(b"HTTP/1.1 200", result.stdout)
        self.assertIn(b"Content-Length: 19", result.stdout)
        self.assertTrue(result.stdout.endswith(b"hello from curlike\n"))

    def test_dump_header_to_stdout(self):
        result = curlike("-D", "-", "-o", NULL_DEVICE, self.url("/"))
        self.assertIn(b"HTTP/1.1 200", result.stdout)

    def test_verbose_shows_request_and_response(self):
        result = curlike("-v", self.url("/"))
        self.assertIn(b"> GET / HTTP/1.1", result.stderr)
        self.assertIn(b"< HTTP/1.1 200", result.stderr)
        self.assertIn(b"* Connected to", result.stderr)

    def test_silent_hides_errors_but_show_error_opts_back_in(self):
        result = curlike("-s", self.url("/status/500"))
        self.assertEqual(result.stdout, b"status body")
        self.assertEqual(result.stderr, b"")

        result = curlike("-sS", self.url("/status/500"))
        self.assertEqual(result.stderr, b"")

        result = curlike("-sS", "http://127.0.0.1:1/")
        self.assertIn(b"curlike:", result.stderr)

    def test_user_agent_and_custom_headers(self):
        curlike("-A", "my-agent/9", "-H", "X-Test: 1", self.url("/echo"))
        headers = seen_requests()[-1]["headers"]
        self.assertEqual(headers["user-agent"], "my-agent/9")
        self.assertEqual(headers["x-test"], "1")

    def test_header_blanking_syntax(self):
        # curl's "-H 'Name;'" sends the header with an empty value rather
        # than dropping it, which is how you override our own default.
        curlike("-H", "Accept;", self.url("/echo"))
        self.assertEqual(seen_requests()[-1]["headers"]["accept"], "")

    def test_header_blanking_survives_redirects(self):
        curlike("-H", "X-Trace;", "-L", self.url("/redirect"))
        for request in seen_requests():
            self.assertEqual(request["headers"]["x-trace"], "")

    def test_referer(self):
        curlike("-e", "https://ref.example/", self.url("/echo"))
        self.assertEqual(seen_requests()[-1]["headers"]["referer"], "https://ref.example/")

    def test_compressed_is_decoded(self):
        result = curlike("--compressed", self.url("/gzip"))
        self.assertEqual(result.stdout, b"compressed payload")
        self.assertIn("gzip", seen_requests()[-1]["headers"]["accept-encoding"])

    def test_head_request(self):
        result = curlike("-I", self.url("/"))
        self.assertEqual(seen_requests()[-1]["method"], "HEAD")
        self.assertEqual(result.stdout, b"")


class MethodAndBodyTests(ServerTestCase):
    def test_explicit_method(self):
        curlike("-X", "DELETE", self.url("/echo"))
        self.assertEqual(seen_requests()[-1]["method"], "DELETE")

    def test_json_implies_post(self):
        curlike("--json", '{"a":1}', self.url("/echo"))
        seen = seen_requests()[-1]
        self.assertEqual(seen["method"], "POST")
        self.assertEqual(seen["body"], b'{"a":1}')
        self.assertEqual(seen["headers"]["content-type"], "application/json")
        self.assertEqual(seen["headers"]["accept"], "application/json")

    def test_data_implies_post_and_form_encoding(self):
        curlike("-d", "a=1", "-d", "b=2", self.url("/echo"))
        seen = seen_requests()[-1]
        self.assertEqual(seen["method"], "POST")
        self.assertEqual(seen["body"], b"a=1&b=2")
        self.assertEqual(
            seen["headers"]["content-type"], "application/x-www-form-urlencoded"
        )

    def test_get_moves_data_to_query(self):
        result = curlike("-G", "-d", "q=curl&n=2", self.url("/args"))
        self.assertEqual(seen_requests()[-1]["method"], "GET")
        self.assertEqual(seen_requests()[-1]["body"], b"")
        self.assertEqual(result.stdout, b"q=curl&n=2")

    def test_get_keeps_existing_query(self):
        result = curlike("-G", "-d", "b=2", self.url("/args?a=1"))
        self.assertEqual(result.stdout, b"a=1&b=2")

    def test_multipart_upload(self):
        with TemporaryDirectory() as folder:
            payload = Path(folder) / "note.txt"
            payload.write_text("file body", encoding="utf-8")
            curlike("-F", f"file=@{payload}", "-F", "field=value", self.url("/echo"))

        seen = seen_requests()[-1]
        self.assertEqual(seen["method"], "POST")
        self.assertTrue(seen["headers"]["content-type"].startswith("multipart/form-data"))
        self.assertIn(b"file body", seen["body"])
        self.assertIn(b'name="field"', seen["body"])

    def test_raw_upload(self):
        with TemporaryDirectory() as folder:
            payload = Path(folder) / "blob.bin"
            payload.write_bytes(b"raw bytes \x00\x01")
            curlike("-T", str(payload), self.url("/echo"))

        seen = seen_requests()[-1]
        self.assertEqual(seen["method"], "PUT")
        self.assertEqual(seen["body"], b"raw bytes \x00\x01")

    def test_upload_from_stdin(self):
        result = subprocess.run(
            [sys.executable, "-m", "curlike", "-T", "-", self.url("/echo")],
            cwd=PROJECT_ROOT,
            input=b"piped in",
            capture_output=True,
            timeout=60,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(seen_requests()[-1]["body"], b"piped in")

    def test_bad_json_is_a_usage_error(self):
        result = curlike("--json", "{oops", self.url("/echo"))
        self.assertEqual(result.returncode, 2)
        self.assertIn(b"not valid JSON", result.stderr)

    def test_form_and_data_conflict(self):
        result = curlike("-F", "a=1", "-d", "b=2", self.url("/echo"))
        self.assertEqual(result.returncode, 2)


class RedirectTests(ServerTestCase):
    def test_not_followed_by_default(self):
        result = curlike(self.url("/redirect"))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"")
        self.assertEqual(len(seen_requests()), 1)

    def test_followed_with_location(self):
        result = curlike("-L", self.url("/redirect"))
        self.assertEqual(result.stdout, b"arrived\n")

    def test_post_becomes_get_on_302(self):
        curlike("-L", "-d", "a=1", self.url("/redirect"))
        seen = seen_requests()
        self.assertEqual(seen[0]["method"], "POST")
        self.assertEqual(seen[1]["method"], "GET")
        self.assertEqual(seen[1]["body"], b"")

    def test_max_redirs_is_enforced(self):
        result = curlike("-L", "--max-redirs", "3", self.url("/loop"))
        self.assertEqual(result.returncode, 47)
        self.assertIn(b"exceeded 3 redirects", result.stderr)

    def test_max_redirs_zero_follows_nothing(self):
        result = curlike("-L", "--max-redirs", "0", self.url("/redirect"))
        self.assertEqual(result.returncode, 47)

    def test_authorization_survives_same_host_redirect(self):
        curlike("-L", "-u", "admin:secret", self.url("/redirect"))
        seen = seen_requests()
        self.assertIn("authorization", seen[0]["headers"])
        self.assertIn("authorization", seen[1]["headers"])

    def test_authorization_is_dropped_cross_host(self):
        result = curlike("-L", "-u", "admin:secret", self.url("/redirect-external"))
        self.assertEqual(result.returncode, 0)
        seen = seen_requests()
        self.assertIn("authorization", seen[0]["headers"])
        self.assertNotIn("authorization", seen[1]["headers"])


class FailureTests(ServerTestCase):
    def test_fail_hides_body_and_exits_22(self):
        result = curlike("-f", self.url("/status/404"))
        self.assertEqual(result.returncode, 22)
        self.assertEqual(result.stdout, b"")

    def test_fail_with_body_keeps_body(self):
        result = curlike("--fail-with-body", self.url("/status/404"))
        self.assertEqual(result.returncode, 22)
        self.assertEqual(result.stdout, b"status body")

    def test_success_is_zero(self):
        self.assertEqual(curlike("-f", self.url("/")).returncode, 0)


class OutputTests(ServerTestCase):
    def test_output_to_file(self):
        with TemporaryDirectory() as folder:
            target = Path(folder) / "out.txt"
            result = curlike("-o", str(target), self.url("/"))
            self.assertEqual(result.stdout, b"")
            self.assertEqual(target.read_bytes(), b"hello from curlike\n")

    def test_write_out_goes_to_stdout_even_with_output_file(self):
        with TemporaryDirectory() as folder:
            target = Path(folder) / "out.txt"
            result = curlike("-o", str(target), "-w", "%{http_code}", self.url("/"))
            self.assertEqual(result.stdout, b"200")
            self.assertEqual(target.read_bytes(), b"hello from curlike\n")

    def test_include_goes_into_the_output_file(self):
        with TemporaryDirectory() as folder:
            target = Path(folder) / "out.txt"
            curlike("-i", "-o", str(target), self.url("/"))
            self.assertTrue(target.read_bytes().startswith(b"HTTP/1.1 200"))

    def test_name_from_url(self):
        with TemporaryDirectory() as folder:
            curlike("-O", self.url("/target"), cwd=Path(folder))
            target = Path(folder) / "target"
            self.assertEqual(target.read_bytes(), b"arrived\n")

    def test_remote_name_from_content_disposition(self):
        with TemporaryDirectory() as folder:
            curlike("-J", self.url("/disposition"), cwd=Path(folder))
            target = Path(folder) / "report.csv"
            self.assertEqual(target.read_bytes(), b"a,b\n1,2\n")

    def test_remote_name_cannot_escape_the_directory(self):
        with TemporaryDirectory() as folder:
            curlike("-J", self.url("/evil-disposition"), cwd=Path(folder))
            written = sorted(item.name for item in Path(folder).iterdir())
            self.assertEqual(written, ["escaped.txt"])

    def test_write_out_tokens(self):
        result = curlike(
            "-s",
            "-o",
            NULL_DEVICE,
            "-w",
            "%{http_code} %{size_download} %{num_redirects} %{time_total}\\n",
            self.url("/"),
        )
        self.assertRegex(result.stdout.decode(), r"^200 19 0 \d+\.\d{6}\n$")

    def test_write_out_with_redirects(self):
        result = curlike(
            "-sL",
            "-o",
            NULL_DEVICE,
            "-w",
            "%{http_code} %{num_redirects} %{url_effective}\\n",
            self.url("/redirect"),
        )
        text = result.stdout.decode()
        self.assertIn("200 1", text)
        self.assertTrue(text.endswith("/target\n"))

    def test_write_out_unknown_token_warns(self):
        result = curlike(
            "-s", "-o", NULL_DEVICE, "-w", "%{nope}", self.url("/")
        )
        self.assertEqual(result.stdout, b"")

    def test_timings_are_offsets_and_never_run_backwards(self):
        result = curlike(
            "-s",
            "-o",
            NULL_DEVICE,
            "-w",
            "%{time_namelookup} %{time_connect} %{time_appconnect} "
            "%{time_pretransfer} %{time_starttransfer} %{time_total}\n",
            self.url("/"),
        )
        stages = [float(value) for value in result.stdout.decode().split()]
        names = [
            "namelookup",
            "connect",
            "appconnect",
            "pretransfer",
            "starttransfer",
            "total",
        ]
        for earlier, later in zip(stages, stages[1:]):
            self.assertLessEqual(
                earlier, later, f"{names[stages.index(earlier)]} > {names[stages.index(later)]}"
            )

    def test_connection_details_are_reported(self):
        host, port = self.url("/").split("//", 1)[1].split("/", 1)[0].split(":")
        result = curlike(
            "-s",
            "-o",
            NULL_DEVICE,
            "-w",
            "%{remote_ip}:%{remote_port} %{local_ip} %{num_connects}\n",
            self.url("/"),
        )
        remote, local, connects = result.stdout.decode().split()
        self.assertEqual(remote, f"127.0.0.1:{port}")
        self.assertRegex(local, r"^127\.0\.0\.1$")
        self.assertEqual(connects, "1")

    def test_http_version_is_reported_without_the_prefix(self):
        result = curlike("-s", "-o", NULL_DEVICE, "-w", "%{http_version}", self.url("/"))
        # curl prints "1.1", not "HTTP/1.1".
        self.assertEqual(result.stdout, b"1.1")


class CookieTests(ServerTestCase):
    def test_inline_cookie_is_sent(self):
        curlike("-b", "a=1; b=2", self.url("/checkcookie"))
        self.assertEqual(seen_requests()[-1]["headers"]["cookie"], "a=1; b=2")

    def test_server_cookie_is_captured_and_replayed(self):
        result = curlike("-b", "seed=1", self.url("/setcookie"))
        self.assertEqual(result.returncode, 0)

        with TemporaryDirectory() as folder:
            jar = Path(folder) / "jar.txt"
            self.assertEqual(curlike("-c", str(jar), self.url("/setcookie")).returncode, 0)
            self.assertTrue(jar.exists())
            self.assertIn("session", jar.read_text(encoding="utf-8"))

            result = curlike("-b", str(jar), self.url("/checkcookie"))
            self.assertEqual(result.stdout, b"session=abc123")

    def test_cookie_jar_to_stdout(self):
        result = curlike("-c", "-", "-o", NULL_DEVICE, self.url("/setcookie"))
        self.assertIn(b"# Netscape HTTP Cookie File", result.stdout)
        self.assertIn(b"session", result.stdout)


class AuthTests(ServerTestCase):
    def test_basic_auth(self):
        result = curlike("-u", "admin:secret", self.url("/auth"))
        self.assertEqual(result.stdout, b"welcome admin\n")

    def test_missing_credentials(self):
        result = curlike(self.url("/auth"))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"denied\n")

    def test_bearer_token(self):
        curlike("--bearer", "tok", self.url("/echo"))
        self.assertEqual(seen_requests()[-1]["headers"]["authorization"], "Bearer tok")


class RetryTests(ServerTestCase):
    def test_no_retry_by_default(self):
        result = curlike(self.url("/flaky"))
        self.assertEqual(result.stdout, b"attempt 1 failed\n")

    def test_retry_recovers(self):
        result = curlike("--retry", "3", "--retry-delay", "0", self.url("/flaky"))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"recovered after 3\n")

    def test_retry_gives_up(self):
        result = curlike("--retry", "1", "--retry-delay", "0", "--fail", self.url("/status/503"))
        self.assertEqual(result.returncode, 22)

    def test_retry_after_header_is_used(self):
        result = curlike("--retry", "1", self.url("/retry-after"))
        self.assertEqual(result.returncode, 0)
        self.assertIn(b"busy", result.stdout)

    def test_retry_preserves_the_request_body(self):
        result = curlike(
            "--retry", "3", "--retry-delay", "0", "-d", "a=1", self.url("/flaky")
        )
        self.assertEqual(result.returncode, 0)
        self.assertTrue(all(r["body"] == b"a=1" for r in seen_requests()))


class ProxyTests(ServerTestCase):
    def setUp(self) -> None:
        super().setUp()
        self._proxy = ProxyServer().__enter__()
        self.addCleanup(self._proxy.__exit__, None, None, None)

    def test_traffic_goes_through_the_proxy(self):
        result = curlike("-x", self._proxy.base, self.url("/echo"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(proxied_requests()), 1)
        self.assertEqual(proxied_requests()[0]["method"], "GET")
        self.assertTrue(proxied_requests()[0]["target"].startswith("http://"))

    def test_proxy_also_carries_bodies(self):
        result = curlike("-x", self._proxy.base, "-d", "a=1", self.url("/echo"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(proxied_requests()[0]["method"], "POST")
        self.assertEqual(seen_requests()[-1]["body"], b"a=1")

    def test_noproxy_bypasses_the_proxy(self):
        result = curlike(
            "-x", self._proxy.base, "--noproxy", "127.0.0.1", self.url("/echo")
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(proxied_requests(), [])
        self.assertEqual(len(seen_requests()), 1)

    def test_noproxy_honours_a_list(self):
        host = self.url("/echo").split("//", 1)[1].split("/", 1)[0]
        result = curlike(
            "-x", self._proxy.base, "--noproxy", f"example.com,{host}", self.url("/echo")
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(proxied_requests(), [])

    def test_unreachable_proxy_reports_exit_7(self):
        # Port 1 is reserved and never listening.
        result = curlike("-x", "http://127.0.0.1:1", self.url("/echo"))
        self.assertEqual(result.returncode, 7)
        self.assertIn(b"(7)", result.stderr)


class TimeoutTests(ServerTestCase):
    def test_max_time_is_enforced(self):
        result = curlike("--max-time", "0.3", self.url("/slow?3"))
        self.assertEqual(result.returncode, 28)
        self.assertIn(b"timed out", result.stderr.lower())

    def test_connect_timeout_on_dead_port(self):
        result = curlike("--connect-timeout", "0.3", "http://127.0.0.1:1/")
        self.assertNotEqual(result.returncode, 0)


class UrlGlobTests(ServerTestCase):
    def test_brace_range_sends_one_request_each(self):
        result = curlike("-s", "-o", NULL_DEVICE, "-w", "%{url}\\n", self.url("/echo?{1..3}"))
        lines = [line for line in result.stdout.decode().splitlines() if line]
        self.assertEqual(len(lines), 3)
        self.assertTrue(lines[0].endswith("/echo?1"))
        self.assertEqual(len(seen_requests()), 3)


class UsageErrorTests(ServerTestCase):
    def test_no_url(self):
        result = curlike()
        self.assertEqual(result.returncode, 2)
        self.assertIn(b"no URL specified", result.stderr)

    def test_bad_scheme(self):
        result = curlike("ftp://example.com")
        self.assertEqual(result.returncode, 1)
        self.assertIn(b"unsupported URL scheme", result.stderr)

    def test_bad_header_syntax(self):
        result = curlike("-H", "  ", self.url("/"))
        self.assertEqual(result.returncode, 2)
        self.assertIn(b"expects 'Name: value'", result.stderr)

    def test_missing_file_for_upload(self):
        result = curlike("-T", "no-such-file.bin", self.url("/"))
        self.assertEqual(result.returncode, 26)

    def test_http1_0_is_rejected(self):
        result = curlike("--http1.0", self.url("/"))
        self.assertEqual(result.returncode, 2)

    def test_http2_without_h2_package(self):
        try:
            import h2  # noqa: F401
        except ImportError:
            result = curlike("--http2", self.url("/"))
            self.assertEqual(result.returncode, 2)
            self.assertIn(b"h2", result.stderr)


if __name__ == "__main__":
    unittest.main()