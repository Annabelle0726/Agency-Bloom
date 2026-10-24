"""Bounded deterministic selection. Age never expires a confirmed record."""

import re

from .psychology import casual

DOMAINS = (
    (
        "工作",
        "职业",
        "转行",
        "收入",
        "求职",
        "方向",
        "公司",
        "岗位",
        "每周",
        "小时",
        "投入",
        "尝试",
        "选择",
        "稳定",
        "成长",
        "搬家",
        "异地",
        "时间",
        "地点",
        "未来做什么",
    ),
    ("沟通", "同事", "关系", "表达需要", "家人", "家庭", "伴侣", "朋友", "父母", "边界", "照护"),
    ("精力", "休息", "作息", "负担", "分担", "生活节奏", "被打断"),
    ("学习", "备考", "考试", "学业", "课程"),
    ("价值", "在意", "感受", "害怕"),
)


def relevant(content, message):
    if casual(message):
        return False
    if any(
        any(w in message for w in group) and any(w in content for w in group) for group in DOMAINS
    ):
        return True
    tokens = re.findall(r"[a-zA-Z]{3,}|[\u4e00-\u9fff]{2,}", content.lower())
    return any(token in message.lower() for token in tokens)


def snapshot_for(issue):
    if (issue.exploration or {}).get("snapshot_deleted"):
        return None
    return {
        "id": "snapshot:" + issue.id,
        "version": issue.version,
        "direction": (issue.exploration or {}).get("question")
        or (issue.exploration or {}).get(
            "initial_title", issue.title if issue.version == 1 else ""
        ),
        "constraints": (issue.exploration or {}).get(
            "initial_constraints", issue.card.get("constraints", []) if issue.version == 1 else []
        ),
        "source": "onboarding",
        "captured_at": issue.created_at,
        "stage": issue.stage,
        "background": issue.background,
        "life_contexts": issue.life_contexts,
        "concerns": issue.concerns,
        "answers": issue.exploration or {},
    }


def ground_change(output, messages):
    """Model proposes a possible conflict; only source-anchored current words survive.

    This is deliberately not a semantic diagnosis. The UI asks the user whether
    the two statements really conflict before offering a separately saved edit.
    """
    import json

    change = output.phase_change
    if not change:
        return output
    context = json.loads(messages[1]["content"].split("：", 1)[1])
    message = messages[-1]["content"]
    sources = [
        *context.get("current_phase", []),
        *[
            m
            for m in context.get("confirmed_memories", [])
            if m["category"] in ("preference", "constraint")
        ],
        *context.get("memories_to_verify", []),
    ]
    snapshot = context.get("initial_snapshot")
    if snapshot and snapshot.get("direction"):
        sources.append(
            {"id": snapshot["id"], "version": snapshot["version"], "content": snapshot["direction"]}
        )
    source = next((s for s in sources if s["id"] == change.source_id), None)
    explicit = any(
        word in change.evidence
        for word in ("现在更想", "现在想", "不再想", "我决定", "目标改为", "更想探索")
    )
    valid = (
        source
        and explicit
        and not any(
            word in message for word in ("如果", "假如", "假设", "还没决定", "不是说", "没有决定")
        )
        and not casual(message)
        and change.evidence in message
        and change.evidence != source["content"]
        and change.source_id not in context.get("dismissed_changes", [])
        and not context.get("summary_scope")
    )
    if not valid:
        return output.model_copy(update={"phase_change": None})
    return output.model_copy(
        update={
            "phase_change": change.model_copy(
                update={
                    "source_kind": "snapshot"
                    if change.source_id.startswith("snapshot:")
                    else "memory",
                    "source_version": source["version"],
                    "previous": source["content"],
                }
            )
        }
    )
