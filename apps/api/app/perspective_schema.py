"""Optional public observations; never private reasoning or an independent verdict."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=240)]
MessageID = Annotated[str, StringConstraints(min_length=1, max_length=80)]
Claim = Literal['observation', 'possible_blind_spot', 'alternative_perspective']


class Evidence(BaseModel):
    model_config = ConfigDict(extra='forbid')
    message_id: MessageID
    quote: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=160)]
    supports: list[Claim] = Field(min_length=1, max_length=3)


class PerspectiveShift(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: Literal['换个角度'] = '换个角度'
    observation: Text
    possible_blind_spot: Text
    alternative_perspective: Text
    supporting_message_ids: list[MessageID] = Field(min_length=2, max_length=4)
    evidence: list[Evidence] = Field(min_length=2, max_length=4)
    uncertainty: Text
    optional_next_question: Text | None = None
    trigger: Literal['repeated_choice', 'new_constraint', 'assistant_revision']


class PerspectiveControl(BaseModel):
    model_config = ConfigDict(extra='forbid')
    disabled: bool = False
    dismissed: list[Annotated[str, StringConstraints(pattern=r'^[a-f0-9]{64}$')]] = Field(
        default=[], max_length=40)
