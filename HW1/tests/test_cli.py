from __future__ import annotations

import contextlib
import io
import unittest

from curlike.cli import _delay, build_parser, parse_args
from curlike.output import filename_from_response, name_from_url_path, safe_filename
from curlike.writeout import render, unescape


class RenderTests(unittest.TestCase):
    CONTEXT = {"http_code": "200", "time_total": "0.012345", "size_download": "9"}

    def render(self, template):
        return render(template, self.CONTEXT)

    def test_substitution(self):
        self.assertEqual(self.render("%{http_code}"), "200")

    def test_repeated_token(self):
        self.assertEqual(self.render("%{http_code} %{http_code}"), "200 200")

    def test_mixed_text(self):
        self.assertEqual(self.render("code=%{http_code} in %{time_total}"), "code=200 in 0.012345")

    def test_newline_escape(self):
        self.assertEqual(self.render("a\\nb"), "a\nb")

    def test_tab_escape(self):
        self.assertEqual(unescape("a\\tb"), "a\tb")

    def test_unknown_token_is_empty(self):
        self.assertEqual(self.render("%{nope}"), "")

    def test_unknown_token_warns(self):
        log = io.StringIO()
        from curlike.diagnostics import Log

        verbose = Log(log, verbose=True)
        render("%{nope}", self.CONTEXT, verbose)
        self.assertIn("nope", log.getvalue())

    def test_percent_without_brace_is_literal(self):
        self.assertEqual(self.render("100%"), "100%")


class NumberFormatTests(unittest.TestCase):
    def test_integer_drops_decimals(self):
        from curlike.writeout import integer

        self.assertEqual(integer(12.9), "12")

    def test_seconds_has_six_places(self):
        from curlike.writeout import seconds

        self.assertEqual(seconds(1.5), "1.500000")


class FilenameTests(unittest.TestCase):
    def test_quoted_filename(self):
        response = type("R", (), {"headers": {"content-disposition": 'attachment; filename="a.csv"'}})()
        self.assertEqual(filename_from_response(response), "a.csv")

    def test_bare_filename(self):
        response = type("R", (), {"headers": {"content-disposition": "attachment; filename=a.csv"}})()
        self.assertEqual(filename_from_response(response), "a.csv")

    def test_rfc5987_filename(self):
        disposition = "attachment; filename*=UTF-8''%E6%B8%AC%E8%A9%A6.txt"
        response = type("R", (), {"headers": {"content-disposition": disposition}})()
        self.assertEqual(filename_from_response(response), "測試.txt")

    def test_no_disposition(self):
        response = type("R", (), {"headers": {}})()
        self.assertIsNone(filename_from_response(response))

    def test_traversal_is_stripped(self):
        self.assertEqual(safe_filename("../../etc/passwd"), "passwd")
        self.assertEqual(safe_filename(r"C:\windows\evil.exe"), "evil.exe")

    def test_dots_only(self):
        self.assertIsNone(safe_filename(".."))
        self.assertIsNone(safe_filename(""))
        self.assertIsNone(safe_filename("."))

    def test_name_from_url(self):
        self.assertEqual(name_from_url_path("http://h/a/b/c.txt"), "c.txt")
        self.assertEqual(name_from_url_path("http://h/"), None)

    def test_name_from_url_decodes(self):
        self.assertEqual(name_from_url_path("http://h/a%20b.txt"), "a b.txt")


class ParserTests(unittest.TestCase):
    def test_url_is_optional(self):
        self.assertEqual(parse_args([]).url, [])

    def test_repeatable_header(self):
        self.assertEqual(parse_args(["-H", "a: 1", "-H", "b: 2", "u"]).header, ["a: 1", "b: 2"])

    def test_attached_short_value(self):
        self.assertEqual(parse_args(["-XPOST", "u"]).method, "POST")

    def test_retry_delay_max_means_exponential(self):
        self.assertIsNone(parse_args(["--retry-delay", "max", "u"]).retry_delay)

    def test_retry_delay_number(self):
        self.assertEqual(parse_args(["--retry-delay", "2.5", "u"]).retry_delay, 2.5)

    def test_negative_delay_rejected(self):
        with self.assertRaises(SystemExit):
            parse_args(["--retry-delay", "-1", "u"])

    def test_help_exits_cleanly(self):
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            with self.assertRaises(SystemExit) as caught:
                build_parser().parse_args(["--help"])
        self.assertEqual(caught.exception.code, 0)
        self.assertIn("curl-like", captured.getvalue())

    def test_delay_parser_rejects_words(self):
        import argparse

        with self.assertRaises(argparse.ArgumentTypeError):
            _delay("later")


if __name__ == "__main__":
    unittest.main()