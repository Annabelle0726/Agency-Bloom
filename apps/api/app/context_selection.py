"""Bounded retrieval of verbatim turns; never inference or persistent memory."""

import re

from .adaptive import relevant

RECENT_MESSAGES = 8
CANDIDATE_MESSAGES = 32
MAX_SELECTED_MESSAGES = 12
LIMIT_CUES = ("不能", "只能", "必须", "需要照顾", "预算", "每周", "限制", "不再", "改为")
SCHEDULE = re.compile(r"时间|每周|每晚|周末|小时|分钟|排班")
SCHEDULE_CHANGE = re.compile(
    r"(时间|排班|安排).{0,8}(不一样|变了|变化|调整|不再|不能沿用)|"
    r"(不再|不能再).{0,8}(两小时|小时|每周|抽出时间)"
)


def select_history(candidates, current):
    """Recent 8 + at most 2 relevant older exchanges from this conversation.

    Prefer explicit limits/corrections, then recency. Selection is a lexical
    retrieval heuristic, not a semantic memory model. All excerpts stay in
    chronological order and are treated as dated user data by the prompt.
    """
    candidates = candidates[-CANDIDATE_MESSAGES:]
    boundary = max(0, len(candidates) - RECENT_MESSAGES)
    indices = set(range(boundary, len(candidates)))
    ranked = [
        (any(cue in row["content"] for cue in LIMIT_CUES), index)
        for index, row in enumerate(candidates[:boundary])
        if row["role"] == "user" and relevant(row["content"], current)
    ]
    for _, index in sorted(ranked, reverse=True)[:2]:
        indices.add(index)
        if index + 1 < boundary and candidates[index + 1]["role"] == "assistant":
            indices.add(index + 1)
    return [candidates[i] for i in sorted(indices)]


def memory_for_turn(memory, current):
    """Invalidate only a clearly changed schedule in the request-local copy.

    This does NOT change the saved status, verification time, or version.
    Other changes remain subject to model understanding + explicit user review.
    """
    if (memory["status"] == "active" and memory["category"] == "constraint"
            and SCHEDULE.search(memory["content"]) and SCHEDULE_CHANGE.search(current)
            and not any(word in current for word in ("如果", "假如", "假设", "没有变", "没变", "没有变化"))):
        return dict(memory, status="needs_review", context_note="本轮时间安排已变化，原限制待核实；保存的记忆未修改")
    return memory
