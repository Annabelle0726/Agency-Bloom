# Optional, linked exploration onboarding

Decision: 2026-10-24. This implements the owner's request for concrete follow-up
questions while preserving the agency-centered direction in
[PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md). The five questions establish an
optional starting point after authentication. They are not registration
requirements, a personality assessment, or prerequisites for conversation.

## Five-step contract

| Step | Purpose | Interaction |
| --- | --- | --- |
| 1 | What is on your mind? | Seven concrete topics with multi-select; all may be skipped |
| 2 | What would help within that topic? | Concrete local branches; multiple answers and an optional note per topic |
| 3 | What happens within that blocker, and what is your situation? | A different optional third-level question for each selected Q2 answer; multi-select details, then life contexts and constraints |
| 4 | How would you like help now? | One changeable response preference; it can be left unanswered |
| 5 | Is this what you want to leave here? | Review only supplied answers; save and open conversation, or go directly to chat if empty |

The entry is not a career intake. Relationships and expectations, daily-life
overload, direction, choices and change have first-class paths. Q1 no longer
offers the broad curiosity/uncertainty cards or its free-writing toggle. Notes
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

Each question can be passed without an answer. The existing pause action opens
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

The account-scoped seven-day v3 local draft retains all branch entries. Legacy
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
