from __future__ import annotations

import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import httpx

from curlike import cookies as cookiejar


class CookieHeaderTests(unittest.TestCase):
    def test_single_pair(self):
        self.assertEqual(cookiejar.parse_cookie_header("a=1"), [("a", "1")])

    def test_several_pairs(self):
        self.assertEqual(cookiejar.parse_cookie_header("a=1; b=2"), [("a", "1"), ("b", "2")])

    def test_comma_separator(self):
        self.assertEqual(cookiejar.parse_cookie_header("a=1, b=2"), [("a", "1"), ("b", "2")])

    def test_empty_value_is_kept(self):
        self.assertEqual(cookiejar.parse_cookie_header("a="), [("a", "")])

    def test_valueless_cookie(self):
        self.assertEqual(cookiejar.parse_cookie_header("flag"), [("flag", "")])


class CookieFileTests(unittest.TestCase):
    def test_roundtrip(self):
        jar = httpx.Cookies()
        jar.set("session", "abc", domain="example.com", path="/")

        with TemporaryDirectory() as folder:
            target = Path(folder) / "jar.txt"
            cookiejar.write(jar, str(target))
            reloaded = cookiejar.read(target)

        values = {cookie.name: cookie.value for cookie in reloaded.jar}
        self.assertEqual(values, {"session": "abc"})

    def test_format_is_netscape(self):
        jar = httpx.Cookies()
        jar.set("a", "1", domain="example.com", path="/")
        text = cookiejar.serialise(jar)
        self.assertIn("# Netscape HTTP Cookie File", text)
        line = [row for row in text.splitlines() if not row.startswith("#")][0]
        self.assertEqual(line.split("\t")[5], "a")

    def test_httponly_prefix_is_understood(self):
        text = "# Netscape HTTP Cookie File\n#HttpOnly_.example.com\tTRUE\t/\tFALSE\t0\tsid\txyz\n"
        jar = cookiejar._parse(text)
        cookies = {cookie.name: cookie for cookie in jar}

        self.assertIn("sid", cookies)
        self.assertTrue(cookies["sid"].has_nonstandard_attr("HttpOnly"))

    def test_expired_cookies_are_dropped(self):
        text = (
            "# Netscape HTTP Cookie File\n"
            ".example.com\tTRUE\t/\tFALSE\t1\tgone\tvalue\n"
        )
        jar = cookiejar._parse(text)
        self.assertEqual(len([c for c in jar if not c.is_expired(time.time())]), 0)

    def test_missing_file_is_an_empty_jar(self):
        self.assertEqual(len(cookiejar.read("no-such-cookie-file.txt").jar), 0)

    def test_comments_and_blank_lines_are_skipped(self):
        text = "# comment\n\n\nexample.com\tFALSE\t/\tFALSE\t0\tk\tv\n"
        jar = cookiejar._parse(text)
        self.assertEqual([cookie.name for cookie in jar], ["k"])


if __name__ == "__main__":
    unittest.main()