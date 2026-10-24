# Product direction: agency in a changing world

Decision date: 2026-10-24. This is the current product direction, approved by the
project owner. It supersedes career-only positioning in earlier product notes.
It does not activate features or claim that dialogue quality has been validated.

## Purpose

Agency Bloom helps people understand their own value, explore possibilities in
a changing world, and make choices according to their own wishes.

Its mission is to help a person see more possibilities, think more clearly, and
develop the courage and capacity to choose. The person decides what kind of
life is worth living. Bloom supports thinking, offers information and grounded
advice, and leaves room for uncertainty, refusal, rest and changed wishes.

Career exploration is the first concrete validation scenario. It is not the
whole product identity. Broad human needs require useful, bounded situations
in which to test the product; they do not justify launching many modules at once.

## Two questions to hold together

**Livelihood and reality:** Which parts of my work are changing in value? What
do I need for income, responsibilities, time and a workable way of living?

**Personal meaning:** Apart from what a market pays for, what relationships,
experiences, interests, responsibilities and forms of creation matter to me?

Do not promise that personal uniqueness prevents displacement. Do not convert
market value into a measure of a person's worth. A discussion about meaning
must not hide financial constraints; practical advice must not define a person's
life for them. Do not automatically interpret work anxiety as a wound to identity.

## Revisitable thinking dimensions

| Dimension | Intended contribution | Boundary |
| --- | --- | --- |
| Understand | Help the user notice actual experiences, needs and what matters now | No personality diagnosis or hidden-motive inference |
| Question | Make a consequential assumption or unresolved distinction visible | No compulsory challenge, interrogation or manufactured contradiction |
| Explore | Consider alternative interpretations, combinations and possibilities the user might create | No random recommendations or invented fit claims |
| Become | Let the user choose what to keep, try, change, pause or leave open | No obligation to act or become more productive |

These dimensions are not sequential stages, support-mode IDs, progress scores,
or categories assigned to users. They do not replace Listen / Discover / Compare /
Experiment, which remain changeable response preferences. An ordinary conversation
can be valuable without a question, perspective card, conclusion or action.

## Three dialogue capabilities to develop

### Ask a question that changes what help is useful

First determine whether a distinction matters. Ask one useful question when it
would change the response, allow the user not to answer, and offer direct advice
when that is what they ask for. Repeatedly asking the user to think is not itself
evidence of helpfulness. If they are tired or only want to be heard, listen.

For the question "AI can write code; why should I study software engineering?",
income risk, the meaning of earlier effort and enjoyment of creating software
can lead to different discussions. They may overlap or all miss the user's
actual concern. A clarifying question must allow those possibilities rather
than imposing a binary psychological interpretation.

### Offer a grounded, rejectable perspective

A useful perspective can examine a constraint, a premise, a longer-term value,
an overlooked alternative, or the possibility of creating a new option. Choose
what fits the current request; do not inject every perspective on every turn.
The assistant may need to revise its own earlier recommendation.

Use only voluntarily supplied, authorized clues. Distinguish facts, the user's
stated values and tentative interpretations. If evidence is insufficient, do
not manufacture an insight. Rejection, silence or skipping must not create a
trait, trigger persuasion, or become a permanent preference without confirmation.

### Help the user articulate their own understanding

A useful result may be: "I used to assume A; B might also be possible; I want to
learn C before choosing." This is an optional expression in the user's words,
not a required completion template or evidence that the AI discovered their
true identity. An AI paraphrase remains a reviewable draft. Saving, revising,
disabling and deleting it follow existing consent and memory contracts.

Pausing, deciding that a goal no longer matters, seeking human help, and leaving
a question open can all be meaningful outcomes. Do not infer permanent values
from one emotional expression or from a single attempt.

## Responsibilities of existing pages

| Page | Meaning | Useful reason to return |
| --- | --- | --- |
| Home | My present situation | Resume something the user still considers important |
| Conversation | Think together | Receive understanding, a useful question, perspective, information or advice |
| Discover | See possibilities | Examine a relevant angle grounded in real clues or consider creating an option |
| Plan | Bring an idea into reality | Try, record what happened, pause, or revise a user-chosen experiment |
| Me | How I currently understand myself | Review, confirm, correct, disable or delete memories and changes |

Discover is the most promising existing surface to develop. Candidate questions
can concern overlooked contributions, inherited success standards, combining
experiences, competing priorities or untested assumptions. These are candidate
topics, not inferred motives. The page must explain its actual source, respect
the user's current intent, and support an honest empty state. No daily random
self-analysis, automatic career research or unsolicited notification is implied.

## Existing mechanisms and gaps

| Capability | Current evidence | What remains to validate |
| --- | --- | --- |
| Optional, intent-sensitive support | Current prompt, support modes and reviewed psychology cards allow listening, advice and at most one useful question | Whether questions identify the right distinction without feeling formulaic or leading |
| Clue-linked alternatives | Existing Insight grounding and context-attributed Discover cards | Whether an angle actually expands a user's options rather than restating their words |
| Perspective Shift | Default-off, isolated Mock-only prototype; see [its contract](PERSPECTIVE-SHIFT-DESIGN.md) | Production activation, consent/preference behavior, semantic quality and native acceptance |
| User-owned records | Reviewable summaries, confirmed cards, memory and phase-change controls | Whether users can articulate a useful new understanding without accepting an AI label |
| Reality feedback | Existing experiments, next steps and feedback history | Whether a chosen attempt changes an actual belief or decision |

Mock tests verify contracts, grounding boundaries, isolation and persistence.
They do not demonstrate insightful conversation, an improvement in agency, or
superiority to a general-purpose AI. This direction update does not change the
runtime System Prompt, enable the prototype or add model requests.

## Concrete scenarios and commercial validation

Career is the first case: compare, test or create a workable form of employment.
Related cases include taking a creative idea to a first shareable artifact,
examining a life tradeoff through a reversible attempt, preparing a conversation
about needs and boundaries, or choosing to relinquish an outdated goal. These
share a thinking process; each still needs its own evidence of usefulness.

Start with one bounded, real decision. Observe what the user can express or
choose after the exchange, what remains unknown, and whether a relevant reality
check changes their view. Optional feedback should use their language rather
than assigning a psychological or agency score. Compare the useful result with
what they obtain from a general-purpose AI on the same situation.

Voluntary return with a new observation is useful evidence. So is an independent
choice that no longer requires the app. Daily use, message count, emotional
dependence, a polished plan and praise for the mission are not sufficient proof.

Test willingness to pay for a defined useful outcome in a concrete scenario.
Do not assume a paid life-coaching subscription follows from broad interest.
Manual facilitation can help learn what works, but does not prove software-only
retention or economics. A good mission and a commercially viable service remain
separate claims to test.

## Delivery boundary

Keep the current Vue 3 / uni-app Mini Program, FastAPI backend and conversation
model. Reuse conversations, optional perspectives, reviewed summaries, cards,
experiments and memory controls. The immediate priority is evidence for the three
dialogue capabilities, not a new page, personality map, autonomous life agent,
mandatory four-stage flow or reminder system. Changes to model instructions or
prototype rollout need their own versioned implementation and evaluation.

## Home entry and conversational onboarding — 2026-10-24

The owner approved the following product decisions after reviewing the revised
optional onboarding. This is a future implementation contract, not a statement
that the current UI already behaves this way.

### Reason to return

Prioritize continuing something the user cares about, bringing back a real
experience and thinking about it again. Home should make that continuation
easy. A return does not imply that the user acted, improved, or still agrees
with an earlier goal. Changing the subject and pausing remain valid.

### One Home card, with Bloom on its right edge

Use a primary Home card for the user's current concern and, when available,
something they explicitly confirmed they wanted to keep. Show selected
onboarding clues accurately when no free-text title exists. Identify initial
answers as a dated starting point; do not present them as a permanent identity
or a newly confirmed current goal. Do not invent an earlier conclusion when
there is no retained, authorized record.

Place the Bloom chatbot on the card's right border, partly extending beyond
the edge, as though holding or climbing it like a vine. Bloom is an actionable
conversation entry. Clicking Bloom and the card's continue action have the
same destination: resume the relevant conversation when available, otherwise
open a new draft through the existing conversation system. Opening a draft
must not itself create a fabricated message or a model request.

**The short invitation bubble always belongs on the right side of the card,
beside Bloom**, for both first visits and return visits, whether onboarding
was answered or skipped. Keep it brief, normally one short sentence; put any
long question, answer choices or review in the conversation. Reserve room for
the character and bubble within the usable viewport, keep text and controls
unobstructed, and provide an adequate touch target. Preserve existing themes,
safe areas and reduced-motion behavior. Visual composition still needs native
simulator and real-device acceptance.

### First login: Bloom asks five prepared prompts

Prepare the existing five onboarding prompts in advance and let Bloom guide
the user through them conversationally on first login:

1. What is on your mind now?
2. What would help within the selected topic?
3. Which concrete difficulty and life conditions matter here?
4. How would you like Bloom to help now?
5. Is this what you want to keep? Review, correct, then optionally save.

Reuse the current concrete choices, conditional follow-ups, optional writing
and answer review described in [ONBOARDING.md](ONBOARDING.md). Ask one relevant
prompt at a time; do not enumerate every branch. Prepared prompts and local
branching do not need additional model calls. Conversation presentation does
not remove AI-processing consent or authorize paid generation on login.

The prompts are an optional starting conversation after authentication, not
five mandatory registration requirements. If the user does not answer them,
offer the short right-side bubble **“你想先聊聊什么？”** and let them start with
their own message. Do not repeatedly return them to unanswered onboarding
questions, require completion before chat, or restart the questionnaire for
existing users. The user's present message takes priority over a prepared
question or an earlier answer.

Review and saving remain explicit. Initial answers are a dated snapshot;
conversational collection must not automatically create long-term memory,
phase goals or decision-card conclusions. Preserve account isolation,
retention settings, deletion and correction controls. See the current
[onboarding contract](ONBOARDING.md) for the existing data and save semantics;
a later implementation must reconcile its screen-based presentation with
this approved conversational direction.

### Return visit: a short, optional continuation invitation

Keep the bubble on the card's right side next to Bloom. A suitable brief
invitation is **“想接着聊，还是有新情况？”**. With no usable context, use
**“你想先聊聊什么？”**. Personalize only from authorized, available records;
do not infer mood, progress or enduring preferences. The bubble is a local
invitation, not a generated assistant reply or a saved transcript turn.

Show it quietly on Home entry, allow dismissal for that visit, and keep Bloom
clickable after dismissal. Do not repeatedly pop it open, auto-read it, add
push notifications or request a model just to produce a greeting. Clicking
the entry opens chat; it does not automatically send a suggested message.

### Cross-page follow-through and delivery order

The agreed first Discover scope is a relevant thinking angle and a possible
way to investigate it. Concrete jobs, activities or other external resources
require a separate sourcing and freshness plan. Do not imply that a prompt
card already supplies verified real-world opportunities or enables the
default-off Perspective Shift prototype.

Carry this Home direction into the existing pages in the following order:

1. Connect the starting clues. Home, Discover and the initial-snapshot viewer
   must preserve selected topics, follow-ups and refinements even when the
   user never types a title or note. Distinguish initial answers, current
   confirmed information and the present request. Deletion or disabling must
   remove the affected material from future use.
2. Make return and revision coherent. Resume the right conversation, accept
   a new experience, and reuse reviewed summaries, cards, phase records and
   Journey history. Plan should connect attempts with observations and the
   user's choice to continue, adjust or pause. Me should make the user's
   confirmed understanding and correction controls easy to find. A phase
   goal or constraint and a chosen next step remain distinct records.
3. Improve relevant exploration. Prioritize the currently selected concern
   in Discover, disclose the actual source and allow rejection or no
   personalized suggestion. Further page layouts remain design work; these
   decisions do not authorize additional modules or extra model requests.

Acceptance must include a selection-only first visit, unanswered onboarding,
ordinary chat, a return with a new experience, a changed or paused goal,
deleted or unavailable history, multiple conversations and weak-network
recovery. Verify the right-side bubble and clickable Bloom on narrow native
screens without clipped content or duplicate conversation creation. Product
validation should examine user-owned understanding and voluntary return with
new evidence, rather than questionnaire completion or daily activity alone.

## Detailed plans for the other pages — 2026-10-24

These plans extend the agreed Home and conversational-onboarding direction.
They specify the intended experience and acceptance criteria for subsequent
implementation. They do not claim that the described behavior is already
implemented, approve additional paid calls, or enable experimental features.
Retain the existing five main navigation destinations and Journey subpages;
page names and illustrative copy below are working defaults, not a rebrand.

### Shared context and navigation contract

Every page must identify the selected exploration and keep a conversation
distinct from that exploration. A relevant topic can have several independent
conversations. Merely opening a page, previewing a suggestion or switching a
filter must not create a conversation or send a message.

| Information | Meaning and permitted use |
| --- | --- |
| Present message and response preference | Lead the current response; a topic switch does not silently replace a saved goal |
| Necessary current-conversation history | Use only under the existing retention and context contract; no silent cross-conversation transcript access |
| Confirmed current phase | A user-confirmed goal or constraint, with scope and status; not an experiment completion flag |
| Confirmed card or chosen next step | The user's exploration record or voluntary attempt; a next step does not overwrite a phase goal |
| Confirmed memory | Use only when enabled, scope-matched and authorized by the separate memory-use preference |
| Initial snapshot | Dated user-supplied starting answers, including selected topics, follow-ups and refinements; not a permanent profile |
| AI suggestion or tentative interpretation | A reviewable candidate, not a fact or formal historical event |

Preserve exact user wording where possible. If a display title is shortened or
derived from a selected option, keep the original available and do not imply
that the user approved a new interpretation. Show relevant sources and dates
on demand without filling every screen with provenance labels. Never use age
alone to mark a record invalid. No page may infer a person's current intent
from an old onboarding category or from inactivity.

Home continuation returns to the relevant conversation. Discover may offer
an angle in that conversation or an explicitly separate one, but must disclose
the destination and preserve independent drafts. Plan and Me link to records
with their exploration scope. Back returns to the caller with its scroll,
selected topic and unsent input preserved. Archived or ended content remains
read-only until the user explicitly restores it; do not restore it on a tap
that promises only to view a record.

### Conversation: think together and return with new experience

**User task and reason to return.** Express the present concern, receive
appropriate help and reconsider it after something happens outside the app.
The conversation can end with clearer understanding, information, a choice,
rest, or an unanswered question. None requires a saved artifact.

**Existing foundation.** Reuse the current conversation header, response
preferences, contextual welcome, streaming/pending UI, composer, message
actions, background disclosure, reviewed summaries, Insight and phase-change
review. Do not introduce another conversation engine or a persistent analysis
panel. Keep Perspective Shift default-off until separately implemented and
evaluated under [its contract](PERSPECTIVE-SHIFT-DESIGN.md).

**Screen order and first entry.** Keep the compact header above the transcript
and the composer available at the bottom. The header identifies the current
conversation and provides its existing management actions. The welcome area
offers a brief relevant starting point; remove it once actual conversation
content takes over. Onboarding prompts are prepared, optional interaction
content, not evidence that a model has already responded. Avoid a duplicate
welcome plus a second long summary of every questionnaire answer.

| Entry situation | Planned behavior |
| --- | --- |
| First login, willing to answer | Ask the prepared five prompts one at a time, reuse selected-topic branches and permit point selection or writing; review before saving |
| No onboarding answers or user starts another subject | Accept the current message immediately; leave unanswered prompts optional and do not repeatedly restart them |
| Continuing an existing conversation | Restore its actual transcript when available and its own draft; do not insert an invented recap into the message list |
| New experience after an earlier discussion | Accept what happened in the user's words; bring in only necessary authorized context and let the user correct the earlier interpretation |
| No retained history | Explain the available context accurately and let the user supply a starting point; do not claim to remember deleted messages |
| Archived conversation or ended exploration | Show the read-only state and a separate restore action; do not consume the user's draft or auto-generate a reply |

**Response behavior.** Respect Listen / Discover / Compare / Experiment as
changeable preferences, subordinate to the current explicit request. Listening
can be useful without a question. Comparison can give concrete tradeoffs.
Exploration may introduce one consequential distinction. An experiment must
fit the user's stated constraints. Do not make every reply a worksheet or
force all four thinking dimensions into a single answer. Use restrained warmth
and occasional context-appropriate emoji without substituting reassurance
for reality or making promises about the user's future.

For example, after "我跟家里聊过了，他们最担心的是收入", consider whether
income risk changes the useful discussion. Do not keep treating the issue as
an inability to express a wish, assume the relationship is repaired, or
silently update the person's values. If the user asks for wording for another
conversation, provide a usable draft rather than another mandatory interview.

**Return and keep flow.** A Home invitation opens the conversation without
sending. An optional "有了新经历" entry can offer an editable starter, but
must preserve existing input and require a send action. When the user wants
to keep something, open a review with editable wording, destination and scope.
Reuse the relevant summary, card, Journey or memory flow. Saving one does not
implicitly save the same content to all the others. Offer a change review only
for a grounded important conflict; skipping it must not lead to repeated
persuasion. Do not generate a paid summary automatically when leaving chat.

**Waiting, actions and failures.** Preserve incremental final-answer display
and honest progress states; never expose raw private reasoning or simulate
a reasoning transcript. A stopped or failed partial reply must not become a
confirmed conclusion. Keep the composer stable, show the user's submitted
message once, and prevent duplicate sends. Copy, native text selection,
selection-based follow-up, editing and optional Read Aloud must keep input
accessible. Speech reads only visible final assistant text after its separate
consent and an explicit tap, and stops on conversation change.

Follow the user's reading position: stay with the latest reply when already
at the bottom, stop following when the user scrolls upward, and provide an
explicit return-to-latest action. Reserve measured composer clearance once.
Put actionable chat failures immediately above the composer, preserve the
draft, and clear an error only after successful reply or verified recovery.
Never automatically retry or escalate a paid request. Consent, budget and
offline states must have distinct safe messages and appropriate next actions.

**Acceptance.** Cover point-selection onboarding, skipping halfway, direct
advice, listening, temporary topic change, current wording contradicting an
old snapshot, refusing a suggested update, no retained history and deletion
while a response is pending. Verify conversation isolation, request recovery,
single-message rendering, source disclosure and confirmed-save readback with
Mock providers. Native acceptance must cover long replies, text selection,
keyboard dismissal, scroll-follow behavior, inline consent/errors and speech
cleanup. Mock correctness is not proof of insightful real-model conversation.

### Discover: relevant possibilities with a clear basis

**User task and reason to return.** Find a useful way to reconsider the current
concern, another option worth investigating, or a small way to learn more.
The first delivery is a grounded thinking entry and an investigation method;
it is not a feed of verified jobs or activities.

**Existing foundation.** Reuse the source-attributed candidate mechanism,
intent labels, dismissal and rotation controls, editable chat starters,
existing visuals, optional Bloom Moment and Journey entry. The current source
adapter must be extended to cover selection-only onboarding and the selected
exploration; do not infer this capability from the presence of three cards.

**Screen order.** Start with a compact indication of which concern is being
considered and a deliberate way to switch it. Put relevant angles before
optional general inspiration. Display only as many useful entries as the
available evidence supports, normally one to three; never fill a quota with
reworded questions. Keep Bloom Moment secondary, collapsible and user-opened.
Journey remains an available history link, with equivalent access from Plan
and Me so the user need not discover it through this page alone.

**Candidate content.** Each personalized entry should contain:

1. A short title stating the distinction or possibility.
2. The actual user-supplied clue, with a compact source label and a way to
   inspect its wording, date and exploration when relevant.
3. A tentative angle or question that adds something beyond restating the clue.
4. An optional way to learn more, such as observing a real situation, preparing
   a conversation or trying a bounded task. This is not an assigned action.
5. One clear exploration action, with quiet rejection and source controls.

Distinguish selected onboarding answers from a confirmed decision card or
memory. Preserve source permission, enabled status and scope. Ranking may
use the selected concern, applicable confirmed records and user feedback;
do not mine unrelated transcripts or infer hidden psychological motives.
An old clue can invite verification without being declared invalid by age.

For a user who selected "知道自己想要什么，但难以表达", an angle might
distinguish preparing the words from negotiating room for a stated choice.
For "不想失去稳定收入", an angle might explore how to learn about another
direction while preserving current income. Both are invitations the user can
reject, not conclusions about character, risk tolerance or family dynamics.

**Action and navigation.** Previewing a card is read-only. Its exploration
action opens the disclosed conversation destination with editable text; it
does not send or mark a real-world experiment complete. Default to the relevant
conversation when continuing that discussion; offer a clearly separate new
conversation when the user wants one. Never silently import another thread.
If the existing draft differs, preserve it and ask before replacing it.
An ended exploration or missing source must be checked again before navigation.

"不太适用" should remove that suggestion under the existing feedback policy
without becoming a permanent trait. Keep unrelated visible cards stable.
"换一组" is a deliberate local interaction, not a background refresh or a
model request. Returning to a tab should not keep replacing a card the user
was reading. Context deletion or permission changes invalidate affected cards
and drafts; do not silently relabel them as generic to retain private wording.

**Empty, loading and failure states.** Separate no personalized evidence,
exhausted or rejected suggestions, loading and failed loading. An honest
empty state can offer direct chat or optional clue entry. If generic material
is offered, label its general provenance and do not promise personalization.
Do not refill refusals with near-identical personalized questions. A failed
refresh preserves only still-authorized visible content and offers explicit
retry; it must not display a fabricated new recommendation. A withdrawn source
disappears even if refreshing other data fails.

**Bloom Moment boundary.** Keep its existing separate generation/consent,
retention and budget behavior. Entering Discover must not automatically open
or generate it. Optional inspiration can support rest and curiosity without
claiming to reveal an overlooked value or demanding a plan.

**Acceptance.** Verify relationship, overload, job-search and AI-change paths
with no written title or note; multiple explorations; explicitly switching
focus; no sources; every suggestion rejected; source deletion; memory use off;
changed constraints; archived destinations; existing drafts; loading failure
and repeated taps. Inspect the actual context passed after sending. Confirm
that card rotation uses no model call and that clicking or rejecting a card
neither changes memory nor records completed action. Evaluate separately
whether users find an angle useful enough to investigate.

### Plan: voluntary attempts and what the user learns

**User task and reason to return.** Keep a chosen attempt manageable, record
what happened, and decide what to continue, change, pause or stop. A plan is
not a productivity obligation or proof that the user has clarified their life.
Retain the Plan navigation label for this delivery; renaming is not required.

**Existing foundation.** Reuse the current exploration card, chosen next-step
field, experiment review, feedback history and Journey records. Experiment
drafts already express an action, observations/tests, effort and a stop rule.
Map their round-trip behavior before implementation; do not introduce a new
task database, habit system or inferred completion state to support the layout.

**Screen order.** Identify the selected exploration, then show the chosen
attempt if one exists, the most relevant observations, and the user's next
choice. Keep the full decision card available in an expandable section.
Fold empty optional fields rather than presenting a checklist to complete.
An empty plan can offer "先聊聊" and "自己留下一步" without preselecting work
or asking the user to become more productive.

**Attempt content.** Present the user's existing words for what to try, what
they hope to learn, their available time/cost/energy and any stopping boundary.
Missing details remain missing; optionally invite clarification rather than
invent a deadline, budget or success target. These are proposed learning
conditions, not externally verified outcomes. Keep the relationship between
the attempt, its exploration and its original source visible on demand.

| User action | Planned behavior and persistence boundary |
| --- | --- |
| Choose or edit an attempt | Review the editable proposal, relevant constraints and destination; explicitly save using the current version |
| Record what happened | Offer free writing first, with optional prompts about what occurred and what surprised the user; save only on explicit action |
| Continue | Keep the chosen step or save a user-edited revision; do not create a new scheduled task |
| Adjust | Preserve observed facts separately from a proposed interpretation; confirm changed wording and any history choice |
| Pause | Permit rest or lack of capacity without a failure label; use an explicit pause record without pretending an unimplemented task-status field exists |
| Stop or remove a step | Permit clearing the chosen next step; do not automatically delete memories, end the exploration or rewrite its phase goal |
| Discuss an observation | Open the relevant conversation with the user's selected material available for review; do not send it automatically |

The observation prompts are optional: "发生了什么？", "和想象有什么不同？"
and "现在更想继续、调整，还是先放一放？". Do not require all three or turn
a recorded feeling into a durable belief. A useful observation may be that an
attempt is unaffordable or uninteresting, or that the original question has
changed. Do not require a successful result before allowing a record.

**Decision card and timeline.** Keep options, real constraints, confirmed
information, hypotheses and unknowns distinguishable. AI material enters as
an editable draft. Clarify whether a value was supplied during initial setup
or confirmed later; do not label all defaults as reviewed conclusions. Plan
shows recent observations relevant to this exploration and links to the same
Journey sources, rather than copying events into a second timeline. Define
a stable event identity and source mapping so an existing feedback entry is
not shown again as a separate Journey event.

**State and failure handling.** Permit no attempt, an active attempt, a user
record of pause/change, and an ended exploration without inventing progress
percentages. Respect existing end/resume behavior and distinguish clearing a
step from ending its exploration. On save failure keep the form, text and
selected exploration. On a version conflict keep the draft and offer the
latest saved record for comparison; do not overwrite it silently. Successful
saves must read back consistently on Home, Plan and Journey. With AI consent
off or model quota exhausted, user-authored records and existing cards remain
available under their own permissions.

**Acceptance.** Cover no plan, a manually written step, an AI proposal edited
before saving, observations without action, fatigue and pause, removing a step,
changed income constraints, failed save, double tap and concurrent edit.
Verify that an observation is not silently promoted to long-term memory and
that clearing a step does not erase a phase goal. Follow one record between
Plan, Journey and Home and confirm there are no duplicates or stale copies.
Validate with users whether the attempt taught something relevant, not just
whether the completion control was used.

### Me: inspect and correct what Bloom is allowed to understand

**User task and reason to return.** See the current understanding, change it
when life changes and control what may be saved or used. The page must make
correction approachable without presenting a permanent personality profile.

**Existing foundation.** Reuse current-direction and initial-snapshot views,
memory creation/editing/merging/deletion, status and scope controls, Journey,
response preferences, account settings, themes and privacy settings. Reorder
and clarify these surfaces; do not create a second personal-profile store.

**Screen order.** Keep the account identity compact. Put a group for "我目前
在意的" and "我确认留下的" near the top, followed by initial answers and
change history. Keep privacy/AI processing, chat retention, memory use, speech,
response defaults, themes and account actions easy to find in clearly named
groups. Never hide deletion or revocation behind a decorative self-discovery
screen. Sensitive details may remain behind an entry rather than exposed in
full on the first screen.

| Surface | Required content and actions |
| --- | --- |
| Current phase | Show goals and constraints with applicable exploration, source, status and confirmation/verification dates when recorded; create, edit, disable or delete through the existing controls |
| Confirmed memories | Show original content, category, global/exploration scope and enabled status; inspect source, edit, merge with review, disable or delete |
| Initial answers | Show collection date/source, selected topics, follow-ups, refinements, notes, life conditions and chosen response preference; preserve unanswered fields as unanswered |
| Change history | Link to the existing Journey view and appropriate exploration; preserve the distinction between an initial answer and a later user-confirmed change |
| Use in replies | Explain the independent memory-use preference and actual enabled/scope behavior; saving a record alone does not turn it on |
| Response defaults | Describe a default for new conversations; preserve a current conversation's explicit choice and prioritize its current message |

**Correction flow.** Open the selected record with editable wording and its
scope. For an important replacement show which current item will change and
offer the existing history choice. Confirm before saving, use its version,
then read back. Do not merge contradictory records automatically, or infer
that a one-off "今天太累了" replaces a long-term wish. "待核实" is a record
state requiring attention, not a declaration that the person is inconsistent.
Historical records are not current instructions and do not expire solely
because time passed.

For initial answers, distinguish viewing/removing the dated snapshot from
confirming a new current direction. Do not rewrite the original collection
date when the user changes their mind. Reuse existing correction paths where
available. If per-answer snapshot editing needs an API change, document and
validate it before exposing the control; do not promise editability the
existing endpoint cannot deliver. The new five-prompt presentation does not
require older users to re-register or complete missing answers.

**Privacy and deletion.** Explain the effect at the point of action. Disabling
memory use stops its context use while leaving independently saved records
manageable. Disabling chat retention follows its existing immediate transcript
and summary purge contract; it does not erase separately confirmed records.
Deleting a snapshot or memory removes that source from future context and
personalized surfaces, without falsely claiming that words already present
in retained transcripts have been retroactively erased. Explain independent
records with unavailable sources and let the user manage them separately.
Revocation must also invalidate affected in-flight work under existing rules.

**Empty and failure states.** Offer manual entry without requiring onboarding.
Show whether no record exists, memory use is off, or loading failed; do not
collapse them into a single empty profile. Keep editing text on failure and
present version conflicts without overwriting. Keep saved/disabled/deleted
state accurate across pages and account switches. Destructive operations need
the existing explicit confirmation and ownership checks.

**Acceptance.** Verify full selection-only snapshot readback, empty answers,
editing and scope, disabling, merging, changing a phase goal with and without
history, deleting an initial snapshot, removing a source conversation and
turning memory use off. Test two accounts, stale versions, failed deletion,
retention revocation and pending-generation invalidation. Confirm that Me,
Home, Discover and the actual assembled model context agree after changes.

### Journey and record detail: user-owned history, not a growth score

**User task and reason to return.** Revisit something the user chose to keep,
see what happened in context and revise the account without having to defend
past choices. Journey remains an existing subpage, not a new primary tab or
an automated biography.

**Existing foundation and entry.** Reuse the current timeline, exploration
filter, record detail, pending candidates, editable records, source links and
next-step controls. Provide contextual links from Home, Plan, Discover and Me
with the correct selected exploration. A global view can be explicitly chosen.
Back preserves the calling page and its position; do not always label it as
returning to Discover when the caller is another page.

**Timeline structure.** Start with an exploration filter and a brief reflection
only when backed by an actual authorized record. Present dated user-confirmed
items in a stable order with their exploration, kind and short excerpt. Existing
thought, decision, change, action and pause types describe records, not user
types. Keep the pending-candidate entry separate from confirmed history.
No growth percentage, streak, personality evolution or inevitable upward
story should be inferred from the number or age of records.

**Detail and review.** Show full text, date, record kind, exploration and source
availability. A source preview reveals only authorized available material.
Keep an independently confirmed record readable when its original conversation
has been deleted, and state that the source is unavailable. Permit editing
and deletion where the current record contract allows them. Read-only derived
events must say what can be changed at their source rather than offering a
nonfunctional edit action.

AI candidates remain in a review area with editable wording, the source and
any uncertainty. Only explicit save creates a formal record; skipping a
candidate does not become rejection of the topic or a permanent preference.
Do not generate an extra model summary to populate an empty timeline. A
Journey record is not automatically a memory used in replies, a current phase
goal or a next step; each requires its own explicit destination and consent.

**Consistency and failure states.** Reuse source identities when showing
feedback or chosen steps on multiple pages. Loading more must not duplicate
events, reset the filter or jump the reader. Preserve edits and review choices
when saving fails. After correction or deletion, invalidate affected previews
and re-read the current state. Respect existing history/deletion choices;
do not retain a hidden duplicate to keep a visual narrative complete.

**Acceptance.** Cover an empty timeline, several explorations, filtered
pagination, same-time events, a pending candidate edited then saved, a skipped
candidate, failure and retry, missing source, manual correction, deletion and
account switch. Confirm event deduplication across Plan and Journey and that
changing a record does not silently rewrite a separate memory or goal.

### Delivery batches and evidence for the page plans

Keep the delivery order above, with the following reviewable outputs. Each
batch must identify what is implemented, what remains planned and which
surfaces were actually verified. Mock data and design copy are not evidence
that real users gained agency or that real-model replies have the intended
quality.

| Batch | Deliverables | Evidence required before claiming completion |
| --- | --- | --- |
| 1: starting-point consistency | Shared clue/source mapping; complete point-selection display on Home, Discover and Me; dated snapshot/current-context distinction | Mock contract and readback tests for selected-only and skipped answers, deletion, scope and two-user isolation; no extra model calls |
| 2: return and revision | Home/Bloom entry; conversational five prompts and skip path; relevant-chat continuation; observation entry; Plan/Journey consistency; reachable correction controls in Me | End-to-end flows from actual entry through save/readback and return; failures, conflicts, retention, drafts and old-user compatibility; native keyboard/scroll/short-bubble acceptance |
| 3: useful possibilities | Current-topic Discover ordering, source-inspectable angles, honest empty/refusal states and editable conversation handoff | Source-grounding, rejection, stale-destination and draft tests; separate qualitative comparison of useful distinctions and choices in a bounded career scenario |

For implementation, run applicable frontend and backend tests, type checking,
backend lint and the WeChat Mini Program build check. Use isolated Mock
providers and disposable databases. Native simulator acceptance and real-device
checks must separately cover narrow screens, larger text, theme contrast,
touch targets, scroll position, keyboard access, disabled/loading controls and
weak-network recovery. H5 screenshots and compiler success alone are
insufficient. Documentation-only edits do not constitute these checks.

The product study should ask what became clearer, what the user still does
not know and whether a real observation changed their choice. Compare a
bounded useful outcome with general-purpose AI, and investigate voluntary
return when there is new experience. A user choosing rest or no longer needing
Bloom is a valid result. Do not add daily-use pressure, dependency incentives
or unsolicited reminders to improve a retention metric.
