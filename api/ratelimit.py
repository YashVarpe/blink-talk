"""Tiny in-memory sliding-window rate limiter, per client IP.

Protects Gemini / ElevenLabs credits. One uvicorn worker = one process, so in-memory is enough.
Over the limit -> HTTP 429 with a Retry-After header (the frontend treats 429 like 503: use browser speech
/ default tiles).
"""
import time
from collections import deque

from fastapi import HTTPException, Request

LOOPBACK = ("127.0.0.1", "::1")


def client_ip(request: Request) -> str:
    """Real client IP. In production Caddy connects from localhost and sets X-Forwarded-For
    (overwriting anything the caller sent); uvicorn only listens on 127.0.0.1, so only Caddy can reach it."""
    host = request.client.host if request.client else "unknown"
    if host in LOOPBACK:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return host


class RateLimiter:
    def __init__(self, name: str, limit: int, window_s: float = 60.0):
        self.name, self.limit, self.window_s = name, limit, window_s
        self._hits: dict[str, deque[float]] = {}
        self._calls = 0

    async def check(self, request: Request) -> None:
        """Record one request; raise 429 if this client is over the limit."""
        now = time.monotonic()
        ip = client_ip(request)
        q = self._hits.setdefault(ip, deque())
        while q and now - q[0] >= self.window_s:
            q.popleft()
        if len(q) >= self.limit:
            retry = max(1, int(self.window_s - (now - q[0])) + 1)
            raise HTTPException(
                status_code=429,
                detail=f"{self.name}: max {self.limit} per {int(self.window_s)}s",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)
        self._calls += 1
        if self._calls % 256 == 0:  # drop idle clients so memory stays bounded
            for k in [k for k, v in self._hits.items() if not v or now - v[-1] >= self.window_s]:
                del self._hits[k]
