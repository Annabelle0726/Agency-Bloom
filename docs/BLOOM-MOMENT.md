# Bloom Moment — a little curiosity, without a problem to solve

The home page now offers one optional experience immediately after its welcome.
A visit only reads today's state. Opening the invitation, or explicitly choosing
**Another**, creates at most one provider request. No notification, background
generation, streak, deadline, reward schedule or additional model reviewer is
introduced. Discover and the personal journey remain separate entry points.

## Experience

Four flavors are selected from eligible types, preferring those not recently
shown: a perspective, a small experiment, an echo from the past, or a light
imaginative moment. Without authorized sources, only experiment/light are
eligible. A refusal rests that flavor for two subsequent experiences; it is not
a psychological or personality inference. Exact fingerprints and retained-text
similarity reject recent repetitions. A rejected candidate does not cause an
automatic replacement request.

The six existing palettes, typography, small radii, CompanionAvatar and local
visual resolver are reused. Artwork changes locally with date, experience and
theme. Missing eligible artwork falls back to a real compatible local image or
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
Until deployed, the endpoint fails safely and the homepage offers read retry.

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
