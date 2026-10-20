from __future__ import annotations

import io
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import quote_plus

from curlike.body import DataSource, build_body, parse_form_field
from curlike.cli import parse_args
from curlike.errors import FileReadError, UsageError

HERE = Path(__file__).resolve().parent
SAMPLE = HERE / "helpers.py"


def opts(*argv: str):
    return parse_args(list(argv) + ["http://example.com/"])


def source(data: bytes = b"") -> DataSource:
    return DataSource(io.BytesIO(data))


class FormEncodingTests(unittest.TestCase):
    def test_no_data_is_empty(self):
        body, query = build_body(opts(), source())
        self.assertFalse(body.present)
        self.assertEqual(query, "")

    def test_data_becomes_post_body(self):
        body, query = build_body(opts("-d", "a=1", "-d", "b=2"), source())
        self.assertEqual(body.content, b"a=1&b=2")
        self.assertEqual(body.headers["Content-Type"], "application/x-www-form-urlencoded")
        self.assertEqual(query, "")

    def test_data_is_not_re_encoded(self):
        body, _ = build_body(opts("-d", "q=a b&c=d"), source())
        self.assertEqual(body.content, b"q=a b&c=d")

    def test_data_without_equals_stays_bare(self):
        body, _ = build_body(opts("-d", "plain"), source())
        self.assertEqual(body.content, b"plain")

    def test_data_at_file_is_read(self):
        with TemporaryDirectory() as folder:
            payload = Path(folder) / "field.txt"
            payload.write_text("a=b c", encoding="utf-8")
            body, _ = build_body(opts("-d", f"@{payload}"), source())
        # curl does not re-encode --data, so the bytes arrive as typed.
        self.assertEqual(body.content, b"a=b c")

    def test_data_at_file_strips_newlines(self):
        with TemporaryDirectory() as folder:
            payload = Path(folder) / "field.txt"
            payload.write_text("one\ntwo\n", encoding="utf-8")
            body, _ = build_body(opts("-d", f"@{payload}"), source())
        self.assertEqual(body.content, b"onetwo")

    def test_missing_data_file_is_a_read_error(self):
        with self.assertRaises(FileReadError):
            build_body(opts("-d", "@no-such-file"), source())

    def test_data_raw_is_literal(self):
        body, _ = build_body(opts("--data-raw", "a=@b"), source())
        self.assertEqual(body.content, b"a=@b")

    def test_data_binary_keeps_bytes(self):
        body, _ = build_body(opts("--data-binary", "a=%20b"), source())
        self.assertEqual(body.content, b"a=%20b")

    def test_data_binary_reads_stdin(self):
        body, _ = build_body(opts("--data-binary", "@-"), source(b"from stdin"))
        self.assertEqual(body.content, b"from stdin")

    def test_data_urlencode_encodes_value(self):
        body, _ = build_body(opts("--data-urlencode", "q=a b/c"), source())
        # curl uses "+" for spaces here, not "%20".
        self.assertEqual(body.content, b"q=a+b%2Fc")

    def test_data_urlencode_whole_value(self):
        body, _ = build_body(opts("--data-urlencode", "a b"), source())
        self.assertEqual(body.content, b"a+b")

    def test_data_urlencode_leaves_the_name_alone(self):
        body, _ = build_body(opts("--data-urlencode", "n ame=v alue"), source())
        self.assertEqual(body.content, b"n ame=v+alue")

    def test_data_urlencode_empty_name_drops_the_equals(self):
        body, _ = build_body(opts("--data-urlencode", "=a b"), source())
        self.assertEqual(body.content, b"a+b")

    def test_data_urlencode_reads_a_bare_at_file(self):
        body, _ = build_body(opts("--data-urlencode", f"@{SAMPLE}"), source())
        self.assertTrue(body.content.startswith(b"%22%22%22A+tiny+HTTP"))

    def test_data_urlencode_named_at_file(self):
        body, _ = build_body(opts("--data-urlencode", f"note@{SAMPLE}"), source())
        self.assertTrue(body.content.startswith(b"note=%22%22%22A+tiny+HTTP"))

    def test_data_urlencode_equals_at_file_is_literal(self):
        # Only an "@" ahead of any "=" names a file; here it is just text.
        body, _ = build_body(opts("--data-urlencode", f"k=@{SAMPLE}"), source())
        self.assertEqual(body.content, b"k=" + quote_plus(f"@{SAMPLE}").encode())

    def test_data_strips_newlines_but_urlencode_does_not(self):
        body, _ = build_body(opts("-d", f"@{SAMPLE}"), source())
        self.assertNotIn(b"\n", body.content)
        body, _ = build_body(opts("--data-urlencode", f"@{SAMPLE}"), source())
        self.assertIn(b"%0A", body.content)

    def test_get_moves_data_to_query(self):
        body, query = build_body(opts("-G", "-d", "q=curl"), source())
        self.assertFalse(body.present)
        self.assertEqual(query, "q=curl")

    def test_get_with_data_binary_is_rejected(self):
        with self.assertRaises(UsageError):
            build_body(opts("-G", "--data-binary", "x"), source())


class JsonTests(unittest.TestCase):
    def test_json_sets_content_type_and_accept(self):
        body, _ = build_body(opts("--json", '{"a":1}'), source())
        self.assertEqual(body.content, b'{"a":1}')
        self.assertEqual(body.headers["Content-Type"], "application/json")
        self.assertEqual(body.headers["Accept"], "application/json")

    def test_json_respects_explicit_accept(self):
        body, _ = build_body(opts("--json", '{"a":1}', "-H", "Accept: text/plain"), source())
        self.assertEqual(body.headers["Accept"], "text/plain")

    def test_invalid_json_is_a_usage_error(self):
        with self.assertRaises(UsageError):
            build_body(opts("--json", "{nope}"), source())


class UploadTests(unittest.TestCase):
    def test_upload_reads_stdin(self):
        body, _ = build_body(opts("-T", "-"), source(b"binary\x00data"))
        self.assertEqual(body.content, b"binary\x00data")
        self.assertEqual(body.kind, "upload")

    def test_upload_sets_no_content_type(self):
        body, _ = build_body(opts("-T", "-"), source(b"x"))
        self.assertEqual(body.headers, {})


class MultipartTests(unittest.TestCase):
    def test_plain_field_is_not_sent_as_a_file(self):
        body, _ = build_body(opts("-F", "a=1"), source())
        self.assertEqual(body.kind, "multipart")
        # A bare value would make httpx label the part filename="upload".
        self.assertEqual(body.files, [("a", (None, "1"))])

    def test_file_field_gets_a_guessed_type(self):
        files = parse_form_field(f"f=@{SAMPLE}", source())
        self.assertEqual(files[0], "f")
        self.assertEqual(files[1][0], "helpers.py")
        self.assertEqual(files[1][2], "text/x-python")

    def test_explicit_type_and_filename(self):
        files = parse_form_field("f=@-;type=text/plain;filename=x.txt", source(b"hi"))
        self.assertEqual(files[1], ("x.txt", b"hi", "text/plain"))

    def test_lt_reads_value_not_file(self):
        name, (filename, content) = parse_form_field(f"f=<{SAMPLE}", source())
        self.assertEqual(name, "f")
        self.assertIsNone(filename)
        self.assertIn(b"import", content)

    def test_missing_equals_is_rejected(self):
        with self.assertRaises(UsageError):
            parse_form_field("nope", source())

    def test_form_and_data_conflict(self):
        with self.assertRaises(UsageError):
            build_body(opts("-F", "a=1", "-d", "b=2"), source())

    def test_form_and_json_conflict(self):
        with self.assertRaises(UsageError):
            build_body(opts("-F", "a=1", "--json", "{}"), source())

    def test_upload_and_json_conflict(self):
        with self.assertRaises(UsageError):
            build_body(opts("-T", "-", "--json", "{}"), source())


if __name__ == "__main__":
    unittest.main()