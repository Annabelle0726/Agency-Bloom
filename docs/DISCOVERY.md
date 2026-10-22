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

Generic `progress` feedback is called a saved record, never automatically a completed action. Ended explorations are excluded. Source excerpts remain quotes. Candidate IDs depend on source content, not metadata timestamps or random numbers. Reopening the page keeps the same ordering. Changed constraints invalidate dependent candidates. Ranking prioritizes experiences and chosen directions, removes duplicate wording and selects one candidate per intent/exploration. The page shows at most two relevant cards, including one when only one is supported. Three curated topics supply fallback only when confirmed sources are insufficient.

Explicit **Change set** rotates a finite eligible set; when no different set exists, the page says so. **Not applicable** suppresses an exact candidate for 90 days and the same intent in that exploration for 14 days. A successfully explored question rests for 30 days, without marking any real-world action completed. With all candidates suppressed, the page remains quiet.

Feedback/rotation use `agency.discovery.v1:<userId>` on the device: bounded to 200 opaque IDs, intent scopes, interaction types and dates, without source text. Choices survive reopening and remain account-isolated; storage failure keeps them in memory and reports the limitation. Cross-device synchronization is outside v0.1.

## Visual and interaction scope

Preserve the existing six-theme photography, image resolver, typography and card style. Quiet source captions and text actions explain relevance without statistics or badges. Existing press feedback and page transitions are reused; no new image/animation dependency or decorative motion is added. Copy is limited to the question, source, optional feedback and new-conversation guidance. Visual acceptance is a focused self-review of the changed card/footer states, not a page redesign.

## Verification and deployment

The journey migration must exist in each PostgreSQL deployment before reading evidence; see `PERSONAL-JOURNEY.md` for the 2026-10-22 rollout correction. First-send promotion uses existing tables and requires no additional migration.

130 frontend tests, type checking, 9 targeted entry/journey API tests and 43 existing conversation/offline-evaluation regression tests passed. The evaluation tests use isolated transports: the eight real-model baseline calls/receipts are not rerun or altered. Native compiler checks cover 17 WXSS and 43 WXML files.

Simulator reproduction: `tools/mock-discovery-api.py` on port 8023, `tools/verify-discovery-native.cjs` on automation port 9443. The helper asserts a separate tourist project and isolated API marker; fixtures use temporary SQLite, no environment file, demo mode and no provider key. Evidence lives in `output/discovery/`. Physical-device keyboard behavior and font scaling remain separate acceptance checks.

Native acceptance completed in the 390x844 simulator: one full six-theme run and two repeated asynchronous-flow runs passed, with zero runtime exceptions and zero paid requests. Reports: `report-1792657334078.json`, `report-1792657359517.json`, `report-1792657378804.json`. Verified old messages/draft preservation, editable empty drafts, double taps, failed-save recovery, exactly one first-send conversation in the existing exploration, stable reopening, explicit rotation, persistent rejection feedback, account isolation and first-use promotion. Focused screenshot self-review covered forest and dark cards, empty draft and restored old draft; no independent visual redesign review was needed.
