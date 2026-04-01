"""SlowAPI limiter configuration."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Default burst-friendly limit keeps regular traffic flowing while allowing
# per-route limits to lock down sensitive endpoints.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["300/minute"],
    storage_uri="memory://",
)
