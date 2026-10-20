# Adaptive Personal Model v0.1

## Existing contracts and scope

The implementation extends the existing `memories` store and owned exploration
records. It reuses explicit confirmation, global/exploration scope, optimistic
versions, disable/delete/merge, conversation isolation, revocable memory use,
retention consent, cancellation, and the existing one-call DeepSeek boundary.
No profile database, diagnosis, autonomous research, model training, push
notifications, or additional generation calls are introduced.

## Reviewed strategy cards

`app/psychology.py` contains immutable `PsychologyStrategy` cards, version 0.1.
The review criteria are autonomy, no diagnosis or inferred personality, one
optional question, and affordable reversible actions. These are product wording
reviews, not a claim of clinical validation. Cards are original short summaries:

| Card | Intended trigger | Primary reference | Limits |
| --- | --- | --- | --- |
| life-design | Explicit career exploration or small prototype request | [Designing Your Life: prototyping](https://designingyour.life/insights/how-to-prototype-life-designs/) | No career prescription; user chooses whether to try |
| motivation | Explicit ambivalence about change | [MINT: Understanding MI](https://motivationalinterviewing.org/understanding-motivational-interviewing) | Explore the user's reasons; no persuasion or inferred motive |
| values | Explicit wish to connect chosen values and action | [ACBS: About ACT](https://contextualscience.org/about_act) | Separate feelings, stated values and voluntary action; not therapy |
| communication | Request for help expressing needs | [CNVC: observation, feelings, needs and requests](https://www.cnvc.org/news/lesson-3-of-5-powerful-nvc-micro-lessons-2026-relationship-reset-series) | No inferred motives or mandatory script |

Selection is deterministic, based on the current message, and supplies at most
one card. Listening preference, casual conversation and explicit requests not to
analyze disable selection. No match means no card. This conservative Chinese
rule set can miss paraphrases; absence of a card is safe. Changes to triggers or
guidance require code review, a new card version when guidance changes, and tests.
References are development-time sources; the running model does not browse them.

## Context and data semantics

Priority is present intent, necessary recent conversation, active confirmed phase,
relevant long-term memory, then the initial snapshot. The current message remains
the final user message. Recent conversation and reviewed summaries retain their
existing limits and consent boundaries.

Memory adds `horizon=long_term|current_phase`,
`status=active|needs_review|historical`, `source`, `confirmed_at`, and
`last_verified_at`. Scope remains `issue_id=null` for global, or one owned
exploration. Creation and modification timestamps and optimistic version already
existed. Existing records stay long-term and active; missing historical
verification times remain null rather than being fabricated. Age alone never
expires a record. Historical records are not supplied to the model; records
marked needs_review are explicitly separate from current facts.

At most six relevant enabled records are selected from the user's existing
40-record limit, with phase records first. Relevance uses deterministic topic
groups and literal text, not embeddings or another model. Only explicit short
continuations borrow the last few user turns for selection; topic switches use
the current message. Linked explorations remain ownership-checked and bounded.
Initial card data is suppressed when a relevant confirmed phase supersedes it.
Independently edited decision cards remain a distinct reviewed artifact, below
current intent and confirmed phase in the prompt's priority rules.

Onboarding remains on the exploration row. `/issues/{id}/snapshot` exposes its
source and original `created_at`, answers and background. It is a dated initial
snapshot, not an evergreen profile. Existing users are not re-onboarded. The
snapshot is included only when relevant and there is no relevant active phase.
New snapshots retain the original title and constraints when the card is edited;
legacy originals that cannot be recovered are not invented. A separate review
marker prevents metadata version increments from promoting an initial card to
independently reviewed current facts.
Users can delete it with an owned version check, which also removes the original
background and initial constraint copies from the card. Separately saved cards, memories and historical
chat messages are managed independently and the UI explains this boundary.

`supplied_context` reports the records actually selected, their horizon/status,
the snapshot, primary card, feedback, strategy ID/version, history count, reviewed
summary presence and linked exploration IDs. It does not claim which information
the model actually used. With chat retention enabled this inventory accompanies
the saved reply; with retention off it stays in memory only.

## Confirmation and changes

The same chat response can optionally propose `phase_change={source_id,evidence}`.
The backend accepts only a source that was actually supplied in this request and
literal evidence from the current message containing an explicit change cue.
Casual/emotional turns, unsupported sources, repeated skipped sources and summary
requests cannot produce an actionable candidate. The server supplies the original
content, kind and version; provider-supplied metadata cannot authorize a write.
A candidate remains a possible conflict, not a conclusion that the user changed.

The chat displays one small review entry. The user first confirms whether the
change is real, then edits the proposed text and actively saves. Neither viewing
nor confirming invokes a model or writes memory. Skip immediately suppresses the
source in the current session and explicitly saves only its ID in conversation
metadata (`dismissed_change_ids`) with ownership/version checks. It survives
reopening the same conversation without retaining an unconfirmed change or making
a permanent personality inference. If that metadata save fails, local suppression
still works and the UI reports the limited persistence. Pending candidates are
not restored after a fresh app session. Suppression IDs also reach the prompt.

`POST /memories/{id}/replace` atomically replaces an owned versioned record. The
default deletes the old version; explicit `keep_history=true` retains it as
historical. The new record retains scope, horizon, category and enabled state.
`POST /issues/{id}/phase` creates a confirmed phase from a versioned initial
snapshot; the same explicit history choice keeps or removes that snapshot.
All writes invalidate pending generations and require `confirmed=true`.
Historical versions consume the same memory limit and are individually deletable.
The My area also supports direct creation/editing of phase goals without chat.

## Deployment and verification

Apply `20261019010000_adaptive_memory.sql` before starting the deployed API.
It adds columns only and preserves existing RLS/grants, accounts, content and
budget records. SQLite startup uses the corresponding additive local upgrade.
Development verification must use disposable databases, never the private local
database or a hosted migration. No paid provider test is authorized by this work.

MockTransport tests exercise API saves, isolation, context selection, initial
snapshot deletion, candidate gating, version conflicts and no automatic writes.
Frontend tests exercise candidate confirmation/skip and existing per-conversation
state. Mock checks establish contracts, not live DeepSeek psychological quality.

### Acceptance record — 2026-10-19

- Backend suite: **110 passed, 1 skipped**. The skipped integration test requires
  an explicitly configured disposable local PostgreSQL database; no hosted or
  private database was migrated for verification.
- Frontend suite: **71 passed** across 11 files. TypeScript/Vue type checking passed.
- Backend Ruff checks passed; the existing development-tool suite passed **2 tests**.
- Standard Mini Program build passed, including bundled WeChat compilation of
  **11 WXSS and 12 WXML** files and asset/reference checks. The toolchain emits
  its existing Dart Sass legacy-JS-API deprecation warning.
- Native Developer Tools simulator: **390 × 844**, separate `touristappid`
  project, disposable Mock API at port 8018 and automation port 9438.
  `tools/verify-adaptive-native.cjs` verified candidate display without saving,
  confirmation without saving, editing and explicit save, replacement without
  history, skip without memory changes, suppression after restart, the My direction
  list, and initial-snapshot deletion. A native event-bubbling failure found in
  the first run was fixed by matching the existing drawer's click isolation.
- Screenshots and machine-readable evidence are under `output/adaptive/` (ignored
  local QA artifacts). Paid provider requests: **0**. The standard build was
  restored to its normal API configuration after copying the isolated QA build.

The same Mock tests also cover a month-old initial snapshot, old confirmed memory
that must not expire by age, temporary fatigue and hypothetical change statements,
cross-user isolation, wrong versions, retained/deleted historical versions, and
an ordinary conversation that must not activate a psychology strategy. Runtime
selection is intentionally conservative and can miss paraphrases; the My area
remains the direct user-controlled way to update a goal or preference.
