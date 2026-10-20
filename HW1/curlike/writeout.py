"""``-w / --write-out``: curl-compatible format strings."""

from __future__ import annotations

import re
from typing import Any, Mapping

_TOKEN_RE = re.compile(r"%\{(\w+)\}")

_ESCAPES = {
    "n": "\n",
    "r": "\r",
    "t": "\t",
    "\\": "\\",
    '"': '"',
    "v": "\v",
    "0": "\0",
}


def unescape(template: str) -> str:
    """Expand curl's ``\\n`` style escapes."""
    out: list[str] = []
    index = 0
    while index < len(template):
        char = template[index]
        if char == "\\" and index + 1 < len(template):
            nxt = template[index + 1]
            if nxt in _ESCAPES:
                out.append(_ESCAPES[nxt])
                index += 2
                continue
        out.append(char)
        index += 1
    return "".join(out)


def render(template: str, context: Mapping[str, Any], log: Any = None) -> str:
    """Substitute every ``%{token}``. Unknown tokens render empty."""
    text = unescape(template)

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in context:
            if log is not None:
                log.warning(f"unknown write-out variable '%{{{name}}}'")
            return ""
        value = context[name]
        return value if isinstance(value, str) else str(value)

    return _TOKEN_RE.sub(replace, text)


def seconds(value: float) -> str:
    return f"{value:.6f}"


def integer(value: float) -> str:
    return str(int(value))


def token_names() -> list[str]:
    """Everything we support, for ``--help`` and tests."""
    return sorted(
        [
            "content_type",
            "errormsg",
            "exitcode",
            "http_code",
            "http_version",
            "local_ip",
            "local_port",
            "num_connects",
            "num_redirects",
            "remote_ip",
            "remote_port",
            "response_code",
            "scheme",
            "size_download",
            "size_header",
            "size_request",
            "speed_download",
            "ssl_verify_result",
            "time_appconnect",
            "time_connect",
            "time_namelookup",
            "time_pretransfer",
            "time_starttransfer",
            "time_total",
            "url",
            "url_effective",
        ]
    )