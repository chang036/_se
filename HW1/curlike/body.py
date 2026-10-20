"""Turn the body-related flags (``-d``/``-F``/``--json``/``-T``) into bytes.

The output is either a :class:`Body` that httpx can send directly, or - when
``-G`` is in play - a query string that gets appended to the URL instead.
"""

from __future__ import annotations

import json as jsonlib
import mimetypes
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, BinaryIO, Iterable
from urllib.parse import quote_plus

from .errors import FileReadError, UsageError

FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"
JSON_CONTENT_TYPE = "application/json"

_TRAILER_RE = re.compile(r";\s*(type|filename)\s*=\s*([^;]*)")


@dataclass
class Body:
    """What actually gets sent as the request payload."""

    kind: str = "none"
    content: bytes | None = None
    files: list[tuple[str, Any]] | None = None
    headers: dict[str, str] = field(default_factory=dict)

    @property
    def present(self) -> bool:
        return self.kind != "none"


class DataSource:
    """Reads ``@file`` arguments, caching stdin so it can be reused."""

    def __init__(self, stdin: BinaryIO | None = None) -> None:
        self._stdin = stdin if stdin is not None else sys.stdin.buffer
        self._stdin_cache: bytes | None = None

    def stdin_bytes(self) -> bytes:
        if self._stdin_cache is None:
            self._stdin_cache = self._stdin.read()
        return self._stdin_cache

    def read_file(self, token: str, what: str) -> bytes:
        """Read ``token``, or stdin when it is ``-``."""
        if token == "-":
            return self.stdin_bytes()
        try:
            return Path(token).read_bytes()
        except OSError as exc:
            raise FileReadError(f"cannot read {what} file '{token}': {exc.strerror}") from exc


def build_body(opts: Any, source: DataSource) -> tuple[Body, str]:
    """Return ``(body, query_string)``.

    ``query_string`` is only non-empty for ``-G``, where curl moves the data
    out of the body and into the URL.
    """
    exclusive = [
        flag
        for flag, value in (
            ("-F/--form", opts.form),
            ("--json", opts.json_data),
            ("-T/--upload-file", opts.upload_file),
        )
        if value
    ]
    if len(exclusive) > 1:
        raise UsageError("you can only pick one of " + ", ".join(exclusive))

    data_parts = _collect_data_parts(opts, source)
    if data_parts and opts.form:
        raise UsageError("-F/--form cannot be combined with -d/--data/--json/-T")

    if opts.form:
        files = [parse_form_field(spec, source) for spec in opts.form]
        return Body(kind="multipart", files=files), ""

    if opts.json_data is not None:
        return _build_json_body(opts, source), ""

    if opts.upload_file:
        content = source.read_file(opts.upload_file, "-T/--upload-file")
        return Body(kind="upload", content=content), ""

    if data_parts:
        payload = "&".join(data_parts)
        if opts.get:
            return Body(), payload
        return (
            Body(
                kind="form",
                content=payload.encode("utf-8", "surrogateescape"),
                headers={"Content-Type": FORM_CONTENT_TYPE},
            ),
            "",
        )

    return Body(), ""


def _build_json_body(opts: Any, source: DataSource) -> Body:
    raw = opts.json_data
    if raw.startswith("@"):
        text = source.read_file(raw[1:], "--json").decode("utf-8", "surrogateescape")
    else:
        text = raw

    try:
        jsonlib.loads(text)
    except jsonlib.JSONDecodeError as exc:
        raise UsageError(f"--json is not valid JSON: {exc.msg} (at line {exc.lineno})") from exc

    # curl also asks for JSON back, unless the user set Accept themselves.
    explicit = _explicit_header(opts, "accept")
    headers = {
        "Content-Type": JSON_CONTENT_TYPE,
        "Accept": explicit if explicit is not None else JSON_CONTENT_TYPE,
    }

    return Body(kind="json", content=text.encode("utf-8", "surrogateescape"), headers=headers)


def _explicit_header(opts: Any, wanted: str) -> str | None:
    """The last ``-H`` value for ``wanted``, or ``None`` if the user stayed quiet."""
    found: str | None = None
    for raw in opts.header or ():
        name, separator, value = raw.partition(":")
        if separator and name.strip().lower() == wanted:
            found = value.strip()
    return found


def _collect_data_parts(opts: Any, source: DataSource) -> list[str]:
    """Percent-encode every ``-d`` style flag into one ``name=value`` string."""
    parts: list[str] = []

    for value in opts.data or ():
        parts.append(_encode_data_arg(value, source))
    for value in opts.data_raw or ():
        parts.append(value)
    for value in opts.data_urlencode or ():
        parts.append(_encode_urlencoded(value, source))

    if opts.data_binary:
        if opts.get:
            raise UsageError("-G/--get cannot be combined with --data-binary")
        for value in opts.data_binary:
            content = (
                source.stdin_bytes()
                if value == "@-"
                else source.read_file(value[1:], "--data-binary")
                if value.startswith("@")
                else value.encode("utf-8", "surrogateescape")
            )
            parts.append(content.decode("utf-8", "surrogateescape"))

    return parts


def _encode_data_arg(value: str, source: DataSource) -> str:
    """``-d``: verbatim, with ``@file`` read and newlines stripped.

    curl does *not* URL-encode ``--data``; that is exactly what
    ``--data-urlencode`` exists for, so we keep the bytes as typed.
    """
    if value.startswith("@"):
        return _read_text_ish(source, value[1:], "--data")
    return value


def _encode_urlencoded(value: str, source: DataSource) -> str:
    """``--data-urlencode``: form-encode the value, leave the name verbatim.

    curl's rules, which are not quite symmetric:

    ==========================  ==========================
    ``content``                 ``quote_plus(content)``
    ``=content``                ``quote_plus(content)``
    ``name=content``            ``name=quote_plus(content)``
    ``@file``                   ``quote_plus(file)``
    ``name@file``               ``name=quote_plus(file)``
    ==========================  ==========================

    Two details bite: the name is never escaped, and ``name=@file`` does *not*
    read the file - only an ``@`` before any ``=`` introduces one.
    """
    field, separator, content = value.partition("=")
    if separator:
        # Everything after the first "=" is literal, even if it looks like a file.
        return f"{field}={quote_plus(content)}" if field else quote_plus(content)

    name, at, path = value.partition("@")
    if at:
        if not path:
            raise UsageError(f"--data-urlencode expects a file name, got '{value}'")
        # Newlines survive here, unlike -d, which strips them.
        raw = source.read_file(path, "--data-urlencode").decode("utf-8", "surrogateescape")
        return f"{name}={quote_plus(raw)}" if name else quote_plus(raw)

    return quote_plus(value)


def _read_text_ish(source: DataSource, token: str, what: str) -> str:
    raw = source.read_file(token, what).replace(b"\r\n", b"").replace(b"\n", b"")
    return raw.decode("utf-8", "surrogateescape")


def parse_form_field(spec: str, source: DataSource) -> tuple[str, Any]:
    """Parse one ``-F`` argument into a tuple httpx understands.

    Supports ``name=value``, ``name=@file``, ``name=<file`` plus the
    ``;type=`` and ``;filename=`` trailers.

    Every result is a ``(name, (filename, content))`` tuple because httpx
    treats a bare value as an upload and would label it ``filename="upload"``.
    A plain field is therefore spelled ``(name, (None, value))``.
    """
    name, separator, value = spec.partition("=")
    if not separator or not name:
        raise UsageError(f"-F/--form expects name=value, got '{spec}'")

    trailers = {
        key.lower(): item.strip().strip('"')
        for key, item in _TRAILER_RE.findall(value)
    }
    payload = _TRAILER_RE.sub("", value)

    filename = trailers.get("filename")
    content_type = trailers.get("type")

    if payload.startswith("@"):
        path = payload[1:]
        if filename is None and path != "-":
            filename = Path(path).name
        content = source.read_file(path, "-F/--form")
        if content_type is None:
            content_type = mimetypes.guess_type(filename or "")[0]
        return name, (filename or "upload", content, content_type or "application/octet-stream")

    if payload.startswith("<"):
        # Read the file but send it as a plain field value, newlines included.
        content = source.read_file(payload[1:], "-F/--form")
        if filename:
            return name, (filename, content, content_type or "application/octet-stream")
        return name, (None, content)

    return name, (None, payload)


def iter_multipart_files(files: Iterable[tuple[str, Any]]) -> list[str]:
    """Field names of a multipart body - handy for verbose logging."""
    return [name for name, _ in files]