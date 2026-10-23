"""Grounded, extractive response explanations, never private model reasoning."""
import re

from .schemas import AIOutput

INTERNAL = re.compile(
    r"chain.?of.?thought|system.?prompt|reasoning_content|thinking_steps|"
    r"api.?key|tool_calls|工具参数|系统提示|系统指令|思维链|调试日志|"
    r"调用.{0,12}(工具|接口)|检索了|搜索了|执行了|我先.{0,20}然后|"
    r"先分析.{0,20}再|<think|</think|traceback",
    re.IGNORECASE,
)


def evidence_catalog(context, recent, current):
    """Only user-visible, authorized evidence; no system rules or hypotheses."""
    texts = [current]
    texts += [m["content"] for m in recent if m["role"] == "user"]
    card = context.get("confirmed_card") or {}
    texts += card.get("confirmed", []) + card.get("constraints", [])
    for key in ("confirmed_memories", "current_phase"):
        texts += [m.get("content", "") for m in context.get(key, [])]
    texts += [f.get("text", "") for f in context.get("recent_feedback", [])]
    snapshot = context.get("initial_snapshot") or {}
    answers = snapshot.get("answers") or context.get("exploration") or {}
    texts += [answers.get("question", ""), answers.get("response", ""), snapshot.get("background", "")]
    unique = list(dict.fromkeys(t for t in texts if isinstance(t, str) and t.strip()))
    return [{"id": f"s{i + 1}", "text": text[:2000]} for i, text in enumerate(unique[:24])]


def ground_reasoning(result: AIOutput, catalog, *, summary_task=False):
    """Fail closed. Explanations must quote this reply and real supplied sources.

    Exact anchors prove provenance, not semantic correctness. The prompt requires
    faithful explanations; semantic quality still needs model evaluation.
    """
    items = result.reasoning_summary
    if summary_task or not items:
        return result.model_copy(update={"reasoning_summary": None})
    sources = {s["id"]: s["text"] for s in catalog}
    valid = []
    kinds, texts = set(), set()
    for item in items:
        if (item.kind in kinds or item.text in texts or item.text not in result.reply
                or INTERNAL.search(item.text)):
            continue
        if not all(e.source_id in sources and e.quote in sources[e.source_id]
                   and not INTERNAL.search(e.quote) for e in item.evidence):
            continue
        kinds.add(item.kind)
        texts.add(item.text)
        valid.append(item)
    return result.model_copy(update={"reasoning_summary": valid if len(valid) >= 2 else None})


def public_payload(payload):
    """Never return legacy raw reasoning artifacts from stored messages."""
    if not isinstance(payload, dict):
        return None
    clean = {k: v for k, v in payload.items()
            if k not in {"thinking_steps", "reasoning_content", "reasoning", "chain_of_thought"}}
    visual_id = clean.get("visual_id")
    if visual_id is not None and (not isinstance(visual_id, str) or not re.fullmatch(r"[a-z0-9_]{1,80}", visual_id)):
        clean.pop("visual_id", None)
    return clean
