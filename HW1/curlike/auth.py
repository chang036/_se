"""Authentication helpers for ``-u`` / ``--basic`` / ``--digest`` / ``--bearer``."""

from __future__ import annotations

import base64
from typing import Any

import httpx


def parse_user_option(raw: str) -> tuple[str, str]:
    """``-u user:password``; the password may be empty or absent."""
    name, separator, password = raw.partition(":")
    return name, password if separator else ""


def basic_header(username: str, password: str) -> str:
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def build_auth(opts: Any) -> tuple[dict[str, str], httpx.Auth | None]:
    """Return ``(extra_headers, per_request_auth)``.

    Basic and bearer become plain headers so they survive redirect bookkeeping
    easily; digest needs httpx's challenge/response flow, so it is handed to
    ``Client.send`` per hop instead.
    """
    headers: dict[str, str] = {}
    auth: httpx.Auth | None = None

    if opts.bearer:
        headers["Authorization"] = f"Bearer {opts.bearer}"
    elif opts.user:
        username, password = parse_user_option(opts.user)
        if opts.digest:
            auth = httpx.DigestAuth(username, password)
        else:
            headers["Authorization"] = basic_header(username, password)

    return headers, auth