# Page and context continuity

Updated 2026-10-26. This change preserves Home, Chat, Discover, Plan, Me and
Journey, and adds explicit choices at the places where their drafts intersect.

## User choices

When Plan, Discover or a chat starter brings text into a nonempty composer, a
sheet shows the existing and incoming text, its source page and destination
problem. The choices are a separate conversation, append, or cancel. All remain
editable drafts until Send. A draft shell that has never been sent is protected
by the same choice. A running conversation receives a separate shell.

Append preserves existing whitespace. If the combined input exceeds 4,000
characters, append is disabled and the separate-conversation choice remains
available. Native input, retained drafts and the chat request share that limit.
Plan refinement keeps the complete edited record and step without silent slicing.

Changing page, account or conversation invalidates a pending handoff. Cancelling
a conflict discovered during destination loading restores the previous selection.
Network failures retain input and show an actionable page error. Bringing text
into Chat never calls a model or saves a proposed Plan.

## Independent problems and common context

An exploration remains the owner of its decision card, Plan and Journey records.
The exploration drawer and Plan's change-direction sheet can open a short editor
for another independent problem, with optional background and access to the five
initial prompts. A request identity prevents a repeated network submission from
creating duplicate cards. Changing the editor content creates a new identity.

Job search and relationships can therefore have separate cards and Plans, with
several conversations each. The app does not infer a mandatory split from topic
labels or silently move old messages. Explicit links can reference up to three
other exploration cards; they never import the other conversations' transcripts.

Me's common-background view lists existing global, enabled, active, long-term
memories the user confirmed. It does not generate or persist an overall summary.
Memory use remains a separate account preference. Scope-matched memories and
explicitly reviewed conversation summaries retain their existing boundaries;
turning memory use off excludes memories from subsequent generation context.

When comparing paths, the existing chat request asks for fact-based alternatives,
costs, unknowns and ways to check them. It does not require exactly two options,
invent extra choices, choose for the user or merge independent problems. Model
output quality beyond deterministic Mock fixtures still requires evaluation.

## Persistence and source handling

Retained composer text now includes `source_refs` for Discover excerpts. Each
appended angle keeps its own source identity and original generated text. Reload
and send verify those identities against currently available owned evidence.
Withdrawing a source removes its excerpt while preserving manual text and other
valid angles. User edits that remove a quote drop that reference. Retention-off
drafts remain in memory; disabling retention purges stored text and references.
Source withdrawal synchronizes text and source metadata together. Flushing an
already synchronized composer does not occupy its writer, so edits after
returning from Journey continue to persist instead of remaining visible only
until restart.

Plan refresh uses the latest Plan step, attempt and version as one editor base.
It does not assign that partial view's version to a stale full card. Version
conflicts preserve edits instead of overwriting another client's card fields.
Saving a chat-derived record consumes the original draft and keeps its message
reference for Journey. Independently confirmed records survive source deletion.
Conflicting request identities and reused sources return handled 409 responses.

PostgreSQL deployments apply
`supabase/migrations/20261026020000_chat_draft_input_limit.sql`. SQLite startup
adds the provenance column without rewriting messages or retained composer text.
No production/private database was used for this change's acceptance.

## Verification

Automated coverage exercises draft choices and delayed navigation, source
restoration, full-length inputs, independent creation retries, card/Plan versions,
record-source preservation, and context isolation across independent problems.
The context test captures only synthetic Mock requests and checks authorized
global/current-problem memories, explicit card links, opt-out, reviewed-summary
boundaries and one provider dispatch per explicit send.

PostgreSQL 16 acceptance used disposable containers. All fourteen migrations
applied; reapplying the latest migration succeeded. The integration test checks
ownership, RLS, revoked direct-client permissions, 4,000-character draft writes,
source metadata, a 4,001-character rejection at both API and database boundaries,
and account deletion. Existing accounts and hosted data were untouched.

Native acceptance uses a separate tourist Mini Program project named
`Page Context Isolated QA`, a temporary SQLite database and an isolated
MockTransport API on port 8041. The automation connection uses port 9476 and
requires a native SDK before writing synthetic session storage. Evidence is in
`output/page-context-20261026/native-result.json` and adjacent screenshots.
The tested simulator is iPhone 12/13 (Pro), 390 by 844, WeChat SDK 3.17.4.
Mock acceptance does not verify real provider answer quality or physical-device
keyboard and gesture behavior. No paid provider or speech request is made.

Final automated checks: 382 frontend tests across 70 files passed; the SQLite
API suite passed 351 tests with its optional PostgreSQL test skipped, and that
PostgreSQL test separately passed against the disposable database. TypeScript,
Ruff and all five tool tests passed. The formal Mini Program build passed the
bundled native compiler checks and its media budget (183,372 bytes of 204,800).

The successful native receipt records eleven flows, zero runtime exceptions,
four Mock generations and zero paid requests. It covers new/append/cancel draft
choices, two-path comparison with scoped memory, record confirmation and draft
consumption, Me memory opt-out, independent-problem switching and creation,
Plan/Journey source continuity, two appended Discover sources across restart,
selective source withdrawal, and saving/sending a complete 3,500-character draft.
A separate native probe also passed composer saving both before and after
returning from Journey. Screenshots were visually inspected for the conflict
sheet, common background, confirmed Plan record, Journey source and restored
Discover draft with its composer-adjacent withdrawal notice.
