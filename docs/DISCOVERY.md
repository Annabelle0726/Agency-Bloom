# Discovery: intentional questions and independent conversations

## A. New conversation contract

The workspace uses a local tab value, not `uni.switchTab`. The former entry selected Chat and replaced the active conversation's input. Discovery now explicitly creates an in-memory `draft:<UUID>` session with no messages, linked to the recommendation's owned, active exploration. The original conversation and unsent draft remain untouched. The prefilled question is editable/removable and is never sent automatically.

On explicit Send, `POST /api/discovery/conversations` atomically creates the conversation with the draft UUID as an idempotency key. An existing exploration is reused. A generic first-use question without a source exploration shows that Send saves a new exploration and conversation; these are created together only then, without inferred background, linked explorations or copied transcripts.

An account-row lock serializes creation. Unknown-response retries reuse the UUID. Creation has a separate disabled-composer state so a queued second tap cannot become Cancel. Failures preserve text and allow explicit retry. Promotion moves the same session object to the real ID. Late results stay scoped to the originating account/session; leaving the app during creation suppresses the subsequent model send. Returning to a saved conversation restores its in-memory draft. Full restart/sign-out clears unsaved chat drafts under the existing privacy contract.

## B. Rule-driven recommendations (v0.1)

`discovery.ts` exposes pure candidate, deduplication and selection functions. Inputs are owned explorations/decision cards and the latest 100 confirmed journey events. Discovery never requests transcripts, pending insights, reasoning or long-term memories. Card hypotheses are excluded. A selected concern is a question-design input, not a personality inference.

| Strategy | Confirmed source | Intent |
| --- | --- | --- |
| Review an experience | Explicit action milestone or quoted saved feedback | Continue |
| Clarify an open question | Saved unknowns, excluding the initial placeholder | Continue |
| Reconsider conditions | Current confirmed constraints | Perspective |
| Check a chosen next step | Confirmed next step and current constraints | Reality |
| Consider a bounded trial | Saved options, when no next step exists | Reality |
| Resume a topic | Explicit initial answer or saved exploration title | Continue |
| Start from a selected concern | User-selected onboarding direction | Perspective |

Generic `progress` feedback is called a saved record, never automatically a completed action. Ended explorations are excluded. Source excerpts remain quotes. Candidate IDs depend on source content, not metadata timestamps or random numbers. Confirmed topic titles support six additional inquiry strategies (priority, preservation, learning, recent examples, decision timing and evidence). These are questions, never claims about the user.

## Recommendation lifecycle (2026-10-22 correction)

The earlier implementation suppressed an entire intent group after a refusal and only provided generic fallback before filtering. This could exhaust all eligible cards and leave an unusable empty page.

- Display two questions normally. Explicit **Change set** offers two further batches; the third change adds a third, self-directed entry and gently asks what help the user currently needs.
- Prefer eligible questions grounded in confirmed sources, then explicitly labelled curated questions. Avoid previously displayed IDs during a round when alternatives exist. This is deterministic rule-based composition, with no extra model calls or random daily generation.
- **Not applicable** replaces only that card and preserves the other displayed choices. Exact refusals remain suppressed for 90 days; similar intent receives a ranking penalty for 14 days instead of disappearing entirely. Successful exploration rests the exact question for 30 days.
- When all finite normal candidates are rejected, retain two editable user-directed conversation starters. These are not dismissible recommendations; they are durable ways to say what the user needs, without forcing another carousel or resurrecting rejected wording.
- Reopening a tab retains the current batch. Changed confirmed sources rebuild it. Each new authenticated session (including cold session restoration) refreshes the batch and avoids its last displayed IDs when alternatives exist. Updating the account profile/theme does not refresh it.
- A failed source request retains the current in-memory batch and exposes an explicit retry. Late responses cannot restore another account's cards. Rotation and rejection never delete explorations, journey entries, conversation history or drafts. Cold restart/sign-out still clears in-memory chat drafts under the existing privacy contract.

Feedback/rotation use `agency.discovery.v1:<userId>` on the device: at most 200 opaque feedback IDs, intent scopes and dates, plus the last three displayed IDs. No source text is persisted. Existing stored feedback remains compatible and account-isolated; storage failure keeps state in memory and reports the limitation. Cross-device synchronization is outside v0.1.

## Visual and interaction scope

Preserve the existing six-theme photography, image resolver, typography and card style. Quiet source captions and text actions explain relevance without statistics or badges. Existing press feedback and page transitions are reused; no new image/animation dependency or decorative motion is added. Copy is limited to the question, source, optional feedback and new-conversation guidance. Visual acceptance is a focused self-review of the changed card/footer states, not a page redesign.

## Verification and deployment

The journey migration must exist in each PostgreSQL deployment before reading evidence; see `PERSONAL-JOURNEY.md` for the 2026-10-22 rollout correction. First-send promotion uses existing tables and requires no additional migration.

130 frontend tests, type checking, 9 targeted entry/journey API tests and 43 existing conversation/offline-evaluation regression tests passed. The evaluation tests use isolated transports: the eight real-model baseline calls/receipts are not rerun or altered. Native compiler checks cover 17 WXSS and 43 WXML files.

Simulator reproduction: `tools/mock-discovery-api.py` on port 8023, `tools/verify-discovery-native.cjs` on automation port 9443. The helper asserts a separate tourist project and isolated API marker; fixtures use temporary SQLite, no environment file, demo mode and no provider key. Evidence lives in `output/discovery/`. Physical-device keyboard behavior and font scaling remain separate acceptance checks.

Native acceptance completed in the 390x844 simulator: one full six-theme run and two repeated asynchronous-flow runs passed, with zero runtime exceptions and zero paid requests. Reports: `report-1792657334078.json`, `report-1792657359517.json`, `report-1792657378804.json`. Verified old messages/draft preservation, editable empty drafts, double taps, failed-save recovery, exactly one first-send conversation in the existing exploration, stable reopening, explicit rotation, persistent rejection feedback, account isolation and first-use promotion. Focused screenshot self-review covered forest and dark cards, empty draft and restored old draft; no independent visual redesign review was needed.


### Replenishment regression verification

The correction passed type checking and all 14 focused Discovery/workspace tests. These include legacy all-dismissed feedback, exhaustive refusal, preservation of the unselected card, two fresh rounds and the third-round invitation, ordinary-visit stability, login/cold-restore refresh, account isolation and stale/error responses.

The 390x844 isolated simulator completed one six-theme run and two repeated interaction runs with zero runtime exceptions or paid requests (reports `report-1792671446990.json`, `report-1792671524659.json`, `report-1792671551443.json`). Screenshots of forest/dark cards, the third-round invitation and exhausted-source starters were visually reviewed in `output/discovery/`. The final exhausted-source state hides the inactive Change set action; the remaining cards still open editable, unsent drafts. Physical-device interaction remains unverified.
