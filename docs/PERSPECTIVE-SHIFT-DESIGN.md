# Perspective Shift v0.1 — Offline Prototype

Date: 2026-10-21, Asia/Shanghai. **Default off. Mock only. No paid requests.**

## Product boundary

“换个角度” offers one tentative, evidence-linked observation about a discussion. It
may point out an incomplete earlier assistant suggestion. It is not another persona,
a therapist, an omniscient observer or an independently verified second opinion.
A useful ordinary reply stands on its own; the optional observation can be null.
No watcher, background agent, timer, new model call or automatic research was added.

The baseline `SYSTEM_PROMPT` and frozen evaluation system hash are unchanged. Only
an explicitly injected `PerspectivePrototype` in an isolated SQLite + MockTransport
application can append the prototype instructions. Startup rejects both real provider
transport and combination with `EvaluationGuard`. The default application does neither.
The client flag is off by default and additionally requires the dedicated local Mock
URL `http://127.0.0.1:8019/api`. No `.env` change is needed or was made.

## Single-response protocol

`AIOutput.perspective_shift` is optional. It has the requested title, observation,
possible blind spot, alternative perspective, supporting message IDs, uncertainty,
and optional next question. Two narrow additions make contracts testable:

- `trigger`: repeated_choice, new_constraint or assistant_revision.
- `evidence`: 2–4 exact message quotes, each naming which core claims it supports.

The same normal provider response supplies reply and candidate. Malformed optional
schema hides the candidate without destroying a usable reply. Raw `reasoning_content`
is ignored. The default route strips unsolicited candidates when the feature is off.

Every citation must be a whole message actually selected into this request from this
conversation, or the pending user message whose server-assigned ID is used when it is
saved. At least two distinct messages are required, including the latest user input;
all three core claims need an evidence association. Assistant revision requires an
assistant citation; an assistant statement is never promoted into a user fact.
Fabricated, foreign-conversation, absent, invalid-quote and memory IDs are rejected.
Confirmed memories, summaries and old questionnaire entries cannot be used as message
citations. Exact anchoring verifies provenance, **not whether a quote logically supports
a claim**. Semantic hallucinations and stale facts remain real-model evaluation risks.

The response also includes an opaque `perspective_token` for presentation feedback.
It is a hash, not a user trait or a saved preference. No model-generated HTML/SVG runs.

## Conservative trigger and suppression policy

The eligible context must contain actual conversational evidence. Repeated-choice
eligibility requires at least three user turns with decision/comparison language.
An explicit correction or new restriction can qualify earlier if there is a previous
assistant response. These lexical gates are intentionally narrow and imperfect; the
model must still return null when no defensible new observation exists.

No candidate is solicited for summaries, edited branches, absent conversations,
chat retention off, listening mode, ordinary greetings, explicit requests not to be
analyzed, simple factual questions or detected crisis language. Crisis evidence in
provided earlier user messages also suppresses the feature. This heuristic is not a
clinical assessment and does not replace the normal safety prompt.

After showing a candidate:
- At least three user turns must pass before another can appear.
- Continuing the same comparison alone never re-enables it.
- A fresh explicit correction/restriction is required for another candidate.
- Previously shown/rejected fingerprints and near-duplicate blind-spot text are hidden.
- The latest user message must be among the new candidate's actual evidence.

Feedback state is keyed by user and conversation. Only tokens issued in that scope are
accepted. “不太适用” suppresses the angle without persuasion or profile inference.
“暂时关闭” hides every such hint for the current session. Controls travel only with
the next user-initiated ordinary request; clicking them does not call a model.
A refusal, silence or hesitation never changes personality, memory, card or strategy.

This prototype uses **in-memory session suppression**, not durable cross-device settings.
It intentionally does not promise that closing survives an app/server restart. Production
rollout would require an explicitly consented preference contract and multi-worker state
before activation. Candidate artifacts are not persisted: ordinary retained messages
keep existing save behavior, while reloaded history does not reconstruct old candidates.

## Mini Program interaction

Vue 3 / uni-app remains unchanged. `PerspectiveShiftEntry.vue` sits under an assistant
reply, separately from “查看回应思路”. It uses the existing themed Compass SVG,
transparent background, default collapsed details, a fine divider, wrapping actions
and at least 44px touch targets. There is no full-screen modal, large colored card,
new font, decorative animation or composer positioning change. Colors use existing
`--ink`, `--muted`, `--line`, and `--accent` variables for all six themes.

Expanded content shows the possible omission, its conversational basis, an optional
alternative and uncertainty. User actions:

1. 沿这个角度聊聊: append an editable draft, preserve existing text, never auto-send.
2. 不太适用: hide this token immediately; submit explicit suppression with the next turn.
3. 暂时关闭: hide these hints for this session; no memory or card update.

The client validates shape, quotes and accessible message IDs again before rendering.
Missing earlier messages cause hiding rather than invented evidence. Busy/read-only
states disable the action buttons. Closing the feature does not hide normal replies
or the existing public response-explanation control.

## Response reasoning remains available

Thinking is still enabled by configuration. “查看回应思路” continues to show only 2–3
validated public explanations from the same reply. It is hidden when the provider omits
the field or grounding fails. Raw provider thinking is not a UI artifact and is not
stored. This version does not change that contract, loosen its validator, add filler
summaries or increase model calls to make the button appear.

## Offline verification and native reproduction

Backend: `tests/test_perspective_shift.py` covers six-turn repetition, new constraints,
assistant self-correction, insufficient information, listening/greeting/crisis/fact
suppression, rejection/cooldown/close, stale memory IDs, malformed schema, nonexistent
and foreign references, internal content, no extra call, and frozen/live exclusion.

Frontend: `tests/perspective-shift.test.ts` covers default-off URL gating, quote/scope
validation, invalid data, draft preservation/no auto-send, rejection/close, busy-state
protection, per-session isolation and unchanged default request controls.

All outputs are authored Mock fixtures. No human quality scores are invented and no
paid judge is used. The native fixture also includes a valid response explanation so
its entry can be checked independently from Perspective Shift.

Native helper (independent tourist project, never the user's current simulator):

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:8019/api'
$env:VITE_PERSPECTIVE_PROTOTYPE='true'
npm run build:mp
node tools/verify-perspective-native.cjs --prepare
# Open output/perspective/native-project using Developer Tools CLI auto port 9439.
uv run --project apps/api python tools/mock-perspective-api.py
node tools/verify-perspective-native.cjs
```

After copying the isolated artifact, rebuild normal output in a fresh shell without
these two environment overrides. The test helper uses temporary fictional SQLite,
`offline.invalid`, fake credentials and MockTransport. It cannot contact DeepSeek.
No production DB migration, account write, budget cleanup or environment-file edit
is part of this workflow.

## Remaining quality risks and next step

A citation can be real yet misinterpreted. Lexical trigger and near-duplicate rules
can miss paraphrases or suppress a useful observation. Same-model self-correction
is not independent review. The system cannot yet certify that a new observation is
novel, helpful, emotionally well-timed or substantively better than the normal reply.

Any later real-model comparison needs separately frozen inputs, evidence-based human
review, distinct feature-on/off request counts and separately approved costs. It must
not consume or change the original eight-request baseline. Low scores should lead to
specific evidence and minimal repairs, not extra compulsory insight templates.

## Changed implementation surface

| Area | Files |
| --- | --- |
| Protocol | `app/perspective_schema.py`, optional fields in `app/schemas.py` |
| Server gates and grounding | `app/perspective_shift.py`, explicit injection in `app/main.py` |
| Client validation and session actions | `src/perspective-shift.ts`, `src/domain.ts`, `src/chat.ts` |
| UI | `PerspectiveShiftEntry.vue`, `ChatMessage.vue`, `ChatView.vue`, `index.vue` |
| Offline tests | `tests/test_perspective_shift.py`, `tests/perspective-shift.test.ts` |
| Isolated native QA | `tools/mock-perspective-api.py`, `tools/verify-perspective-native.cjs` |

No existing cards, memories, accounts, real budgets or user theme assets were changed.
Existing unrelated edits, including work being updated concurrently, were preserved.

## Executed acceptance results

- Full API suite: **222 passed, 1 skipped** (PostgreSQL integration unavailable).
- New backend suites: **34 passed** (18 perspective and 16 guard).
- Ruff and TypeScript checks: passed. Frontend: **103 passed**, including the 8 new
  prototype tests and existing response-explanation regressions. Tooling: 2 passed.
- Both normal/default-off and isolated prototype Mini Program builds passed the uni-app
  build and bundled native checks (14 WXSS, 41 WXML, references and images). Existing
  Sass legacy-API deprecation warnings remain; no compiler errors were reported.
- WeChat Developer Tools, isolated tourist project, automation port 9439, Mock port 8019:
  **light and dark native interactions passed** on iPhone 12/13 (Pro), 390x844 viewport.
  Detail width was 306px; actions remained above the fixed composer after scrolling.
  Screenshots were inspected: entry/details, themed SVG/text, line wrapping and composer
  separation were readable in both themes. No runtime exceptions were recorded.
- Verified native flows: default collapsed entry, expansion, separate “查看回应思路”,
  preparing a draft without sending, rejection hiding (light), session close (dark).
- Native reports: `output/perspective/native-report-light.json` and
  `output/perspective/native-report-dark.json`; screenshots alongside them.
- The initial helper could not locate controls across native component boundaries. Its
  selectors were corrected to use explicit component paths; both final runs passed.
- Other viewport sizes, physical phones, cross-device suppression and PostgreSQL
  multi-worker deployment were not exercised. These are not claimed as passed.
- Normal build output was rebuilt without prototype overrides after copying the isolated
  tourist project. `.env`, frozen manifest/rubric and baseline prompt were preserved.

Real model requests: **0**. This prototype does not establish real blind-spot detection
quality. The original CNY 3.05 live experiment remains **BLOCKED**. No commit or push.
