"""Reviewed adaptive-v1 policy. No I/O, classifier calls, or personality inference.

Route from the current request and bounded same-conversation user turns only.
This estimates the work requested, not the importance of a person's feelings.
"""

import re

from .psychology import explicit_crisis

QUICK = re.compile(
    r"不用(?:深入|详细|深度)|不要(?:深入|详细|深度)|简单(?:说|讲|回答)|简短(?:说|回答)|"
    r"快速回答|只想(?:聊|倾诉)|随便聊|不想(?:分析|规划)|先听我说|"
    r"just (?:chat|a quick)|brief(?:ly)?", re.I,
)
DEEP = re.compile(
    r"深度思考|深入(?:分析|比较|思考)|详细分析|认真分析|系统分析|帮我分析|分析一下|"
    r"比较|对比|权衡|取舍|怎么选|如何选|应该.*选|是否.*(?:辞职|转行|跳槽)|"
    r"(?:该|要不要|能不能|是否|应不应该).*辞职|"
    r"(?:规划|制定|设计).*(?:路线|计划|实验|尝试)|推导|证明|排查|"
    r"\b(?:compare|trade[ -]?offs?|weigh|decide|resign|debug|prove)\b", re.I,
)
FOLLOWUP = re.compile(r"(?:继续|接着说|展开说说|详细说说|为什么|那怎么办|还有呢|continue|why)[。！？!?\s]*", re.I)
TOPIC_CHANGE = re.compile(r"换个话题|先不聊|不谈这个|聊点别的|change (?:the )?(?:subject|topic)", re.I)


def needs_depth(message, history=()):
    if explicit_crisis(message):
        return True
    if QUICK.search(message):
        return False
    if DEEP.search(message):
        return True
    if FOLLOWUP.fullmatch(message.strip()):
        # Reference-only followups inherit the last substantive user request;
        # never route from an assistant suggestion or old profile/card content.
        for turn in reversed(list(history)[-8:]):
            if turn['role'] != 'user':
                continue
            prior = turn['content']
            if TOPIC_CHANGE.search(prior) or QUICK.search(prior):
                return False
            if FOLLOWUP.fullmatch(prior.strip()):
                continue
            return explicit_crisis(prior) or bool(DEEP.search(prior))
    return False
