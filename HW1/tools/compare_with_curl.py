"""Diff what curl and curlike actually put on the wire.

Runs the same request through both CLIs against the local test server and
prints the request each one produced, so parity gaps are easy to eyeball.

    python tools/compare_with_curl.py
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tests.helpers import TestServer, fresh_state, seen_requests  # noqa: E402

CURL = shutil.which("curl") or shutil.which("curl.exe")
NOISE = {"host", "accept-encoding", "connection", "content-length", "user-agent", "expect"}

# A multipart boundary is a whole line of 16+ alphanumerics, optionally
# wrapped in dashes. curl emits "--<24 chars>" and httpx emits "<32 hex>", so
# both shapes get folded to the same token before comparing.
BOUNDARY_LINE_RE = re.compile(rb"(?m)^-+[0-9a-zA-Z]{16,}-*\r?$|^[0-9a-zA-Z]{16,}\r?$")
# The same boundary also appears inside the Content-Type header value.
BOUNDARY_PARAM_RE = re.compile(rb"(boundary=)-*[0-9a-zA-Z]{16,}")

# .txt rather than .md: curl's built-in MIME table and Python's mimetypes
# agree on the common extensions but not on newer ones (.md, .json), and that
# difference is documented in the README rather than reported as a mismatch.
SAMPLE = ROOT / "tools" / "sample.txt"


def normalise(body: bytes) -> bytes:
    """Blank out the random multipart boundary so the two agree.

    curl and httpx each pick a fresh boundary per request, and in different
    but equally legal formats, so the raw bytes can never match. The boundary
    also shows up in the Content-Type header, so this is applied there too.
    """
    body = BOUNDARY_LINE_RE.sub(b"--BOUNDARY", body)
    return BOUNDARY_PARAM_RE.sub(rb"\1BOUNDARY", body)


def summarise(request: dict) -> str:
    headers = sorted(
        f"{k}: {normalise(v.encode('utf-8', 'replace')).decode()}"
        for k, v in request["headers"].items()
        if k not in NOISE
    )
    body = normalise(request["body"])
    preview = body[:120].decode("utf-8", "replace") if body else ""
    target = request["path"] + (f"?{request['query']}" if request["query"] else "")
    lines = [f"{request['method']} {target}"]
    lines += [f"  {h}" for h in headers]
    if body:
        lines.append(f"  [body {len(body)}b] {preview}")
    return "\n".join(lines)


def main() -> int:
    if CURL is None:
        print("curl is not installed - nothing to compare against")
        return 0

    with TestServer() as server:
        cases: list[tuple[str, list[str], str]] = [
            ("plain GET", [], "/echo"),
            ("header + user agent", ["-A", "tester/1.0", "-H", "X-Test: yes"], "/echo"),
            ("repeated headers", ["-H", "X-A: 1", "-H", "X-B: 2"], "/echo"),
            ("empty header removal", ["-H", "Accept;"], "/echo"),
            ("colon-semi removal", ["-H", "User-Agent:;"], "/echo"),
            ("referer", ["-e", "https://ref.example.com/"], "/echo"),
            ("form post", ["-d", "a=1", "-d", "b=2"], "/echo"),
            ("data raw", ["--data-raw", "a=1&b=2"], "/echo"),
            ("data binary", ["--data-binary", "raw bytes"], "/echo"),
            ("data urlencode", ["--data-urlencode", "q=a b"], "/echo"),
            ("json post", ["--json", '{"a":1,"b":[2,3]}'], "/echo"),
            ("explicit method", ["-X", "PATCH", "-d", "x=1"], "/echo"),
            ("upload", ["-T", "tools/sample.txt"], "/echo"),
            ("form multipart", ["-F", "field=value", "-F", f"note=@{SAMPLE}"], "/echo"),
            ("form lt", ["-F", f"note=<{SAMPLE}"], "/echo"),
            ("get with query", ["-G", "-d", "q=curl"], "/echo"),
            ("get with urlencode query", ["-G", "--data-urlencode", "q=a b"], "/echo"),
            ("head", ["-I"], "/echo"),
            ("delete", ["-X", "DELETE"], "/echo"),
            ("basic auth", ["-u", "user:pass"], "/echo"),
            ("cookie inline", ["-b", "a=1; b=2"], "/echo"),
        ]

        mismatches = 0
        for label, args, path in cases:
            url = server.base + path
            print(f"\n=== {label}: {' '.join(args) or '(no flags)'}")

            fresh_state()
            mine = subprocess.run(
                [sys.executable, "-m", "curlike", *args, url],
                capture_output=True,
                timeout=60,
                cwd=ROOT,
            )
            mine_reqs = seen_requests()

            fresh_state()
            theirs = subprocess.run([CURL, "-s", "-S", *args, url], capture_output=True, timeout=60)
            their_reqs = seen_requests()

            if mine.returncode != 0:
                print(f"  !! curlike exit {mine.returncode}: {mine.stderr.decode(errors='replace').strip()}")
            if theirs.returncode != 0:
                print(f"  !! curl    exit {theirs.returncode}: {theirs.stderr.decode(errors='replace').strip()}")

            print("  --- curlike")
            for request in mine_reqs:
                print("      " + summarise(request).replace("\n", "\n      "))
            print("  --- curl")
            for request in their_reqs:
                print("      " + summarise(request).replace("\n", "\n      "))

            if [summarise(r) for r in mine_reqs] != [summarise(r) for r in their_reqs]:
                mismatches += 1
                print("  !! MISMATCH")

        print(f"\n{mismatches} mismatch(es) out of {len(cases)} case(s)")
        return 1 if mismatches else 0


if __name__ == "__main__":
    raise SystemExit(main())
