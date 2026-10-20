"""curlike - a curl-like HTTP client for the command line."""

from __future__ import annotations

from .version import BANNER, NAME, USER_AGENT, VERSION

__version__ = VERSION
__all__ = ["BANNER", "NAME", "USER_AGENT", "VERSION", "__version__"]