from __future__ import annotations

import unittest

from curlike.errors import UnsupportedProtocol, UsageError
from curlike.urlbuild import (
    append_query,
    display_host,
    effective_host,
    expand_url_glob,
    normalize_url,
    with_query,
)


class NormalizeTests(unittest.TestCase):
    def test_adds_default_scheme(self):
        self.assertEqual(normalize_url("example.com"), "http://example.com/")

    def test_keeps_explicit_https_and_path(self):
        self.assertEqual(normalize_url("https://example.com/a"), "https://example.com/a")

    def test_keeps_query_and_fragment(self):
        self.assertEqual(
            normalize_url("https://h/p?a=1#f"), "https://h/p?a=1#f"
        )

    def test_rejects_other_schemes(self):
        with self.assertRaises(UnsupportedProtocol):
            normalize_url("ftp://example.com")

    def test_rejects_missing_host(self):
        with self.assertRaises(UsageError):
            normalize_url("http:///path")

    def test_rejects_empty(self):
        with self.assertRaises(UsageError):
            normalize_url("   ")


class GlobTests(unittest.TestCase):
    def test_no_glob_is_identity(self):
        self.assertEqual(expand_url_glob("http://h/a"), ["http://h/a"])

    def test_numeric_range_is_zero_padded(self):
        self.assertEqual(
            expand_url_glob("http://h/{01..03}"),
            ["http://h/01", "http://h/02", "http://h/03"],
        )

    def test_range_with_step(self):
        # Values are zero-padded to the width of the largest endpoint.
        self.assertEqual(
            expand_url_glob("http://h/{0..10..5}"),
            ["http://h/00", "http://h/05", "http://h/10"],
        )

    def test_range_keeps_narrow_width(self):
        self.assertEqual(
            expand_url_glob("http://h/{1..3}"), ["http://h/1", "http://h/2", "http://h/3"]
        )

    def test_alpha_range(self):
        self.assertEqual(expand_url_glob("http://h/{a..c}"), ["http://h/a", "http://h/b", "http://h/c"])

    def test_comma_list(self):
        self.assertEqual(expand_url_glob("http://h/{a,b}"), ["http://h/a", "http://h/b"])

    def test_literal_braces_pair(self):
        self.assertEqual(expand_url_glob("http://h/{}"), ["http://h/"])

    def test_two_groups_combine(self):
        self.assertEqual(
            expand_url_glob("http://h/{a..b}/{1..2}"),
            ["http://h/a/1", "http://h/a/2", "http://h/b/1", "http://h/b/2"],
        )

    def test_bracket_set(self):
        self.assertEqual(expand_url_glob("http://h/f[1-3]"), ["http://h/f1", "http://h/f2", "http://h/f3"])

    def test_bracket_list(self):
        self.assertEqual(expand_url_glob("http://h/f[a,b]"), ["http://h/fa", "http://h/fb"])

    def test_unknown_bracket_kept_verbatim(self):
        self.assertEqual(expand_url_glob("http://h/we[ird]"), ["http://h/we[ird]"])

    def test_backwards_range_is_an_error(self):
        with self.assertRaises(UsageError):
            expand_url_glob("http://h/{3..1}")


class QueryTests(unittest.TestCase):
    def test_append_to_empty_query(self):
        self.assertEqual(append_query("http://h/p", "a=1"), "http://h/p?a=1")

    def test_append_keeps_existing(self):
        self.assertEqual(append_query("http://h/p?x=1", "a=1"), "http://h/p?x=1&a=1")

    def test_append_empty_is_identity(self):
        self.assertEqual(append_query("http://h/p", ""), "http://h/p")

    def test_append_keeps_fragment(self):
        self.assertEqual(append_query("http://h/p#f", "a=1"), "http://h/p?a=1#f")

    def test_with_query_replaces(self):
        self.assertEqual(with_query("http://h/p?old=1", [("new", "2")]), "http://h/p?new=2")


class HostTests(unittest.TestCase):
    def test_display_host_adds_default_port(self):
        self.assertEqual(display_host("http://h/p"), "h:80")
        self.assertEqual(display_host("https://h/p"), "h:443")

    def test_display_host_keeps_explicit_port(self):
        self.assertEqual(display_host("http://h:8080/p"), "h:8080")

    def test_effective_host_lowercases(self):
        self.assertEqual(effective_host("http://EXAMPLE.com:80/p"), "example.com")


if __name__ == "__main__":
    unittest.main()