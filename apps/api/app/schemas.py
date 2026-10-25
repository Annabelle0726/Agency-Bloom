from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PrivateAttr,
    StringConstraints,
    ValidationError,
    field_validator,
    model_validator,
)

from .perspective_schema import PerspectiveControl, PerspectiveShift

Line = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)]
Lines = Annotated[list[Line], Field(max_length=12)]
SupportStyle = Literal["listen", "discover", "compare", "experiment", "clarify", "act"]
ExplorationIntent = Literal[
    "",
    "job_search",
    "direction",
    "change",
    "choices",
    "start",
    "possibility",
    "other",
    "unsure",
    "relationships",
    "overload",
]
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


class DevLogin(Login):
    resume_token: Annotated[str, StringConstraints(min_length=40, max_length=128)] | None = None


class WechatLogin(Login):
    code: Annotated[str, StringConstraints(min_length=1, max_length=256)]


class Preferences(StrictModel):
    save_chat: bool | None = None
    ai_consent: bool | None = None
    theme: Literal["light", "dark", "dawn", "forest", "lavender", "minimal"] | None = None
    support_style: SupportStyle | None = None
    use_memory: bool | None = None


class Card(StrictModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
    options: Lines = []
    constraints: Lines = []
    confirmed: Lines = []
    hypotheses: Lines = []
    unknowns: Lines = []
    next_step: Annotated[str, StringConstraints(max_length=600)] = ""


class FollowUpAnswer(StrictModel):
    selections: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]] = Field(default=[], max_length=6)
    note: Annotated[str, StringConstraints(max_length=800)] = ""
    refinements: dict[
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)],
        Annotated[list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]], Field(max_length=6)],
    ] | None = Field(default=None, max_length=6)

    @model_validator(mode="after")
    def selected_parents(self):
        if any(parent not in self.selections for parent in (self.refinements or {})):
            raise ValueError("refinements must belong to selected follow-up answers")
        return self


class IssueInput(StrictModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    exploration_intent: ExplorationIntent = ""
    actual_question: Annotated[str, StringConstraints(max_length=400)] = ""
    focus_response: Annotated[str, StringConstraints(max_length=800)] = ""
    follow_ups: dict[ExplorationIntent | Literal["general"], FollowUpAnswer] = Field(default={}, max_length=11)
    concerns: list[
        Literal[
            "job_search",
            "direction",
            "change",
            "relationships",
            "overload",
            "other",
            "unsure",
            "choices",
            "start",
            "possibility",
        ]
    ] = Field(default=[], max_length=8)
    life_contexts: list[LifeContext] = Field(default=[], max_length=11)
    support_style: SupportStyle = "discover"
    stage: Literal["studying", "searching", "working", "transition", "unsure"] = "unsure"
    background: Annotated[str, StringConstraints(max_length=400)] = ""
    constraints: Lines = []

    @model_validator(mode="after")
    def exclusive_uncertainty(self):
        if "unsure" in self.concerns and len(self.concerns) > 1:
            raise ValueError("unsure must be selected on its own")
        if self.exploration_intent and self.exploration_intent not in self.concerns:
            raise ValueError("mainline must be a selected concern")
        for key in self.follow_ups:
            if key not in self.concerns and not (key == "general" and not self.concerns):
                raise ValueError("follow-up answers must belong to a selected concern")
        if self.title in ["我也不知道，帮我一起理清", "我也不知道，帮我一起理清。"]:
            self.title = ""
        return self


class CardUpdate(StrictModel):
    version: int = Field(ge=1)
    card: Card
    suggestion_message_id: UUID | None = None


class FeedbackInput(StrictModel):
    kind: Literal["progress", "stuck", "change"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, StringConstraints(min_length=1, max_length=4000)]


class InsightFeedback(StrictModel):
    possibility: Annotated[str, StringConstraints(min_length=1, max_length=300)]
    reaction: Literal["dismissed"]


class ConversationSummary(StrictModel):
    overview: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1200)] = ""
    decisions: Lines = []
    open_questions: Lines = []
    next_steps: Lines = []


class ChatInput(StrictModel):
    perspective_control: PerspectiveControl | None = None
    request_id: UUID
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    history: list[ChatMessage] = Field(default=[], max_length=8)
    insight_feedback: list[InsightFeedback] = Field(default=[], max_length=3)
    task: Literal["chat", "summary"] = "chat"
    session_summary: ConversationSummary | None = None
    dismissed_changes: list[Annotated[str, StringConstraints(max_length=80)]] = Field(default=[], max_length=40)
    # Per-turn opt-in: web grounding runs only when the user asked for it.
    web_search: bool = False
    visible_visual_ids: list[
        Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,80}$")]
    ] = Field(default=[], max_length=40)


class ConversationChatInput(ChatInput):
    history: list[ChatMessage] = Field(default=[], max_length=80)
    edit_message_id: Annotated[str, StringConstraints(min_length=1, max_length=80)] | None = None
    edit_tail_id: Annotated[str, StringConstraints(min_length=1, max_length=80)] | None = None
    edit_in_memory: bool = False


class ConversationInput(StrictModel):
    issue_id: str
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
    ] = "新会话"
    support_style: SupportStyle = "discover"


class ConversationUpdate(StrictModel):
    version: int = Field(ge=1)
    title: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
        | None
    ) = None
    support_style: SupportStyle | None = None
    archived: bool | None = None
    linked_issue_ids: list[str] | None = Field(default=None, max_length=3)
    dismissed_change_ids: list[Annotated[str, StringConstraints(max_length=80)]] | None = Field(default=None, max_length=40)


class ConversationPinUpdate(StrictModel):
    version: int = Field(ge=1)
    pinned: bool


class SummaryUpdate(StrictModel):
    version: int = Field(ge=1)
    summary: ConversationSummary | None


class MemoryInput(StrictModel):
    content: Line
    category: Literal["fact", "preference", "constraint"] = "fact"
    issue_id: str | None = None
    source_conversation_id: str | None = None
    enabled: bool = True
    horizon: Literal["long_term", "current_phase"] = "long_term"
    status: Literal["active", "needs_review", "historical"] = "active"
    confirmed: Literal[True]


class MemoryUpdate(MemoryInput):
    version: int = Field(ge=1)


class MemoryReplacement(StrictModel):
    version: int = Field(ge=1)
    content: Line
    confirmed: Literal[True]
    keep_history: bool = False
    source_conversation_id: str | None = None


class MemoryReference(StrictModel):
    id: str
    version: int = Field(ge=1)


class MemoryMerge(MemoryInput):
    items: list[MemoryReference] = Field(min_length=2, max_length=10)


class Suggestion(StrictModel):
    options: Lines = []
    hypotheses: Lines = []
    unknowns: Lines = []
    next_step: Annotated[str, StringConstraints(max_length=600)] = ""


class Experiment(StrictModel):
    action: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    tests: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    effort: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    stop_rule: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
    ]


class Insight(StrictModel):
    title: Literal["还有一种可能"] = "还有一种可能"
    observation: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
    ]
    possibility: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
    ]
    uncertainty: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    evidence: Annotated[
        list[
            Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=120)]
        ],
        Field(min_length=2, max_length=4),
    ]
    experiment: Experiment | None = None


class PhaseChange(StrictModel):
    source_id: Annotated[str, StringConstraints(min_length=1, max_length=80)]
    evidence: Line
    source_kind: Literal['memory', 'snapshot'] = 'memory'
    source_version: int = 1
    previous: str = ''


class WebSource(StrictModel):
    """One attributed external page handed to the model or shown to the user."""

    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ''
    url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
    snippet: Annotated[str, StringConstraints(strip_whitespace=True, max_length=400)] = ''
    site: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ''
    published: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10)] = ''


class ReasoningEvidence(StrictModel):
    source_id: Annotated[str, StringConstraints(pattern=r"^s[1-9][0-9]?$")]
    quote: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=160)]


class ReasoningPoint(StrictModel):
    kind: Literal["understanding", "basis", "tradeoff"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=120)]
    evidence: list[ReasoningEvidence] = Field(min_length=1, max_length=2)


class PlanDraft(StrictModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    text: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ''
    next_step: Annotated[str, StringConstraints(strip_whitespace=True, max_length=600)] | None = None

    @field_validator('next_step')
    @classmethod
    def exclude_conversation_prompt(cls, value):
        if value and value.startswith(('你可以先回答', '请先告诉我', '你能告诉我', '可以告诉我', '先回答一句')):
            return None
        return value


class AIOutput(StrictModel):
    plan_draft: PlanDraft | None = None

    @field_validator('plan_draft', mode='before')
    @classmethod
    def optional_plan_draft(cls, value):
        if value is None:
            return None
        try:
            draft = PlanDraft.model_validate(value)
            return draft if draft.text or draft.next_step else None
        except (ValidationError, TypeError, ValueError):
            return None

    perspective_shift: PerspectiveShift | None = None

    @field_validator("perspective_shift", mode="before")
    @classmethod
    def optional_perspective(cls, value):
        if value is None:
            return None
        try:
            return PerspectiveShift.model_validate(value)
        except (ValidationError, TypeError, ValueError):
            return None

    reasoning_summary: list[ReasoningPoint] | None = None

    @field_validator("reasoning_summary", mode="before")
    @classmethod
    def optional_reasoning(cls, value):
        # Optional explanations must never break a usable reply.
        if not isinstance(value, list) or not 2 <= len(value) <= 3:
            return None
        try:
            return [ReasoningPoint.model_validate(item) for item in value]
        except (ValidationError, TypeError, ValueError):
            return None

    reply: Annotated[str, StringConstraints(min_length=1, max_length=4000)]
    suggestion: Suggestion | None = None
    insight: Insight | None = None
    summary: ConversationSummary | None = None
    phase_change: PhaseChange | None = None
    # A short, single-sentence closing line for the composer footer; generated
    # by the same chat call, never an extra model request.
    tail_line: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    # A concise conversation name for the first chat turn. Like tail_line it
    # rides on the existing call, so opening a chat adds no extra model request.
    # Normalize and truncate instead of rejecting: optional naming metadata must
    # never make an otherwise valid chat reply fail schema validation.
    conversation_title: str | None = None
    visual_id: str | None = None
    _visual_selection_invalid: bool = PrivateAttr(default=False)

    @model_validator(mode='after')
    def normalize_optional_text(self):
        if self.tail_line == '':
            self.tail_line = None
        if self.conversation_title is not None:
            cleaned = self.conversation_title
            # Models sometimes wrap names in quotes or end them with a full stop.
            for _ in range(3):
                cleaned = cleaned.strip().strip('“”"\'「」『』')
                cleaned = cleaned.rstrip('。．.!！?？,，、;；：:”"\'」』').strip()
            self.conversation_title = cleaned[:30] or None
        return self
