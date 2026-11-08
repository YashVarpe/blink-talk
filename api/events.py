# api/events.py — live event stream (SSE) for the caregiver view.  Owner: Om
#
# AT's routes call publish("message" | "alert" | "status", data).
# Every open GET /api/events connection gets its own queue; publish() drops the event into all of them.
# Runs with ONE uvicorn worker on purpose: subscribers live in this process's memory.
import asyncio
import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

log = logging.getLogger("blinktalk.events")
router = APIRouter()

_subscribers: set[asyncio.Queue] = set()
PING_EVERY_S = 15


def publish(event: str, data: dict) -> None:
    """Send one event to every connected caregiver. Never blocks the caller."""
    msg = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    for q in list(_subscribers):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass  # a stuck client must not slow down the patient's screen


@router.get("/api/events")
async def events(request: Request):
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)
    log.info("SSE subscriber connected (%d open)", len(_subscribers))

    async def stream():
        try:
            yield ": connected\n\n"
            while not await request.is_disconnected():
                try:
                    yield await asyncio.wait_for(q.get(), timeout=PING_EVERY_S)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # keeps phones and proxies from closing an idle connection
        finally:
            _subscribers.discard(q)
            log.info("SSE subscriber left (%d open)", len(_subscribers))

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
