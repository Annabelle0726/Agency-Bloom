# Plan: chosen attempts and editable records

Updated 2026-10-25. Plan now connects conversation, user-reviewed drafts,
chosen next steps and subsequent observations. It reuses the existing issue
card, conversations, Journey records and feedback; no new table is required.

## Experience

The main card uses Home's theme-aware surface, Discover's quiet hierarchy,
the static book artwork and the existing Bloom character. Its central copy
uses the body font at 16px with 1.75 line height. Longer steps can expand.
The full decision card remains a disclosure below the current attempt.

The current attempt has an explicit active, paused or completed state. Saving
an observation shows it underneath the step and updates Bloom's invitation.
A record alone never marks an action complete or selects a new step. Users
can pause, resume, complete or replace a step after reviewing the change.
Replacing it creates a different attempt; previous records remain in Journey.
Ending an exploration hides edit controls until it is explicitly restored.

The latest observation appears only once, in the current-attempt card. The
short history below excludes that record and decision-status events, and
shows up to three earlier observations. Both locations allow expansion and
manual editing. Saving new progress keeps the current attempt open; completing
it changes the main action to considering the next step. Users can correct a
completion, add an experience, or explicitly choose a new attempt. Completion
never ends the whole exploration or automatically chooses another step.

Changing direction offers two separate choices: replace the current attempt
within this exploration, or begin a new exploration through the existing
onboarding flow. Both preserve previous records. Cancelling either editor
does not change the plan. Rewording an attempt preserves its identity, records
and pause/completion state; explicit replacement creates a fresh active
attempt even when its words match the previous one. Clearing a step retires
its identity. Full-card and Journey direction editors follow the same rule.

Users can write a record directly or talk to Bloom. The conversation entry
reuses a suitable conversation for the current exploration when it has no
pending input; otherwise it opens a separate draft shell. The latest linked
observation can be carried into the editable composer. Nothing sends until
the user presses Send, through the existing consent and budget checks.

An explicit request to summarize experiences or propose an action may produce
an optional `plan_draft` in the same model response. Its title, record text and
optional next step remain editable. A user chooses to save only the record,
only the step, or both. The API saves the selected changes atomically. Bot
questions are not intended to become steps: the prompt states this, and a
small validator drops common conversation-question prefixes. This is not a
semantic guarantee about every possible model response.

The review sheet also supports asking Bloom for another wording based on the
user's current edits. It preserves the original while the new version is
pending. The new version appears separately, with actions to adopt and edit
it or retain the user's version. Reopening the same draft preserves edits.
Closing the sheet keeps its draft in account-scoped memory for this session.
These sheet edits do not currently survive application restart. Retained
assistant drafts are restored with their conversation; retention-off drafts
remain ephemeral. Saving a record does not automatically save a proposed step.

After confirmation, the originating assistant draft is consumed and marked
`plan_saved`. The bottom summary/review entry disappears, including after
restoring a retained conversation. A new user turn can make summarization
available again. Each conversation keeps its own state. Record and step
selection use theme-colored square checkboxes with a CSS tick, an explicit
checked state, and a full-row touch target at least 48px high.

## Data and conflict handling

`GET/POST /api/issues/{id}/plan` reads and writes issue-owned state. Status,
attempt IDs and record links live in `Issue.exploration.plan`; next-step text
remains in `Issue.card.next_step`. New records use existing `JourneyRecord`
rows with kind `thought`, so writing a thought does not imply taking action.
Explicit step/status changes create decision-history rows. Stable `record:`
and `feedback:` identities allow edits without copying a second timeline.

`step_action` distinguishes revision from replacement. Editors capture the
attempt ID when opened; step/status writes reject a mismatched ID after a
concurrent replacement. New observations carry `record_attempt_id`, so an
older draft can still be saved against its original attempt after reloading.
When a record and the first step are created together, they are linked; when
a record accompanies a replacement, it belongs to the previous attempt.
Replacement and completion cannot be combined in one write.

Home reads the same confirmed records through the issue response. Journey
edits appear after returning to the workspace. Plan loads the latest 50
records; Journey remains the destination for older history. Legacy feedback
is visible but is not retrospectively attributed to an attempt without a link.

Writes check account ownership, exploration status, issue version and the
edited record's version. The latest request ID and body digest prevent an
identical retry from adding another record. A saved retained assistant draft
is consumed; it cannot be saved again under a new request. Conflicts preserve
local text; reloading shows current saved content without replacing those edits.
Account changes clear local private drafts. Internal Plan save metadata is
excluded from the model's exploration context.

Plan draft instructions apply to normal conversations, separately from the
frozen evaluation prompt. Summary tasks, explicit crisis turns and turns
containing external search results discard Plan drafts. No new automatic
generation, research, reminders or budget allocation was added.

## Plan continuity and long-term memory

The 2026-10-25 follow-up connects confirmed Plan updates to Bloom's next turn.
The current exploration supplies `confirmed_plan`: the saved step, explicit
status, exploration-ended state, and at most three recent observations and
three changes. It is available in a new conversation within the same
exploration, including a short continuation such as "接下来呢". Other
explorations are not silently combined. Observation text is bounded to 500
characters per item, change text to 600; complete records remain in Journey.
This is current user-confirmed workspace context, independent of whether
long-term memory use is enabled. New user corrections retain precedence.
The normal chat prompt distinguishes completed, paused, cleared and replaced
steps and gives this current state priority over older transcript/summary
descriptions of the same step. No extra generation is needed.

The review sheet also offers "同步到这段探索的长期记忆". It is initially
selected for a plan that has no recorded preference, remains visible for
explicit confirmation, and preserves a previous disabled choice. Confirming
it authorizes subsequent confirmed Plan updates to refresh one managed memory
per exploration (`source=plan_sync`, `category=fact`, `horizon=long_term`).
The memory contains a bounded snapshot of the current state, latest change
and latest observation, at most 400 characters. It does not label personality
or turn a temporary choice into a global preference. Older complete events
remain in Journey; this snapshot is not exhaustive transcript recall.

The memory uses the existing manager, account limit and separate use switch.
Saving it never enables `use_memory`. When enabled, the current exploration's
managed Plan memory can be selected even for a short continuation without
matching keywords. Turning off sync disables the old snapshot while retaining
it for management. Disabling/deleting a memory stops automatic sync; editing
its content, scope, category, horizon or status detaches it as `user_revision`
so future saves cannot overwrite the user's wording. Explicit re-enabling in
the Plan sheet is possible after reviewing the latest memory version. Deleting
a memory does not delete independently saved Plan records; those remain
current context for this exploration.

Plan saves and memory synchronization share one transaction and the existing
user context lock. Memory conflicts or the 40-memory limit preserve the open
editor and roll back the entire save. Retrying a confirmed save does not add
another memory. Card/Journey edits, observation removal, exploration end/resume
and confirmed feedback refresh an already-authorized managed memory. Removing
the initial onboarding snapshot preserves independently confirmed Plan state
and its memory link. Affected pending replies are cancelled so a result using
superseded Plan context cannot arrive as a current answer; no retry is added.

Follow-up verification includes 11 isolated memory/continuity tests and a
pending-generation cancellation regression. Actual MockTransport request
payloads confirm that completion and clearing reach a new conversation, the
memory-use switch is respected, and an unrelated exploration receives neither
this Plan nor its scoped memory. Frontend checks cover the reviewed sync
preference and memory version. Native evidence is recorded separately under
`output/plan-memory-20261025/`: thirteen native checks passed on the 390x844
iPhone 12/13 (Pro) simulator, SDK 3.17.4, using Mock API 8039 and tourist-project
automation 9474. The flow confirmed creation, same-memory completion and
replacement updates, visibility in the memory manager, explicit disabling,
and the unchecked preference when returning to a new Plan editor. The latter
also has a frontend regression test that preserves pending record text while
refreshing the memory controls. Real hardware and live-provider response
quality remain unverified; paid requests were zero.

## Verification and limits

- 18 isolated Plan API tests cover atomic saves, attempt links, explicit states,
  retries, ownership, ended explorations, Journey edits, draft restoration and
  consumption, both retention modes, summary/crisis/search exclusions, revision
  versus replacement, stale attempt protection, and clearing/re-adding steps
  through both card and Journey editors. The related Plan, saved-suggestion,
  exploration and personal-Journey suites pass together (33 tests).
  They use temporary databases and MockTransport, with no paid requests.
- 28 focused frontend tests cover Plan actions, preserving manual revisions,
  reopening drafts, record-only saves, failure/conflict handling, account
  changes, external card refresh, summary-entry lifecycle, nonduplicated latest
  records, completion actions and Home record identity/status.
- TypeScript and Ruff checks pass. Native builds and bundled WXML/WXSS checks
  pass; existing Sass legacy-API warnings remain.
- Browser component checks at 390x844 and 320x740 cover forest/night themes,
  direct writing, dynamic updates, adopting a synthetic revision and editing
  it again, failed-save preservation, pause/resume/completion and step editing.
  No horizontal overflow was observed; body text computes to 16px. Fixtures
  are synthetic, and do not establish real-provider response quality.
- A separate tourist Mini Program project uses disposable Mock API port 8037
  and automation port 9472. On the iPhone 12/13 (Pro) simulator at 390x844,
  SDK 3.17.4, native clicks verified Plan navigation, Bloom expansion, the
  record editor, explicit save and the resulting main-card observation.
  Evidence is in `output/plan-review-20261025/`. Real hardware, keyboard and
  enlarged-font acceptance, plus a live-model rewrite cycle, remain unverified.
- A second isolated tourist project uses Mock API port 8038 and automation
  port 9473. On the same 390x844 iPhone 12/13 (Pro) simulator and SDK 3.17.4,
  native clicks verified checkbox toggling, hiding the summary entry after
  save and reload, rendering the latest observation once, explicit completion,
  choosing a new active attempt while retaining old progress, cancelling a
  replacement, and starting onboarding without changing the original plan.
  Screenshots and the eight-check receipt are in
  `output/plan-lifecycle-20261025/`. No paid requests were made.

The full suites are not entirely green: the observed frontend run had 337
passes and one legacy page-art source assertion failure following the separate
cloud-media migration. The API run had 328 passes, one PostgreSQL skip and
nine fixed-evaluation failures. For the latter, the system text produced by
the current default prompt was compared to `HEAD` and was byte-identical;
both hash to `c9fdcdb6730d2ddb415c91ee5fa1316bb72b9a1629170bb37b77ea9053cabfe5`,
while the evaluation guard expects `d52d431c285a944e87ba9e9f28b8628a6b81be0a0ab567945e1e77cbf7ef5128`.
The frozen guard was not loosened. After the full frontend run, an additional
memory-manager return regression was added and the focused Plan/drawer suites
passed (20 tests); TypeScript and the native build also passed again.
