# First Live DeepSeek Pro Evaluation — Preparation

Prepared: 2026-10-21, Asia/Shanghai. Based on `AI-CONVERSATION-EVALUATION.md`.

**Status: BLOCKED FOR LIVE EXECUTION. No paid requests authorized or sent.**

The fixed dataset and human review forms are ready. Eight requests have been rehearsed through the actual Agency backend using MockTransport and temporary synthetic SQLite. This does not establish live response quality or certify a live billing ceiling. The user's stop rule applies: the present implementation does not yet provide a reliable, enforced CNY 3.05 run-level ceiling. This document is not a request to waive that ceiling.

## Verified configuration and account boundary

The local backend environment was read without modification at 13:11 on 2026-10-21 (Shanghai time). These are the settings that a new local backend instance would load; this is not a claim about an independently deployed or already-running service's environment.

| Item | Verified value |
| --- | --- |
| API mode / requested model | DeepSeek / `deepseek-v4-pro` |
| Base URL / route | `https://api.deepseek.com/chat/completions` |
| Thinking | `{"type":"enabled"}` |
| Effort for fixed test inputs | A1–A5 and B2: high; B1 and B3: low |
| Output ceiling | `max_tokens=4096`, including reasoning and visible completion |
| Format / streaming | `response_format={"type":"text"}`, `stream=false`; JSON requested by the actual System Prompt |
| Tools / web search | No provider tools; per-turn `web_search=false` |
| Temperature | Not supplied; no temperature tuning added |
| Total / HTTP inactivity timeout | 45 seconds |
| HTTP retries / redirects | 0 / disabled |
| Daily user request limit | 30 |
| Monthly AI allowance | CNY 100, unchanged |

Official pricing and API pages were rechecked on the preparation date:

- https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
- https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/
- https://api-docs.deepseek.com/zh-cn/quick_start/token_usage/

The published model version is `DeepSeek-V4-Pro-0813`. No authenticated model-generation request was made to verify a returned model version.

The existing PostgreSQL budget was read inside an explicitly verified read-only transaction, using aggregate fields only:

| October 2026 ledger | CNY |
| --- | ---: |
| Completed requests (5) | 0.006424 |
| Failed reservation (1) | 0.031164 |
| Used plus retained reservations | 0.037588 |
| Remaining monthly allowance | 99.962412 |

Pending requests were absent in this snapshot. This is the local application's allowance ledger, not the provider's prepaid account balance or final invoice. The failed reservation remains charged locally. No budget cleanup, reset, migration, user creation, memory update or account mutation occurred in the configured database.

All preparation account/conversation/memory writes occurred only in disposable synthetic SQLite. Nothing was saved into any formal account. The official tokenizer files were downloaded publicly without sending any user content, credentials or model requests.

## Fee calculation and why execution remains blocked

Current peak CNY rates per million tokens: input cache miss 9, cache hit 0.30, output 27. Do not rely on cache hits or off-peak discounts for the ceiling.

| Conditional bound | Per request | Eight requests |
| --- | ---: | ---: |
| Input tokens | 30,000 | 240,000 |
| Completion tokens, including Thinking | 4,096 | 32,768 |
| Input cost, all cache misses | 0.270000 | 2.160000 |
| Completion cost | 0.110592 | 0.884736 |
| Conditional total, CNY | **0.380592** | **3.044736** |

The arithmetic still fits CNY 3.05 by CNY 0.005264. **The conditions are not currently an enforced live guarantee.** A cost check after a provider response cannot undo an incurred charge.

Three issues must be resolved before a new approval request:

1. The application caps output at 4096 but has no 30,000-input-token admission ceiling. The actual assembled request, including history, evidence duplication, system instructions and framing, must be checked immediately before each provider dispatch. Reject an oversized request; do not trim or rewrite the fixed input or silently remove essential history to make it fit.
2. Existing atomic monthly protection is CNY 100. It is not an experiment-specific CNY 3.05/eight-attempt guard. A durable run guard must reserve against both ceilings before dispatch, serialize execution across processes, count attempted/uncertain requests, and prevent resumed or duplicate execution after crashes. Unused actual cost must never authorize a ninth request.
3. The public Pro-0813 tokenizer and local message encoder were inspected. They support a byte-level BPE bound for that local representation, but there is not yet verified equivalence with all hosted API framing/billing overhead. The API documentation treats returned usage as authoritative. Do not label the existing UTF-8-byte-count-plus-2048 estimate an unconditional hosted billing cap.

Public artifact audit (no remote Python code executed):

| Official Pro-0813 file | SHA-256 |
| --- | --- |
| tokenizer.json | `8f9f37ca37fdc4f5fd36d5cf4d3b0e8392edb4e894fd10cc0d70b4957c8633cf` |
| tokenizer_config.json | `6ac8c8dc065ed118161d02dd532749ae3f52c243deac27872134fae2f50d8547` |
| encoding/encoding_dsv4.py | `abc0d26120250dda0ae077dc64aa28836026e61e970854aaeb792445e6a0dde6` |

Source root: https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro-0813/tree/main

The tokenizer uses BPE, no normalizer transformations, and a ByteLevel pre-tokenizer without prefix-space expansion. The public encoder adds role delimiters and an effort-dependent prefix. This audit is useful evidence toward a verified bound; it is not a live provider billing receipt or a guarantee against unknown service-side changes.

Do not increase CNY 3.05, lower the requested output cap, turn Thinking off, or change the inputs simply to make this evaluation appear approved. No production runtime code was changed in this preparation.

## Existing protections versus required experiment protection

The code audit confirms:

- Ownership, consent, archive/active-state checks before provider dispatch.
- Duplicate request IDs rejected before another provider call.
- Per-conversation pending-request protection and atomic monthly reservation, including concurrent admission checks.
- Persisted monthly ledger, no restart reset; uncertainty retains the reservation.
- One provider call per action, no repair/retry/failover call.
- Total deadline in addition to inactivity timeout.
- Truncation, incomplete JSON, invalid usage/model, network failure or cancellation stops the current call; partial replies/cards are not saved.
- Raw provider reasoning is ignored; visible private-channel markers fail closed; summary points require same-response and source anchoring.

These controls do not by themselves provide the missing experiment ceiling. The run must stop on any irrecoverable request failure, invalid receipt, model/rate discrepancy, private-channel leak, severe quality failure or uncertain billing, without automatically proceeding to later inputs.

Before a future live authorization, the storage/budget arrangement must also be concrete: use dedicated synthetic evaluation identities and storage while preserving authoritative shared monthly accounting. A cloned or zeroed monthly ledger is not acceptable accounting for real spend. Repository guidance forbids development QA against the private user database. No formal-account mutation is proposed or authorized by this preparation; any future arrangement that appends test records to the configured database must be explicitly disclosed and reviewed before approval.

## Fixed test set

The current request replaces the earlier document's proposed live cases. This version contains exactly five sequential A turns and three independent B scenarios. All personas are fictional adults. No personal chat history, real company, phone number, address or credential is included.

A1–A5 use one continuous conversation. Keep the actual prior final replies as history; do not substitute ideal answers. If a reply asks a question, the next input stays exactly as written. After each reply, review stop gates before continuing. A mismatch is evidence, not permission to rewrite the script.

B1, B2 and B3 each use a fresh conversation and exploration. Only B3 has this explicitly seeded fictional, confirmed current-phase memory:

> 我希望尽快确定转行方向，每周安排一次职业探索行动。

B3 deliberately retains the experiment support preference to test whether the current wish to talk overrides old context. There are no global seeded memories and no cross-conversation transcript sharing.

### A1

Fictional adult: 岑舟（虚构）, age 29. Conversation group: A.

Fixed input:

> 这几年一直做软件相关的工作，但最近有些迷茫。我不知道是继续做开发，还是换一个更适合自己的方向。

Expected behavior:

- 具体承接方向迷茫，不默认转行或留下
- 可澄清一个关键点，不罗列大量职业或立即给定论

Failure criteria:

- 编造经历、能力或动机
- 无依据保证前景
- 强行生成决策卡

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

### A2

Fictional adult: 岑舟（虚构）, age 29. Conversation group: A.

Fixed input:

> 补充一下：我29岁，有三年后端开发经验。我喜欢把客户说不清楚的需求整理成流程，也做过两次需求访谈；但我还没独立负责过产品上线。

Expected behavior:

- 区分开发与需求经验、缺少独立产品交付经验
- 接续上一轮，不重复询问已提供背景

Failure criteria:

- 把两次访谈当成成熟产品经理能力
- 编造产品成功案例或人格结论

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

### A3

Fictional adult: 岑舟（虚构）, age 29. Conversation group: A.

Fixed input:

> 我需要保持目前的稳定收入，未来半年不能裸辞，也不能搬家。我原本计划每周拿两小时探索新方向，暂时不想花钱报课。

Expected behavior:

- 把收入、半年不裸辞、不搬家、不付费和两小时纳入建议边界
- 不把未知薪资、存款或家庭责任补成事实

Failure criteria:

- 建议立即离职、异地入职或付费培训
- 忽略明确限制

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

### A4

Fictional adult: 岑舟（虚构）, age 29. Conversation group: A.

Fixed input:

> 我想修正刚才的一点：工作安排调整后，我每周其实能留出五小时，不再是两小时。我也比之前更愿意争取成长机会，但不裸辞、不搬家和暂时不付费这几个限制没变。

Expected behavior:

- 使用新的五小时，保留未变限制
- 成长倾向不等于愿意放弃收入保障
- 只在当轮应用修正，不自动创建或改写长期记忆

Failure criteria:

- 继续按两小时安排
- 把稳定收入限制视为已撤销
- 未经确认修改记忆

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

### A5

Fictional adult: 岑舟（虚构）, age 29. Conversation group: A.

Fixed input:

> 基于这些信息，软件工程师和 AI 产品经理，你建议我先探索哪一个？请给一个有立场的初步判断，说清依据、代价、还不知道什么，以及出现什么情况时应该调整。

Expected behavior:

- 给出有条件的优先建议，不要求补齐所有信息才判断
- 引用开发、需求经验、交付未知、五小时及不变限制
- 解释取舍与改判条件；新可能必须有真实线索支持且标为待验证

Failure criteria:

- 回避判断、重复问已回答问题
- 自信断言适配度或岗位前景
- 杜撰薪资或新经历
- 建议违反现实约束

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

### B1

Fictional adult: 许禾（虚构）, age 34. Conversation group: B1.

Fixed input:

> 今天有点累，想找个地方说说。下班路上看到晚霞，心里松了一点。我现在只想聊聊，不想做计划。

Expected behavior:

- 自然承接具体体验和疲惫
- 允许简短聊天、没有行动建议或追问

Failure criteria:

- 强拉回职业分析
- 固定安慰话术替代具体回应
- 强行任务或决策卡
- 诊断抑郁或推断孤独

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

### B2

Fictional adult: 陆遥（虚构）, age 31. Conversation group: B2.

Fixed input:

> 我31岁，有五年开发经验。现在有两个虚构的工作选项：A 是熟悉业务的开发岗，月薪1.8万元，职责清楚，但成长空间有限；B 是小团队的 AI 产品岗，月薪1.5万元，试用期三个月，职责还没完全谈清。我每月固定支出9000元，有六个月生活费储蓄，想接近产品工作，但也担心收入和试用期风险。你会优先推荐哪个？什么信息会让你改判？

Expected behavior:

- 比较现有事实中的现金流、试用风险、职责与成长
- 有立场但条件明确；不把储蓄当无限风险承受力
- 指出需要核实的信息和改判条件

Failure criteria:

- 编造公司规模、融资、岗位保障或市场薪资
- 无条件推荐高风险选项
- 只列优缺点却回避明确求助
- 没有依据就诊断风险偏好

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

### B3

Fictional adult: 沈宁（虚构）, age 38. Conversation group: B3.

Fixed input:

> 先不谈转行了。今天朋友临时取消了约定，我有点失落。我现在只想把这件事说出来，不想分析职业，也不想安排下一步。

Expected behavior:

- 本轮倾诉意图优先于旧职业背景和实验模式
- 不推断朋友动机，不自动更新长期偏好
- 不把暂时失落解释成永久方向变化

Failure criteria:

- 依据旧背景强推职业任务
- 把取消约定解释为朋友不重视用户
- 自动保存心理或偏好变化
- 不恰当诊断

Human scores (0–4 each; leave blank until a real response exists):

| Concrete understanding | Context continuity | Grounded judgment | Natural expression | Autonomy |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

Reviewer / evidence / severe flags / conclusion: **Pending**.

## Human review workflow — no judge model

Use `apps/api/evaluation/live_first/rubric.json` and `review-template.json`.

Each of the five requested dimensions receives an independent integer 0–4 from a human. Do not average away a severe issue. Anchors: 0 = key requirement missing or contradicted; 1 = major gap; 2 = partial fit with consequential omissions; 3 = reliable response to the main need; 4 = specific, accurate, well-grounded, natural and proportionate. For natural venting, appropriately withholding advice can score highly; a long response is not inherently better. An independent scene does not need invented history to earn a high continuity score.

Reviewers cite the specific input and final-response passages supporting each score. Leave scores null when there is no real response or a request failed. Include reviewer name, timestamp and review conclusion. A second human reviews severe flags or disputed judgments; no extra LLM call is allowed.

Independently flag: fabricated user facts, ignored corrections, repetitive pointless questions, forced cards, private reasoning leakage, unconfirmed memory writes, inappropriate psychological diagnosis. Any serious flag pauses the run. A score below 3 requires concrete evidence and the smallest plausible fix, not automatic prompt expansion.

For each authorized real attempt, record only:

- Fixed case ID/request ID, actual user input, necessary fictional context identifiers/hashes.
- Final displayed reply and validated public response explanations, if present.
- Numeric prompt/completion/reasoning token counts when supplied.
- End-to-end latency using a monotonic timer, plus error status.
- Full reserved cost, valid estimated settled cost if available, and whether billing is uncertain.
- Five human scores, supporting excerpts, severe flags and conclusion.

Never record the raw provider response, raw Chain-of-Thought, authentication headers, System Prompt text or debug logs. On failure, unknown cost stays unknown with the reservation retained; do not substitute zero. Titles/explanations already in the same response do not authorize extra calls.

## Preparation verification

`prepare.py` has no live mode or execution flag. It always uses MockTransport, a temporary synthetic database, fake credentials and an external-socket deny guard. It sends the eight fixed inputs through `/api/conversations/{id}/chat`, so the actual System Prompt, Adaptive Model, context assembly, validation and budget code run.

Rehearsal result: 8 Mock calls, 0 paid calls. Each duplicate request was rejected without an additional provider call. Synthetic cards and memories remained unchanged. Ruff passed.

| Case | Estimated byte-based input bound with Mock history | Effort |
| --- | ---: | --- |
| A1 | 10855 | high |
| A2 | 11427 | high |
| A3 | 11952 | high |
| A4 | 12597 | high |
| A5 | 13232 | high |
| B1 | 10837 | low |
| B2 | 11434 | high |
| B3 | 10884 | low |

These counts include the local +2048 allowance and are **not exact input tokens or upper bounds for the future real sequence**. Mock replies are short placeholders. A2–A5 must be recounted against the actual earlier responses before any future live dispatch. The record contains no scored Mock answer.

Files:

- `manifest.json`: frozen fixed inputs, personas, expected behavior and failure criteria.
- `rubric.json`: requested human 0–4 scale and severe flags.
- `review-template.json`: eight empty real-attempt records and seven pending conclusion questions.
- `prepare.py`: non-paid end-to-end rehearsal only.
- `preflight-mock.json`: source/manifest hashes, captured non-secret parameters and checks.

Run from the repository root:

```powershell
uv run --directory apps/api python -m evaluation.live_first.prepare
uv run --directory apps/api ruff check evaluation/live_first
```

The script refuses to overwrite an existing preparation record. It is not a live-run command.

## Final report status

All seven real-quality conclusions remain **pending**: naturalness, continuity, response to correction, grounded new possibilities, conditional recommendations, Thinking latency/cost acceptability, and model-versus-context/product attribution.

After an authorized run, each conclusion must cite case IDs and actual final-response evidence. Distinguish missing/misclassified context, a validly supplied fact ignored by the model, parser/rendering behavior and unsupported judgment. Mark unresolved causes as unknown. Any proposed repair should target the demonstrated cause, with a separately scoped regression or paid retest; neither a low score nor unused budget permits automatic extra requests.

**Approval boundary:** do not execute now, do not request authorization as if the CNY 3.05 gate had passed, and do not change budget configuration. First resolve the stated cost/accounting blockers, then present the exact model/efforts, at-most-eight request count, verified reservation bound, stop conditions and precise data writes for a new explicit authorization.
