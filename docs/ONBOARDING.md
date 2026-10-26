# Linked exploration onboarding

Decision: 2026-10-24. This implements the owner's request for concrete follow-up
questions while preserving the agency-centered direction in
[PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md). The five questions establish an
optional starting point after authentication. Completing the questionnaire now
requires a starting-topic choice and one concrete follow-up; pausing it is still allowed. It is not a
registration requirement, a personality assessment or a prerequisite for conversation.

## Completion rules — 2026-10-26

| Page | Required to complete? | Rule |
| --- | --- | --- |
| Q1 | Yes | Choose at least one topic; multi-select remains available. An exclusive 暂时说不清，先聊聊 option is a valid answer, not a guessed topic |
| Q2 | Yes | At least one option or nonblank note under any selected topic; existing free-written questions also count. No requirement to answer every topic |
| Q3 | No | Further details, life context and constraints are optional; missing answers never become facts |
| Q4 | No | An explicit selection overrides the account preference; leaving it blank preserves the current preference |
| Q5 | Explicit confirmation | Review and save supplied answers; no additional checkbox or AI call |

Continue remains tappable so a missing answer receives immediate feedback:
a short native toast and a persistent explanation above the button. Q1 asks
for a topic; Q2 asks for one option or the user's own words. The explanation
clears when the corresponding answer becomes valid. Navigation/final submission
check both requirements. Older drafts return to the earliest missing required
page while preserving every existing answer. Removing the last valid answer
blocks advancement again. Names, basic context and whitespace do not satisfy Q2.
稍后再填 pauses the questionnaire; it neither creates an empty
exploration nor marks the questionnaire completed. A paused user can still enter
the space and have a direct conversation.

The backend requires a nonempty topic and a concrete follow-up only for final requests carrying
`onboarding_progress_version`. Incomplete/empty drafts remain valid, and direct
exploration creation outside this questionnaire keeps its existing contract.
Invalid completion is rejected before its progress row is changed. No new SQL
column or constraint is needed for Q1/Q2. Account progress persistence itself uses
the separate existing `20261026010000_onboarding_progress.sql` migration; the
completion rule must not prohibit empty JSON drafts at the database layer.

Current acceptance evidence is `q2-report.json`, `q2-native-report.json` and
the corresponding prompt screenshots in `output/onboarding-required-20261026/`.
Browser flows at 320x740 and 390x740 cover missing Q1/Q2 feedback, Q2 text or
selection, whitespace rejection, unanswered Q3/Q4 and confirmed save. An isolated
tourist WeChat simulator (390x844, SDK 3.17.4) covers both prompts, Q2 selection,
unanswered Q3/Q4 and actual-answer review. Earlier reports in that directory
describe the superseded Q1-disabled/Q2-optional behavior.
The bundled WXML/WXSS compiler checks pass; packaged media totals
183,372 bytes against the strict 204,800-byte limit. These checks do not establish
real-device keyboard, touch or flash acceptance.

## Five-page presentation — 2026-10-26

The owner approved the separate design preview, then authorized integrating it.
All five questions now use the local system sans stack, including headings,
quoted context, review text and buttons. Question headings stay 24px/600 on
320px and 390px screens; selection/body text is 15px, secondary text 13px and
editable text 16px. Opening-story fonts and authenticated pages are unchanged.

One mounted dawn landscape and a readable theme wash remain stable through all
five steps. The landscape fills the entire question viewport behind the header,
options and footer, including the safe area; it is not a 355px header illustration.
The lower wash remains translucent instead of fading to an opaque page color.
It stays outside the scroll view, so long answers scroll over one stable image.
No whole-list translation, perspective or scroll-driven animation
is used. The native capsule has its own reserved space. The main CTA is a flat,
theme-derived fill with white text and an unframed arrow, in document flow.

Q2 shows the selected topic before its concrete question and uses light rows.
Q3 quotes the selected parent, then offers its refinements; optional life context
and constraints expand from a live summary. When there is no refinement, basic
context is visible immediately. Optional notes preserve their values when closed.
Q4 expands a fixed local illustration of the selected response style, never a
model-generated reply. Q5 uses supplied words and field-level edit actions,
including legacy free-written questions. Further answers use the neutral label
"想再展开的部分": a resource or possibility must not be relabelled as a difficulty.

The short navigation lock prevents repeated Continue taps but does not block
the first answer on the newly visible question. Account progress, conflicts,
save failures and explicit retry remain under the existing progress contract.

Evidence and review records are in `output/onboarding-implementation-20261026/`.
H5 at 320x740, 390x844 and 390x650 is separate from the isolated WeChat simulator
at 390x844. Simulator screenshots are emitted at 75% by this Developer Tools
session; the logical title size was also checked through the native element API.
Neither browser nor simulator results establish real-device acceptance.

Spacing correction (2026-10-26): card contents are vertically centered within
their minimum height. Previously, the shared block layout left approximately
12–14px above single-line Q2/Q3 content and 25px below it. Q3 now uses an explicit
`refinement` layout with a 56px minimum height and an opaque `quiet-surface`
theme fill; selected/pressed fills remain independent. Q1's two-row options,
Q2's light rows and Q4's response previews retain their respective layouts.
The shared question footer starts 16px after content; Q3's optional context
starts after 16px rather than 28px. Body bottom padding remains zero, and the
bottom safe-area allowance is applied only at the end of the footer. Browser
measurements at 320/390px are in `after-spacing-report.json`, with native
alignment and color checks in `native-spacing-report.json` in the same evidence
directory. The correction does not disable native component style isolation.

## Five-step contract

| Step | Purpose | Interaction |
| --- | --- | --- |
| 1 | What is on your mind? | At least one of seven concrete topics or the exclusive uncertainty option; multiple concrete topics are allowed |
| 2 | What would help within that topic? | Concrete local branches; at least one selection or nonblank note across selected topics |
| 3 | What happens within that blocker, and what is your situation? | A different optional third-level question for each selected Q2 answer; multi-select details, then life contexts and constraints |
| 4 | How would you like help now? | One changeable response preference; it can be left unanswered |
| 5 | Is this what you want to leave here? | Review supplied answers, confirm saving and open conversation |

The entry is not a career intake. Relationships and expectations, daily-life
overload, direction, choices and change have first-class paths. Q1 now offers an
explicit uncertainty start alongside the concrete topics. Free writing remains
available in later questions instead of a Q1 toggle. Notes
remain available in later steps; saved older answers still retain their paths.
For example, family expectations -> differing wishes -> difficulty expressing
an already clear choice produces different questions from daily overload -> too
many tasks -> responsibilities that cannot be shared. Neither path assumes a
job-search problem, diagnosis, unemployment or a desire to take action.

Explicitly selecting job search opens questions about role/industry
direction, a CV or portfolio, application responses, interviews, comparing offers,
or first talking about pressure. The optional note asks about directions already
being considered. Selecting AI/industry change instead opens questions about
its effects, learning, transferable experience, staying versus changing, or
pressure. These are offered possibilities, not facts inferred about a person.

Q3 continues the selected Q2 blocker: application feedback asks where the
process stops, CV concerns ask about evidence and role requirements, and
interview concerns ask which part needs preparation. Multi-select Q2 answers
provide switchable Q3 paths. Only one question is expanded at a time; answering
every branch is not required. Removing a parent excludes its children from the
review and submission, while retaining the local draft for reselection.

Selecting several topics keeps them all. The first selected topic is the initial
follow-up view; short topic controls let the user switch. Each view retains its
own choices and note. Removing a topic from step 1 excludes its answers from
review and submission, but its local draft remains available if reselected.
The uncertainty option remains exclusive. No text classifier or model request
chooses a topic from free writing; the words are preserved and the user selects
what they want to explore.

Basic context remains independent of the topic. Job-search concern does not
automatically mean unemployed, and AI concern does not imply a career change.
The life-context control permits combinations such as working and job seeking.
Income, time, energy, care responsibilities, location and costs are selectable
constraints. No choice is preselected and no missing value becomes a fact.

## Entry and consent

Q1 requires at least one topic to advance; Q2 requires one concrete selection
or nonblank answer. Q3 and Q4 can be passed without an answer. The pause action
remains available on every page and opens
the space, and its empty home state offers direct chat and optional questions.
The main conversation tab and the drawer's new-conversation action can both open
a blank draft. A draft creates an exploration/conversation on first send through
the existing endpoint; simply opening it creates no fake transcript or answers.
Saving answered questions opens the corresponding conversation immediately.

Authentication/privacy and separate AI-processing consent are unchanged. No
model request occurs while filling, switching, reviewing or saving questions.
The selected help preference is single choice because it controls the immediate
response behavior; it is not a permanent label. If omitted, the existing account
preference applies. Current corrections still outrank this dated snapshot.

## Data and compatibility

`follow_ups` maps a selected concern ID to `{selections: string[], note: string,
refinements?: Record<selectedParent, string[]>}`. Each optional refinements map
has at most six parents with at most six bounded strings each. The server
rejects descendants of an unselected parent. Legacy payloads omit this field.
The `general` key is allowed only when no topic was selected. A maximum of six
bounded selections and an 800-character note is accepted per topic. The server
rejects unselected/unknown topics and malformed data. The new `job_search` ID is
additive; legacy concern IDs and the old `focus_response` field remain accepted.

The account-scoped v4 local draft retains all branch entries without the older
seven-day expiration. It is paired with versioned account progress; legacy
single responses stay verbatim with their original topic when switching. Only
currently selected, nonempty branches enter the submission. The server stores
them under the existing exploration JSON, exposes them on readback, and includes
them in the dated initial snapshot. No database migration is needed. Answers do
not become durable memory or AI-generated card facts.

The model receives topic -> selected blocker -> refinement in the existing
dated snapshot, alongside applicable baseline context and support preference.
Its instructions explicitly prioritize relevant concrete answers over generic
topic advice, preserve missing information and stop probing when the user asks.
The local relevance vocabulary includes family/relationships, daily energy and
study as well as work. Current messages and topic switches still take priority.
The chat welcome and editable starter visibly carry selected clues forward.
This is deterministic conditional onboarding, not a model-generated survey;
free writing is preserved verbatim without automatic classification. A captured
MockTransport request verifies the actual context handoff, not real-model
response quality.

## Presentation and validation

Reuse the current Morning Mist artwork, semantic typography and selection
components. Multi-select checkboxes, 44px topic/constraint targets and compact
topic labels distinguish selection from the single help preference. Retain
130ms background/border press feedback, loaded-image handoff and reduced-motion
support. All five steps keep the long scroll content untransformed and do not
animate the whole list on navigation. Selection icons keep a stable image source;
checkboxes use a mounted CSS mark, and onboarding action buttons do not scale
while pressed. The short navigation lock still prevents double advancement.
H5 coarse-pointer
inputs use 16px to avoid focus zoom. Only the note field remounts on a topic
switch to avoid uni-app's delayed old value appearing under a new question.
Q1 uses distinct existing SVG image icons, with icon/title on the first row and
description on the second. The continue/footer controls are ordinary content
inside the same scroll view, following the answers; they are not pinned.

Validation artifacts live in `output/linked-onboarding-20261024/`: three isolated
flows cover branch switching, multi-select, refresh recovery, failed save,
retry/readback and opening conversation at 390x844, 320x740 and 390x650. Both
paused and entirely unanswered flows cover a real first Mock reply after
explicit AI consent, without invented answers. Native compiler checks and
browser evidence are separate from simulator/real-device visual acceptance.
The later `refinements/` evidence covers relationship, daily-life and job-search
paths at the same three viewport sizes, including third-level draft recovery,
saved readback, Q1 alignment and the visible chat handoff. Earlier independent
reviews describe the earlier two-level version, not this later revision.

## Resumable progress — 2026-10-26

Apply `supabase/migrations/20261026010000_onboarding_progress.sql` before
deploying the progress API. This additive PostgreSQL migration introduces one
`onboarding_progress` row per account, with a zero-based step (0–4), bounded
answer JSON, `in_progress` / `paused` / `completed` status, optimistic version
and server update time. RLS and revoked PostgREST grants keep access behind
the authenticated backend. Development SQLite creates the same ORM table
without changing or deleting existing accounts.

`GET /api/onboarding-progress` reads only the authenticated account's row.
`PUT` requires the last version (0 for first creation) and accepts incomplete
answers, empty response preference and inactive branch drafts. It saves neither
an exploration nor a conversation, and never calls a model. Onboarding progress
is explicit account questionnaire data, independent of chat retention; deleting
the account cascades to its progress. Unconfirmed drafts never enter AI context.

Each edit and step change is written synchronously to account-scoped local
storage. Cloud writes are debounced and serialized; foreground/reconnect retries
the retained local outbox. A paused questionnaire stays paused after refresh or
on another device, and reopening restores its exact step and answers. Offline
changes become available on another device only after synchronization succeeds.
The footer distinguishes local preservation, syncing, success and conflict.

Versions, rather than device clocks, decide concurrency. Conflicts preserve the
local draft and offer explicit local/cloud choices. A lost save response is
recognized by reading back equal content. Account changes invalidate late
responses. Clearing the questionnaire stages an empty reset at the current
version instead of silently restoring an older cloud draft.

Final submission flushes progress and includes `onboarding_progress_version`
in the existing issue-creation request. That transaction both creates the
exploration and marks progress completed, clears draft answers and increments
its version. A stale autosave or repeated final request fails with 409 instead
of resurrecting answers or creating another exploration. Completion on another
device is restored as a completed flow, rather than an empty questionnaire.

Evidence is in `output/onboarding-progress-20261026/`. Isolated browser flows at
320 and 390px cover offline edits, skip/reload, a fresh browser/device, both
conflict choices and final save. Focused API tests use disposable databases;
the migration is also parsed with the PostgreSQL parser. No production migration
or native-device acceptance is implied by these checks.
