# Personal Journey — the path you have taken

## Design and scope

The approved agency-bloom-journey-reference-v2.png defines an editorial journal:
natural light dissolves into a continuous paper page, with a short retrospective,
a fine chronological line, and a quiet next-step surface. This is a record of
selected moments, not a growth score or an activity dashboard.

Discover's history entry now opens a native subpage. The conversation drawer
remains the conversation manager. Detail navigation and back navigation use the
native page stack; filtering and the list's scroll position remain on the list page.
The page inherits the account's six existing themes and saved theme IDs. No theme
settings, authentication rule or automatic time-of-day rule is changed.

Titles are 28px (detail 26px), event titles 15px, body 13–14px. Containers are 8px.
Dates have secondary emphasis. Only interactive records show arrows. A theme-aware
Lucide leaf and the closing sentence share one row. Press feedback is immediate;
the introduction appears once, and opening source text has a short transition.
Reduced-motion preferences disable these transitions. There are no looping effects.

## Evidence, not invented history

- Initial exploration saves use their original initial_title when retained. A
  renamed current card is never presented as its original title.
- User feedback remains linked to the actual saved feedback record.
- Existing end dates reflect stored exploration state. The old schema has no
  complete lifecycle or card-revision log: missing historical transitions are
  not reconstructed. A user can independently save a pause, action, or decision.
- New milestones require an explicit save. Action-type records are user reports,
  not externally verified completions.
- The retrospective quotes a dated confirmed record and is bounded to 140
  characters. Without a meaningful confirmed record, it shows an honest empty
  state instead of generating a growth narrative.
- Current next steps come from confirmed decision cards. Editing or clearing one
  uses the issue's optimistic version and preserves all other card fields. A
  successful change saves the user's before/after choice as a dated milestone.
- A pending candidate is derived only from an existing retained assistant insight.
  It remains outside the official timeline. Review, editing and explicit
  confirmation create a separate confirmed milestone. Dismissal never creates a
  visible event. This feature generates no new insights and calls no model.

## API and persistence

New API routes are registered from app/journey.py:

- GET /api/journey/events — owned chronological records with a stable keyset cursor
- GET /api/journey/events/{id} — original saved detail and source availability
- POST /api/journey/records — explicit milestone save; stable request IDs prevent
  duplicates after an uncertain response
- PUT/DELETE /api/journey/events/{id} — versioned correction/deletion of milestones
  and feedback; structural exploration records are read-only
- GET /api/journey/candidates — a bounded scan of retained assistant insights
- POST /api/journey/candidates/{id}/dismiss — content-free suppression
- PUT /api/journey/directions/{issue_id} — versioned next-step update

journey_records stores owned, user-confirmed text, its kind, saved time and
optimistic version. A unique optional source-message key prevents duplicate
candidate confirmations. Deletion removes the title/text and keeps a content-free
suppression marker. Deleting retained chats clears source links, while independently
confirmed records survive; deleting the account cascades. Pending text is never
copied to this table.

SQLite development creates the additive table using existing Base metadata.
20261022010000_personal_journey.sql supplies the PostgreSQL migration, enables RLS
and revokes public client roles. It is not automatically applied to a hosted
database. No existing rows, credentials, environment files, budget ledgers or
evaluation baselines are rewritten.

A lightweight change notification refreshes the root card/feedback after return.
This notification carries no personal content. Failed saves preserve form input;
old versions fail closed instead of overwriting newer content.

## Verification

All development verification uses isolated fixture databases. The native fixture
server tools/mock-journey-api.py binds localhost:8022, reads no environment file
and uses no paid provider. tools/verify-journey-native.cjs targets only a separately
copied tourist project under output/journey/native-project on port 9442.

Evidence and reports are kept in output/journey. See the completion note below
for final checks and actual native flows. Physical-device typography, keyboard
behavior and deployment PostgreSQL migration remain separate acceptance work.

## Theme parity and personalization audit

The root workspace can automatically show Forest at midday while /me still
stores an earlier Evening Smoke choice. Reading /me.theme alone therefore
caused a mismatch on the new subpage. The root and journey now call the same
personalSpaceTheme policy, including the per-account manual-choice marker.
The current resolved theme is passed during navigation for the initial frame;
it is a presentation hint, never a write to the user's theme preference.

Regression coverage includes the stale-saved-dawn/midday-Forest case, automatic
night colors, all six manual choices and anonymous Morning Mist. Native QA
enters from the actual Discover control and compares the journey theme to the
workspace policy. Gallery fixtures deliberately mark manual choices.

Journey runtime source contains no fixture experiences, dates, next steps or
sample career decisions. The ordinary fixed text is limited to section labels,
controls and empty states. Account ownership is enforced by the backend for the
timeline, sources, candidates, edits, deletion and next-step updates.

The native list also queues a refresh when returning while an earlier read is
still running, so a quick save/back sequence cannot drop the newer refresh.
The full loaded pagination depth is retained when refreshing the list.

## Validation record — October 22, 2026

- API regression suite: 228 passed, one optional disposable-PostgreSQL test
  skipped. The final seven personal-journey tests pass separately, including
  source purging, ownership, version conflicts, oversized version input,
  confirmation idempotency, old feedback pagination and account deletion.
- Frontend suite: 122 passed. TypeScript and Ruff checks pass.
- A staged-only export also passes its TypeScript check and all seven new API
  tests, confirming that the commit does not depend on unrelated pending work.
- WeChat bundled compilers pass: 16 WXSS and 43 WXML files, plus references and
  packaged images.
- Native simulator viewport: 390 x 844. Evidence includes six palettes,
  confirmed detail/source expansion, a separate candidate review, save failure
  with retained input, explicit confirmation, direction editing and clearing,
  the actual Discover/back path and an empty account.
- Visual review: one initial review (7/10) followed by a correction review
  (8/10). Capsule overlap, forest-title contrast, dark status-bar contrast and
  repeated topic labels were corrected. Dark secondary text was then brightened.
  The retrospective remains deliberately evidence-bounded rather than adding
  unsupported narrative to improve its apparent density.
- Native run reports are timestamped in output/journey/report-*.json. Screenshots
  and source/detail states are in the same directory. These contain synthetic
  fixture accounts only. No paid model calls were made.

Remaining limits: physical-device keyboard/font scaling and a disposable
PostgreSQL migration run were not verified. Hosted migrations were not applied.

Final native acceptance: the six-theme run and two repeated asynchronous-flow runs passed with zero runtime exceptions. Three timestamped reports were saved. The formal build was restored to its normal API target and verified to contain no localhost:8022 fixture URL.
