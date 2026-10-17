from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Line = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)]
Lines = Annotated[list[Line], Field(max_length=12)]
SupportStyle = Literal["listen", "clarify", "compare", "act"]
LifeContext = Literal[
    "studying",
    "searching",
    "working",
    "transition",
    "freelance",
    "business",
    "creating",
    "care",
    "rest",
    "retired",
    "other",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(StrictModel):
    privacy_accepted: Literal[True]


class WechatLogin(Login):
    code: Annotated[str, StringConstraints(min_length=1, max_length=256)]


class Preferences(StrictModel):
    save_chat: bool | None = None
    ai_consent: bool | None = None
    theme: Literal["light", "dark"] | None = None
    support_style: SupportStyle | None = None


class Card(StrictModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    options: Lines = []
    constraints: Lines = []
    confirmed: Lines = []
    hypotheses: Lines = []
    unknowns: Lines = []
    next_step: Annotated[str, StringConstraints(max_length=600)] = ""


class IssueInput(StrictModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    concerns: list[
        Literal[
            "direction",
            "change",
            "relationships",
            "overload",
            "other",
            "unsure",
            "choices",
            "start",
        ]
    ] = Field(default=[], max_length=6)
    life_contexts: list[LifeContext] = Field(default=[], max_length=11)
    support_style: SupportStyle = "clarify"
    stage: Literal["studying", "searching", "working", "transition", "unsure"] = "unsure"
    background: Annotated[str, StringConstraints(max_length=400)] = ""
    constraints: Lines = []

    @model_validator(mode="after")
    def exclusive_uncertainty(self):
        if "unsure" in self.concerns and len(self.concerns) > 1:
            raise ValueError("unsure must be selected on its own")
        return self


class CardUpdate(StrictModel):
    version: int = Field(ge=1)
    card: Card


class FeedbackInput(StrictModel):
    kind: Literal["progress", "stuck", "change"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, StringConstraints(min_length=1, max_length=4000)]


class ChatInput(StrictModel):
    request_id: UUID
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    history: list[ChatMessage] = Field(default=[], max_length=8)


class Suggestion(StrictModel):
    options: Lines = []
    hypotheses: Lines = []
    unknowns: Lines = []
    next_step: Annotated[str, StringConstraints(max_length=600)] = ""


class AIOutput(StrictModel):
    reply: Annotated[str, StringConstraints(min_length=1, max_length=4000)]
    suggestion: Suggestion
