"""Reviewed, replaceable non-clinical strategy cards. No I/O or model calls.

Review scope: autonomy, no diagnosis, one optional question, reversible actions.
Primary references and review rationale: docs/ADAPTIVE_MODEL.md.
"""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class PsychologyStrategy:
    id: str
    guidance: str
    version: str = "0.1"


STRATEGIES = {
    "life-design": PsychologyStrategy(
        "life-design",
        "从真实经历探索职业可能性；若用户愿意，提出低成本、可停止的原型尝试，说明要验证什么，不替用户决定",
    ),
    "motivation": PsychologyStrategy(
        "motivation",
        "尊重改变与不改变的自主选择；反映用户自己说出的考虑，最多问一个开放问题，不劝服、不诊断动机",
    ),
    "values": PsychologyStrategy(
        "values",
        "区分当下感受、用户明确在意的价值与自愿行动；允许休息和暂停，不要求消除感受，不推断价值观",
    ),
    "communication": PsychologyStrategy(
        "communication",
        "帮助区分具体观察、本人表达的感受、需要和可拒绝的请求；不替对方推断意图，不强迫套用四步话术",
    ),
}


def casual(message):
    if any(word in message for word in ("今天", "暂时", "这会儿", "此刻", "一时")) and any(
        word in message for word in ("累", "疲惫", "难过", "低落", "烦")
    ):
        return True
    return any(
        word in message
        for word in (
            "只想聊",
            "随便聊",
            "不想规划",
            "不想分析",
            "只想倾诉",
            "先听我",
            "今天好累",
            "今天工作好累",
            "暂时疲惫",
            "今晚吃",
            "你好",
            "我想你了",
        )
    )


def select_strategy(message, mode="discover"):
    if mode == "listen" or casual(message):
        return None
    rules = (
        ("communication", ("怎么沟通", "表达需要", "如何沟通")),
        ("values", ("价值行动", "在意的价值", "按自己的价值")),
        ("motivation", ("纠结", "改变的原因", "改变动机", "是否转行")),
        ("life-design", ("职业方向", "职业探索", "小尝试", "原型尝试", "未来做什么")),
    )
    for key, words in rules:
        if any(word in message for word in words):
            return asdict(STRATEGIES[key])
    return None
