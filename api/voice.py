"""ElevenLabs text-to-speech with an on-disk MP3 cache.

Cache key = sha1(voice_id + model + text) -> audio_cache/<key>.mp3, so a phrase is only paid for once.
Never logs the API key.
"""
import asyncio
import hashlib
import logging
import os
from pathlib import Path

import httpx

log = logging.getLogger("blinktalk.voice")

TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
DEFAULT_MODEL = "eleven_flash_v2_5"  # lowest-latency ElevenLabs model
CACHE_DIR = Path(__file__).resolve().parent / "audio_cache"
TIMEOUT_S = 4.5  # contract: /speak answers within 5 s

_client: httpx.AsyncClient | None = None


class VoiceError(Exception):
    """ElevenLabs is unavailable or misconfigured; the route turns this into a fast 503."""


def _config() -> tuple[str, str, str]:
    key = os.getenv("ELEVEN_API_KEY", "").strip()
    voice_id = os.getenv("ELEVEN_VOICE_ID", "").strip()
    model = os.getenv("ELEVEN_MODEL", "").strip() or DEFAULT_MODEL
    return key, voice_id, model


def cache_path(text: str) -> Path:
    _, voice_id, model = _config()
    key = hashlib.sha1(f"{voice_id}{model}{text}".encode()).hexdigest()
    return CACHE_DIR / f"{key}.mp3"


def is_cached(text: str) -> bool:
    return cache_path(text.strip()).exists()


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=TIMEOUT_S)
    return _client


async def aclose() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def speak(text: str) -> bytes:
    """MP3 bytes for `text`, from cache if possible. Raises VoiceError on any failure."""
    text = text.strip()
    path = cache_path(text)
    if path.exists():
        return path.read_bytes()

    key, voice_id, model = _config()
    if not key or not voice_id:
        raise VoiceError("ELEVEN_API_KEY or ELEVEN_VOICE_ID not set")

    try:
        r = await asyncio.wait_for(
            _http().post(
                TTS_URL.format(voice_id=voice_id),
                headers={"xi-api-key": key, "accept": "audio/mpeg"},
                json={"text": text, "model_id": model},
            ),
            timeout=TIMEOUT_S,
        )
    except (httpx.HTTPError, asyncio.TimeoutError) as e:
        raise VoiceError(f"ElevenLabs request failed: {type(e).__name__}") from e

    if r.status_code != 200:
        raise VoiceError(f"ElevenLabs {r.status_code}: {r.text[:200]}")

    CACHE_DIR.mkdir(exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(r.content)
    tmp.replace(path)  # atomic: a half-written file is never served
    return r.content


async def warm_cache(phrases: list[str]) -> None:
    """Pre-generate audio for common phrases in the background. Never raises."""
    key, voice_id, _ = _config()
    if not key or not voice_id:
        log.warning("warm_cache skipped: ElevenLabs not configured")
        return
    made = 0
    for p in phrases:
        if is_cached(p):
            continue
        try:
            await speak(p)
            made += 1
        except VoiceError as e:
            log.warning("warm_cache stopped after %d new phrases: %s", made, e)
            return
    log.info("warm_cache done: %d new, %d total phrases cached", made, len(phrases))
