"""Pydantic models that mirror the shared TypeScript types in CLAUDE.md.

Python fields are snake_case; JSON on the wire is camelCase (e.g. common_phrases <-> "commonPhrases").
Both spellings are accepted on input.
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Role = Literal["user", "caregiver"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    def json_dict(self) -> dict:
        """camelCase dict, ready for json.dumps / SSE publish."""
        return self.model_dump(by_alias=True)


# ---- shared types ----------------------------------------------------------

class Message(Camel):
    id: str
    role: Role
    text: str
    ts: str  # ISO 8601, UTC


class Profile(Camel):
    name: str
    caregivers: list[str] = []
    needs: list[str] = []
    preferences: list[str] = []
    common_phrases: list[str] = []


# ---- request / response bodies ---------------------------------------------

class SuggestRequest(Camel):
    transcript: str | None = None
    history: list[Message] = []
    local_time: str


class SuggestResponse(Camel):
    phrases: list[str]  # always exactly 6
    source: Literal["gemini", "fallback"]


class SpeakRequest(Camel):
    text: str = Field(min_length=1, max_length=500)


class MessageIn(Camel):
    role: Role
    text: str = Field(min_length=1, max_length=2000)


class AlertIn(Camel):
    type: Literal["emergency", "emergency_cancelled"]


class StatusIn(Camel):
    state: Literal["active", "resting", "face_lost"]
