# Response explanations and model pricing

Updated 2026-10-20.

## User experience

The existing robot thinking animation remains the waiting state. No invented
tool progress is displayed. A small, theme-aware SVG button labelled
`查看回应思路` appears below a reply only when two or three supported explanations
are available. It is collapsed initially and again after history restoration.
The categories are current understanding, response basis, and suggested tradeoffs;
there is no requirement to fill all three.

## Provenance contract

The same provider call may emit optional `reasoning_summary` points containing
a kind, a short text, and source quotes. No second model request is introduced.
For conservative grounding, each displayed explanation must be an exact excerpt
of the delivered reply and cite an exact quote from a server-selected evidence
catalog. The catalog contains only authorized current-conversation user messages,
confirmed facts/constraints, enabled supplied memories, feedback and relevant
initial answers. It excludes system instructions, AI hypotheses, unverified
memories and provider reasoning. Unknown source IDs, invalid structures,
duplicates and internal-operation wording fail closed. Fewer than two valid
points means no button; invalid optional metadata does not reject the main reply.
Demo mode does not invent explanation steps.

This verifies textual provenance, not semantic entailment or the model's actual
private reasoning process. Prompt instructions require faithful explanation;
real-model semantic quality remains a separate evaluation task.

Provider `reasoning_content` is ignored. It is never transformed, returned,
persisted or logged. The old `thinking_steps` payload is filtered from history
responses and is no longer read by the frontend. Existing database rows are
preserved; no destructive cleanup or retroactive model summaries are performed.
New explanations follow the existing chat-retention preference.

## Model rates and configuration

Official source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/

CNY per million tokens, peak rates:

| Model | Input, cache miss | Input, cache hit | Output |
| --- | ---: | ---: | ---: |
| deepseek-flash | 2 | 0.04 | 8 |
| deepseek-v4-pro | 9 | 0.30 | 27 |

Off-peak uses the existing 0.5 multiplier. Reservations use the selected model's
peak rates; settlement uses reported cache usage and provider creation time.
Receipts identify the priced model and rate-card version. Unsupported models,
mismatched returned models and stale manual price overrides fail closed.

The approved total running allocation remains CNY 500/month, including
CNY 100/month for AI. The backend enforces the AI allocation; this is not a
hosting-cost ledger. Existing spend and uncertain reservations are preserved.
Chat now defaults to the local adaptive policy described in
[ADAPTIVE_CHAT.md](ADAPTIVE_CHAT.md). It selects a per-request model and matching
rate card before reservation. `AGENCY_DEEPSEEK_MODEL` still selects the model for
summaries and other explicit generation tasks, and all chat turns when
`AGENCY_AI_ROUTING=fixed`. Do not carry Flash price overrides into Pro.
Restart the API to ensure environment changes are loaded.

## Verification

Backend MockTransport tests cover both models, peak/off-peak prices, reservations,
invalid explanations, no raw-reasoning exposure, retained/non-retained chat and
legacy history filtering. Frontend tests cover bounded anchored explanations and
hidden invalid/legacy data.

Native QA uses `tools/mock-response-reasoning-api.py` on port 8022 and a separate
tourist project on automation port 9442. Build with
`VITE_API_BASE_URL=http://127.0.0.1:8022/api`, run
`node tools/verify-response-reasoning-native.cjs --prepare`, then run that helper
against the isolated project. No private session/database or paid provider
request is used. Physical-device and real-model semantic validation remain open.

Automated acceptance: 59 focused backend tests and 22 frontend tests passed;
TypeScript, targeted Ruff checks and native compilation passed. Native interaction
checks passed at 390 x 844 with collapsed/expanded explanations, missing-summary
hiding, existing robot waiting and retained-history restoration.
