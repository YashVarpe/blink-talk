"""Default phrases used when Gemini fails, times out, or returns fewer than 6 phrases."""
import re
from datetime import datetime

from models import Profile

N = 6

# Always-useful needs. The first four go on every fallback board.
GENERAL = ["Yes", "No", "I'm in pain", "I need the nurse", "Thank you", "Spell something"]

BY_TIME = {
    "morning": ["Good morning", "I'd like breakfast", "I slept well", "I didn't sleep well"],
    "afternoon": ["I'd like some water", "I'm hungry", "Please adjust my pillow", "I'm tired"],
    "evening": ["Good evening", "I'd like dinner", "Please turn on the TV", "How was your day?"],
    "night": ["I can't sleep", "Please turn off the light", "I'm cold", "Good night"],
}


def _hour(local_time: str | None) -> int:
    """Hour 0-23 from an ISO timestamp or any 'HH:MM' string; server time if unparseable."""
    if local_time:
        try:
            return datetime.fromisoformat(local_time.replace("Z", "+00:00")).hour
        except ValueError:
            m = re.search(r"\b(\d{1,2}):\d{2}", local_time)
            if m and int(m.group(1)) < 24:
                return int(m.group(1))
    return datetime.now().hour


def period(local_time: str | None) -> str:
    h = _hour(local_time)
    if 5 <= h < 12:
        return "morning"
    if 12 <= h < 17:
        return "afternoon"
    if 17 <= h < 22:
        return "evening"
    return "night"


def _dedupe(items: list[str]) -> list[str]:
    seen, out = set(), []
    for s in items:
        s = s.strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


def phrases(local_time: str | None, profile: Profile | None = None) -> list[str]:
    """Exactly 6 phrases: 2 for the time of day + 4 general needs."""
    return pad(BY_TIME[period(local_time)][:2], local_time, profile)


def pad(given: list[str], local_time: str | None, profile: Profile | None = None) -> list[str]:
    """Keep `given` first, then fill to exactly 6 from general needs, time-of-day and profile phrases."""
    pool = (
        given
        + GENERAL[:4]
        + BY_TIME[period(local_time)]
        + (profile.common_phrases if profile else [])
        + GENERAL[4:]
    )
    return _dedupe(pool)[:N]


def all_phrases(profile: Profile | None = None) -> list[str]:
    """Everything worth pre-generating audio for (used by voice.warm_cache)."""
    pool = (profile.common_phrases if profile else []) + GENERAL
    for p in BY_TIME.values():
        pool += p
    return _dedupe(pool)
