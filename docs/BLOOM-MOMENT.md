# Bloom Moment — a little curiosity, without a problem to solve

Discover now offers one optional experience before its existing conversation starters.
Home no longer renders or reads Bloom Moment.
A visit only reads today's state. Opening the invitation, or explicitly choosing
**Another**, creates at most one provider request. No notification, background
generation, streak, deadline, reward schedule or additional model reviewer is
introduced. The existing Discover questions and personal journey entry stay available.

## Experience

Four flavors are selected from eligible types, preferring those not recently
shown: a perspective, a small experiment, an echo from the past, or a light
imaginative moment. Without authorized sources, only experiment/light are
eligible. A refusal rests that flavor for two subsequent experiences; it is not
a psychological or personality inference. Exact fingerprints and retained-text
similarity reject recent repetitions. A rejected candidate does not cause an
automatic replacement request.

The six existing palettes, typography, small radii, CompanionAvatar and published
visual resolver are reused. Artwork changes locally with date, experience and
theme. The resolver uses verified cloud assets when configured and local variants otherwise.
Missing eligible artwork falls back to a real compatible image or
text; it never invents a filename or invokes an image API. No new asset dependency.

**Chat about this** opens an editable, unsent, independent conversation draft.
AI invitations and dated user quotes are explicitly distinguished in that draft.
No conversation/exploration is created until the user sends; existing drafts
survive. Dismissal saves no text and never triggers another generation.

## Evidence and consent

AI consent is required. A separate, unchecked choice on the card enables use of
up to three enabled, active, explicitly confirmed **global** memories, and only
if account-level memory use is also enabled. Exploration-scoped memories,
transcripts, inferred traits, pending cards and another conversation's context
are never read. First release intentionally does not infer a current stage from
those records. Generic experiences do not send memories.

Personal facts appear only as server-validated exact quotes with their confirmed
date. Sources must belong to the current account and supplied source set;
source version/content/authorization is checked again before display and on
cached reads. Past statements are never declared current facts. Recent rejected
or revoked personal content is not sent back to the model. Rules reject private
channels, unprovided quotes and common unsupported biographical assertions.
These checks establish provenance, **not semantic truth or reliable creativity**.

Content retention follows the existing chat-retention setting. Turning it off
or revoking AI consent clears stored Moment content. With retention off a final
response is available only in the current app session; a restart cannot recover
it. Reopening never silently pays to recreate it. Opaque slot, fingerprint and
refusal metadata remain for idempotency/diversity; account deletion removes them.
Billing-only AIRequest records and the existing monthly ledger survive deletion.
No automatic memory, decision card or journey entry is created.

## API and storage

- `GET /api/moments/today`: read the current Shanghai-calendar-day slot; no model.
- `POST /api/moments/open`: UUID, `open|another`, previous slot ID, personalization.
- `POST /api/moments/{id}/dismiss`: owner-only, content-clearing refusal; no model.
- `bloom_moments`: ID, owner, unique AI request key, day/ordinal, flavor,
  optional retained content, fingerprint, dismissed flag and creation timestamp.
- `AIRequest.kind=moment`: billing metadata only; shared monthly and daily quotas.

SQLite development creates the additive table through normal metadata startup.
PostgreSQL requires `20261023020000_bloom_moments.sql`. Its RLS table is accessible
through the authenticated backend, not public client roles. The development
verification does not apply this migration to a private or hosted database.
Until deployed, the endpoint fails safely and Discover offers an explicit read retry.

## Reliability and cost boundary

The account row serializes admission across workers; the monthly ledger's atomic
conditional update reserves funds before dispatch. A unique account/day/ordinal
and unique user-derived request key prevent double generation. Daily first-open
requests with different UUIDs still resolve to the same slot. Another requires
the latest slot ID. There is at most one in-flight Moment per account.

The existing configured DeepSeek model, Thinking setting, 4096 maximum output
and CNY 100 monthly AI budget are unchanged. Moment uses low reasoning effort;
it has its own prompt and JSON contract, never appends to the frozen conversation
evaluation prompt. Evaluation-guard app instances reject the feature entirely.

Messages over 24,000 serialized UTF-8 bytes are refused without truncation. The
normal app's existing reservation estimate includes serialized bytes plus framing
allowance and peak output pricing. This is **not a proof of hosted input tokens**
and does not unblock the fixed CNY 3.05 live evaluation. No new claim of a hard
provider-invoice cap is made. Reported usage is validated before settlement;
anomalous usage retains the original reservation and fails closed.

No SDK retry, model fallback, JSON repair call, or silent next candidate. Timeout,
cancellation, network failure and uncertain billing keep their reservation.
A crashed pending request is exposed as unknown after three minutes; an explicit
new attempt marks it unknown without refunding it. Valid usage from an invalid
candidate settles actual estimated cost, but no candidate is displayed. Raw
provider reasoning is never read into the application contract, logged or stored.

## Verification and remaining work

Automated cases use MockTransport and disposable SQLite; native fixtures use
`tools/mock-moments-api.py` on 8030 and a separate tourist project on automation
9450. No production account, budget ledger, environment file or fixed evaluation
input is modified by QA. Build/capture procedure is in the native helper header.

Validation results and native acceptance are recorded after execution below.
Real-model freshness, non-offensive personalization and user willingness to return
remain unverified. A later opt-in study should manually review source accuracy,
novelty and tone, then ask whether people found a Moment worth opening; no paid
judge, engagement pressure or inference from a refusal is needed.

## Acceptance record — October 23, 2026

- Final shared working-tree API suite: 255 passed, one disposable-PostgreSQL test
  skipped. The Moment suite passed all 17 cases, including
  oversized admission, provider parameters and in-flight consent revocation.
- Shared frontend: 164 tests passed; TypeScript and Ruff passed; two tool tests
  passed. Normal WeChat build succeeded with existing Sass deprecation warnings.
  The installed Nightly compiler location was checked separately: 19 WXSS and
  46 WXML files passed. The final build contains no fixture API URL.
- A clean export containing only this feature over committed HEAD independently
  passed TypeScript, 135 frontend tests, and the 17 Moment API tests. Unrelated
  streaming, reasoning and homepage changes are excluded from the commit.
- No paid model request was made. No environment values, private account data,
  budget receipts or frozen evaluation files were rewritten.
- Native simulator acceptance is **not complete**. The installed Nightly
  2.01.2602282 tool launched the separate tourist project, but Tool.getInfo
  returned no SDKVersion and miniprogram-automator failed before interacting
  with the app. A Windows firewall permission dialog was also observed; network
  permissions were not granted or weakened. No screenshot is claimed as a
  successfully rendered Moment or a passed six-theme interaction test.
- The isolated fixture/API and native acceptance script remain reproducible.
  Physical-device typography, safe-area behavior and real model quality require
  subsequent verification. The PostgreSQL migration is prepared, not applied.


## Discover refinement — October 23, 2026

North star: a small personal letter in Discover, with readable words and a bounded
photograph. This is an optional curiosity entry, not a task, streak or reward.
The user explicitly requested the installed `oil-ui` workflow. Existing product
palettes, heading fonts, SVGs, CompanionAvatar and the five-link navigation remain
in use; no additional design system or raster asset was introduced.

- Remove Discover's 470px atmospheric hero and its 236px introductory spacer.
  Begin with one concise invitation, then the Moment, then existing questions.
- Replace the stretched, full-height image strip with a 76 × 94px photographic
  frame (62 × 80px below 360px). A subtle three-degree tilt distinguishes this
  letter from the surrounding question list. Images never size themselves from
  model-generated text; an image failure hides the optional artwork.
- Read the opened content at full width. Use 15px body text, an 18px question and
  13px source/disclosure text. Wrap short phrases at actual punctuation boundaries on narrow screens, preserving all response characters.
  Exact source quotes, dates and AI/demo disclosure remain visible.
- Give opening/chat a single filled primary action. Another/dismiss remain plain
  secondary actions. The optional memory checkbox stays unchecked by default.
- Existing Discover questions use open rows and 60 × 70px thumbnails rather than
  large glass cards. The Plan page retains its original hero and layout.
- Reuse page-entry motion, add 130ms immediate press feedback and a 220ms reveal
  only when new content arrives; reduced-motion preferences disable displacement.
  There is no decorative loop, typing delay or fabricated generation progress.
- Remove the repeated unopened headline and uppercase introductory eyebrow.
  Keep one product name, one date, the invitation, action and necessary disclosure.

GET reconciliation now runs when entering Discover or resuming the app there.
Opening, consent, another, refusal, retention, unsent drafts and backend request
boundaries are unchanged. The home empty-state condition also excludes the
already-rendered home view, preventing a second dashboard below it.

The user reports that the Supabase SQL is configured. This pass neither applies
migrations nor reads production records; it changes no environment, provider,
monthly budget or frozen live-evaluation configuration.

### Reproduction

`tools/verify-moment-discover-h5.cjs` is an auxiliary browser check using the real
Vue page, isolated `tools/mock-moments-api.py` on 8030 and an H5 preview on 5187.
Set `PLAYWRIGHT_MODULE` / `PLAYWRIGHT_BROWSER` to an existing local installation
when needed. The fixture validates its own marker before interacting, creates
only synthetic accounts and never uses a provider key. Its script checks:

- No Moment on Home and no Moment request from Home; visiting Discover only reads.
- Separate consent, explicit generation, refresh readback and no duplicate call.
- Failed dismissal preserves content; explicit recovery and dismissal do not pay.
- Another and optional confirmed-memory quotes; chat opens an unsent new draft.
- All six themes, 320/360/390/430px widths, bounded photos and reduced motion.
- Exhausted budget preserves the current content and produces no automatic retry.

Evidence is in `output/moments/discover/`, with baseline screenshots in
`output/moments/before-home.png` and `before-discover.png`. The screenshot helper
waits for uni-image's background to load and the arrival state to finish; checking
only `document.images` incorrectly captured still-loading placeholders.

The native helper now enters Discover, verifies Moment absence on Home and checks
photo bounds. Its isolated tourist project copies the repository's configured SDK
version. Native simulator acceptance remains separate from H5 and compiler checks.


### Verification of the refinement

- TypeScript passed; the existing frontend suite passed all 167 tests.
- Formal WeChat build and the user's development artifacts both passed the
  installed native compilers: 20 WXSS and 47 WXML files each. The development
  `ChatVisual.js` is present and its import resolves. The reported missing-component
  error was not reproducible in the current complete build; a watched importer
  was touched to trigger dependency re-evaluation without changing chat code.
- The final auxiliary H5 flow passed three consecutive runs, each covering eleven
  viewport/theme layout checks plus the interaction/error cases above. Each run
  reported zero page exceptions, zero failed image requests and zero paid requests.
- One independent screenshot review, following oil-ui's existing-interface polish
  protocol (no numerical score), identified a narrow-screen word break and a
  redundant light-flavor subtitle. Both were corrected. Source labels and the demo
  disclosure were retained because they communicate provenance. Final 320px
  phrase wrapping was visually checked by the implementing agent.
- H5 visual evidence covers 390 × 844 and 320/360/430 × 740. Static review cannot
  establish motion quality or native rendering. Press/reveal transitions remain
  short and reduced-motion-safe; no frame-rate claim is made.
- Native automation still fails before entering the app because the installed
  Nightly's tool handshake does not supply the SDK version expected by
  miniprogram-automator. This is **not** a passed simulator or physical-device test.
  No SDK values or successful UI results were fabricated to bypass that failure.
- Existing Sass legacy-API deprecation warnings remain. No API/provider code was
  changed; production accounts, SQL migrations, environment files and all budget
  ledgers were left untouched.


## Tactile action, optional reading, and companion gaze — October 23, 2026

The primary Moment action uses the existing New Conversation color tokens with a
softer finish. All six themes supply its highlight, body and shaded edge. The
strong bottom ledge is removed: a soft 1px contact shadow, restrained inset light
and 1px press travel retain a little depth. The unchanged 8px radius and compact
footprint keep it part of the small letter. No repeating shine or decorative loop
was added.

A **Collapse / Expand** button defaults to expanded. Collapsing removes the body,
photo, sources, actions and companion, leaving the title and edition header. It
changes only view state and never deletes, regenerates or sends the Moment. Errors
and uncertain-request recovery stay visible outside the fold. A fresh view starts
expanded; no new preference or personal record is stored.

The old operational footer is replaced by a human invitation. The adjacent More
SVG opens the factual AI attribution and retention explanation. The demo notice
remains visible in demo mode; a warm sentence never masquerades as generated
personal understanding or changes the existing retention setting.

`CompanionAvatar.vue` now owns the optional gaze interaction, shared by Moment,
the chat welcome, and the latest assistant reply. Historical message avatars do
not subscribe to the gaze feed. Only the pupils are independently composited with
native views; the original raster and greeting/thinking states are reused. While
gaze is active the image rests so its eyes stay aligned. A native-only
accelerometer feed calibrates to the first comfortable holding position.
Subsequent tilt changes a bounded, smoothed gaze. Pointer movement and an
unblocked touch drag offer a local alternative. No camera, eye tracking, face
detection, storage, telemetry or model request is involved.

`companion-gaze.ts` owns its exact native listener, rejects invalid/violent input,
limits updates, and prevents stale start callbacks from interfering with a newer
subscription. Collapse/unmount, tab/page hide, greeting, thinking and speaking
stop the feed and reset the gaze. Chat gaze pauses while a reply is pending. Browser reduced-motion and visibility changes also stop
it. Sensor failure quietly leaves ordinary greeting/touch interaction available.
Nothing retries a paid request or generates tool-like progress.

The explicitly requested installed `oil-motion` skill was read. Its stated scope
excludes CSS/JS/SVG microinteractions; this eye-only input mapping uses that local
frontend path rather than video generation, an atlas, a credential setup or an
external animation service. This pass is a focused self-review of the changed
component, not a new whole-page design review.

Verification uses six offline controller/native-adapter cases plus the existing
frontend suite. The H5 acceptance script additionally checks default expansion,
collapse/reopen without a new AI call, exact body preservation, attribution,
pressed-button travel, actual pupil displacement/recentering, and reduced-motion
shutdown. It also verifies the actual welcome and latest-reply pupils. Current
evidence is under `output/moments/refined/`. The installed native compilers
validate the build, but physical-phone tilt direction, permission behavior and
feel remain unverified; browser pointer checks do not establish those results.


### Theme atmosphere and final verification

Discover has a viewport-scale, static SVG of petal and leaf contours. Its accent,
gold and soft colors come from the current palette, with six cached local data
URIs. It sits behind the page content without taking pointer events; Moment keeps
its readable surface. No remote asset, animation, new permission or model call is
required. The Plan page and bottom navigation remain unchanged.

TypeScript and all 174 frontend tests passed, including six gaze controller/feed
cases and the six-theme SVG contract. A clean HEAD export with only the intended
commit files also passed TypeScript and 14 focused tests, excluding unrelated
working-tree features. The production mini-program build passed, including 20
WXSS / 47 WXML compiler checks; the current development artifact check passed
21 WXSS / 48 WXML. Existing Sass legacy-API warnings remain nonfatal.

Three consecutive H5 interaction runs passed (11 cases each), reporting zero page
exceptions, failed image requests or paid requests. These use the actual Vue app
and a temporary demo-mode backend with fictional accounts. A fictional demo chat
also verifies the latest reply's avatar; it never reaches a paid provider. Checks
cover all six themes and 320/360/390/430px widths, default expansion, no-call
collapse/reopen, disclosure, 1px press travel, Moment/chat pupil movement,
recentering, reduced motion, draft preservation and budget-error recovery.

Visual self-review covered forest/dark atmosphere, the softened action, folded
title, narrow layout and both chat states. Physical-device tilt direction,
permission behavior and feel remain unverified. Browser and compiler checks do
not establish native UI acceptance. No new independent-review result is claimed.
No provider, environment file, production account, budget ledger or raw reasoning
handling was changed by this visual refinement.
