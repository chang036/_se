"""Decides where the response goes and in what order things get printed."""

from __future__ import annotations

import re
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import unquote, urlsplit

from .diagnostics import Sink
from .errors import WriteError
from .writeout import render

_FILENAME_STAR_RE = re.compile(r"filename\*\s*=\s*([^']*)'([^']*)'([^;\r\n]+)", re.IGNORECASE)
_FILENAME_RE = re.compile(r"filename\s*=\s*(\"[^\"]*\"|[^;\r\n]*)", re.IGNORECASE)


class Output:
    """Owns every write to stdout, to ``-o`` targets and to ``-D`` dumps."""

    def __init__(
        self,
        *,
        output: str | None = None,
        remote_name: bool = False,
        name_from_url: bool = False,
        include: bool = False,
        dump_header: str | None = None,
        write_out: str | None = None,
        fail: bool = False,
        fail_with_body: bool = None,
        log: Any = None,
        stdout: Any = None,
    ) -> None:
        self.output = output
        self.remote_name = remote_name
        self.name_from_url = name_from_url
        self.include = include
        self.dump_header = dump_header
        self.write_out = write_out
        self.fail = fail
        self.fail_with_body = bool(fail_with_body)
        self.log = log
        self.stdout = stdout if stdout is not None else sys.stdout.buffer

    # -- naming ------------------------------------------------------------

    def target_for(self, url: str, response: Any, index: int, total: int) -> str | None:
        """The file the body should go to, or ``None`` for stdout."""
        if self.output:
            return self.output
        if self.remote_name:
            return filename_from_response(response) or f"index-{index:02d}"
        if self.name_from_url:
            return name_from_url_path(url) or f"index-{index:02d}"
        if total > 1:
            name = name_from_url_path(url) or "index"
            return f"{index:02d}-{name}"
        return None

    # -- writing -----------------------------------------------------------

    @contextmanager
    def stream(self, url: str, response: Any, index: int, total: int) -> Iterator[Any]:
        """Yield a binary sink for headers, body and the ``-w`` line."""
        with Sink(self.target_for(url, response, index, total), stdout=self.stdout) as sink:
            yield sink

    def dump_headers(self, header_block: str) -> None:
        """``-D``: append the header block to its own file (``-`` = stdout)."""
        if not self.dump_header:
            return
        if self.dump_header == "-":
            sys.stdout.write(header_block)
            sys.stdout.flush()
            return
        try:
            with Path(self.dump_header).open(
                "a", encoding="utf-8", errors="surrogateescape"
            ) as handle:
                handle.write(header_block)
        except OSError as exc:
            raise WriteError(
                f"cannot write header dump to '{self.dump_header}': {exc.strerror}"
            ) from exc

    def write_format(self, template: str, context: dict[str, Any]) -> None:
        """``-w``: always stdout, even when the body went to ``-o``."""
        text = render(template, context, self.log)
        safe_write(self.stdout, text.encode("utf-8", "surrogateescape"))
        try:
            self.stdout.flush()
        except (OSError, ValueError):
            pass


def safe_write(sink: Any, data: bytes) -> None:
    """Write bytes, turning EPIPE into something the user can act on."""
    try:
        sink.write(data)
    except BrokenPipeError as exc:  # pragma: no cover - depends on the consumer
        raise WriteError("broken pipe while writing the response body") from exc
    except OSError as exc:
        raise WriteError(f"cannot write output: {exc.strerror}") from exc


def filename_from_response(response: Any) -> str | None:
    """Pull a filename out of Content-Disposition (RFC 5987 aware)."""
    disposition = response.headers.get("content-disposition")
    if not disposition:
        return None

    star = _FILENAME_STAR_RE.search(disposition)
    if star:
        return safe_filename(unquote(star.group(3).strip()))

    plain = _FILENAME_RE.search(disposition)
    if plain:
        value = plain.group(1).strip()
        if len(value) >= 2 and value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        return safe_filename(value)
    return None


def name_from_url_path(url: str) -> str | None:
    """``-O``: the last path segment of the URL."""
    path = urlsplit(url).path
    segment = unquote(path.rsplit("/", 1)[-1])
    return safe_filename(segment)


def safe_filename(name: str) -> str | None:
    """Never let a server walk out of the current directory via ``../``."""
    cleaned = (name or "").replace("\\", "/").split("/")[-1].strip()
    if not cleaned or cleaned in (".", ".."):
        return None
    return cleaned