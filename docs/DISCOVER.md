# Discover: grounded angles

Implemented on 2026-10-25 against the Discover section of PRODUCT_DIRECTION.md.

## Experience

Discover starts with the selected exploration and an explicit topic selector,
including a no-topic choice. It presents up to three source-backed angles,
with the first expanded. Each card exposes its actual clue, source category,
record date, tentative distinction and optional investigation method.
Bloom Moment remains secondary and user-opened. Its image, title and actions
are always visible; only its reading body folds. Journey receives the selected
exploration filter.

The local adapter in `discover-angles.ts` reads selected onboarding answers,
refinements and notes, the actual question, confirmed constraints, unknowns,
and saved experiences belonging to the selected exploration. It does not read
other conversations or memories, and performs no model request. Rest/listening
answers can yield no suggestion. This is a bounded rule-based implementation;
it does not enable the default-off Perspective Shift prototype or establish
that users find these suggestions useful.

Dismissal retains the existing temporary feedback policy and removes the
selected card without filling its slot. Tab returns retain the current batch,
expansion and scroll state. No evidence, exhausted suggestions, loading and
loading errors have distinct states. Unverified refresh failures hide source
content and offer retry; they never substitute generic wording.

## Conversation and source boundaries

### Visual reading revision

Following user feedback, angle thumbnails are restored from the existing
color visual library, with bundled picture fallbacks. No-evidence and exhausted
states now include two illustrated editorial psychology readings. They are
clearly labelled as general reading, use no personal records, and never become
personal recommendations or model context. Reading and expanding are local.
Sources can be copied from each expanded article:

- https://www.psychologytools.com/self-help/thoughts-in-cbt
- https://self-compassion.org/exercises/exercise-5-changing-your-critical-self-talk/

The redundant outer Bloom Moment accordion is removed. Its own fold affects
the body only; its photograph, title and entry action remain visible, and
consent/error controls remain accessible. Generating a new moment unfolds its
body after the user's explicit action. This supersedes the earlier whole-slot
folded-inspiration acceptance note below.

Opening an angle rechecks its source and destination, then prepares editable
text in the active matching conversation or most recent unarchived match.
The separate-conversation action starts a local draft. If the destination
already has different unsent text, a confirmation offers to preserve it and
open a separate draft. Clicking a card neither sends a message nor creates a
server conversation. Repeated navigation taps are guarded.

The selected source is checked again before sending. Context changes from Me
also revalidate outstanding Discover drafts. A revoked source clears an
unchanged generated draft or removes its exact quoted excerpt from an edited
draft, leaving an actionable notice. The implementation does not attempt to
identify user-rewritten paraphrases. Long clues are explicitly excerpted in
the starter so it fits the message limit; the full source remains inspectable.

## Validation and limits

### Glass and postcard refinement — 2026-10-25

Direction: quiet frosted reading cards and a photographic postcard for Bloom
Moment. Reuse theme glass tokens and existing artwork. The reference is the
user's current Discover screenshot; this is a component refinement within the
existing brand, not a new page direction.

- Angle headings are static title/photo groups. A fine divider separates them
  from the clue and source rows. The source row has two independent controls:
  labelled source inspection with a rotating chevron, and explicit 展开/收起
  for the angle body. Both retain 44px touch targets and expanded-state labels.
- Angle and general-reading cards use translucent theme fills, a fine highlight
  edge, inset light and backdrop blur. The fill remains present without blur.
- Bloom Moment uses a broad photograph with a dark caption scrim, a compact
  edition/date line, a separate title and one full-width primary action. The
  second companion avatar was removed from the card to keep the photograph and
  action clear alongside the persistent central navigation control.
- The photograph and title survive folding. Consent, retry and personalization
  controls retain their existing behavior. No new generation is triggered by
  reading, folding or source inspection.
- Feedback uses immediate press states, 180ms chevron rotation and a short body
  reveal. Reduced-motion preferences disable the reveal and rotation animation.
  Repeated entry receives no extra introductory animation.

Actual H5 screenshots are in `output/discover-glass/`: dark and forest at
390 x 844, dark at 320 x 740, plus a generated/folded moment at 320 x 740.
The narrow viewport had document width 320px. Independent angle folding and
source inspection, generated-content folding/reopening and loaded artwork were
exercised with isolated Mock data; paid request count stayed zero. Typecheck,
22 focused tests across 3 files, and native compilation (37 WXSS / 59 WXML)
passed. These do not establish native simulator or real-phone acceptance.
One independent static review (agent `/root/discover_visual_review`) preserved
the photographic direction and identified excessive corner radii plus a
narrow-screen generated-state masthead alignment issue. Outer radii were
returned to the documented 10px limit and the masthead was vertically aligned.
The corrected 320px generated/folded state was recaptured with Oil UI's
screenshot tool in `output/discover-glass/final-verified/page.png`; its report
found no console errors, horizontal overflow or failed images.
There was no independent live UX review for this local visual refinement.

Follow-up ornament and action refinement: a symmetric three-line flourish with
a small botanical jewel separates Bloom Moment from preceding content. The
primary Moment action uses the Me logout button's `nav-gem-hi` to `nav-gem-deep`
gradient, raised rim and soft light, enlarged from 48px to a 60px minimum height
with a centered 16px label and arrow. Its 4.8-second light breath and 140ms press
feedback are disabled or reduced under reduced-motion preferences; disabled
buttons stop breathing. The ornament is decorative and non-interactive.
This follow-up passed typecheck and native compiler checks. Actual 390px and
320px captures are in `output/discover-gem/final/`; the report found no console
errors, horizontal overflow or failed images. Its nested-card heuristic flagged
the raised primary button, which is intentionally retained as the user-requested
Me logout-style action, not a nested information card.

The user's subsequent screenshot clarified the reference as a dark transparent
outline button rather than the gem-gradient source rule. The Moment primary
button now uses the theme background, a fine luminous edge and soft shadow,
retaining its 60px target. Fine-pointer hover raises it 2px and brightens the
edge; touch uses the existing immediate pressed class. No continuous breathing
animation remains. Each body expansion has a short reveal; a labelled 收起正文
control is available after the text as well as the top fold toggle. Folding is
local and preserves the photograph, title and existing generated content.
Validation: typecheck, 7 Moment tests and native compilation passed. The H5
interaction exercised hover, opening, 收起正文 and reopening via 展开读一读.
Frames in `output/discover-outline/interaction/` show that sequence's final
expansion; the screenshot tool could not export MP4 because ffmpeg was absent,
so its recording report is marked failed despite no interaction issue being
listed. Do not treat that recording report as a complete video acceptance.

Unit coverage includes selected-only relationship, overload, job-search and
AI-change clues, source removal, scope, account isolation, loading failure,
dismissal/exhaustion, stable batches, conversation selection and long sources.
Final checks passed: `npm run typecheck`, all 48 UI test files / 265 tests
(`npm --prefix apps/miniprogram test -- --maxWorkers=2`), and `npm run build:mp`
including 35 WXSS and 57 WXML compiler checks. A preceding concurrent run hit
an unrelated test timeout; the bounded-worker full rerun passed.

Isolated H5 QA used a disposable Mock API on port 8023. Forest was inspected
at 390 x 844 and 320 x 740; dark at 320 x 740. Both narrow checks had document
width equal to viewport width. Source preview, editable handoff, preserving
an existing draft through the separate-draft confirmation, no conversation
creation on entry, rejection to an empty state, no-topic selection and folded
inspiration were exercised. The Mock status reported zero paid requests.
Screenshots are under the ignored `output/discover-design/` directory.

Native simulator acceptance remains pending: the isolated tourist project on
automation port 9460 failed in miniprogram-automator's SDK version check
because SDKVersion was undefined (`reading 'split'`). The helper is
`tools/verify-discover-design-native.cjs`. H5 evidence and native compilation
must not be described as native simulator or real-device acceptance.
Source-revocation send behavior is guarded in the implementation but still
needs native interaction acceptance and inspection of the resulting context.
