# Home continuity hierarchy — 2026-10-25

This implements the owner's latest direction: prioritize the person's question,
make saved records an open continuation section, and retain the quotation card
with its framing marks and catalogue rotation, as reconfirmed by the owner.
It supersedes the earlier Home layout freeze and
editorial-headline choices in `HOME_BLOOM_CARD.md` and `HOME_RECORDS.md`.
Product and asset contracts: `PRODUCT_DIRECTION.md`, `DESIGN.md`, `AGENT.md` and
`VISUAL-ASSET-SYSTEM.md`.

## Content hierarchy

- The main card has a small contextual label and the actual saved question as
  its headline. A concrete answer from an explicitly selected starting topic
  is the fallback. Several unprioritized topics never become an arbitrary
  negative headline. Empty and ended states remain explicit and neutral.
- A single authorized, related source supplies the supporting paragraph:
  reviewed summary under retention, confirmed card content or the focused
  starting answer. Questionnaire branches are not flattened with separators.
  Original records remain unchanged. Source labels distinguish exploration
  updates, dated starting answers, reviewed dialogue and confirmed card data;
  dates refer to the available source record, not invented field timestamps.
- Bloom is the card's conversation entry, with no duplicate continuation CTA.
  It does not pre-fill/send a message or create a conversation by itself.
  Starting-answer details use the dedicated account-owned initial-snapshot
  drawer; card editing keeps its existing action. Bloom's sprite, timing,
  portrait dimensions and greeting logic are preserved.
- The open `接着上次` section contains the chosen attempt first and, if present,
  one recent distinct observation. The attempt text is not line-clamped. Its
  full structured details open in Plan. Observations expose an explicit full-
  record action and expand locally. No missing-observation slot is reserved.
- No large container surrounds the records or empty recording entry. The
  quotation retains its themed panel, large quotation marks and source label.
  Its catalogue and foreground rotation remain unchanged. Record rows have no
  full-width border or native button hairline across the reading area.

## Theme and image selection

All new surfaces, text, borders and interaction colors use existing theme
variables. `home-visual.ts` uses the central deterministic resolver for one
supporting thumbnail beside a saved attempt. Only deployed, shared, thumbnail-
eligible assets with a real variant for the active frontend theme qualify.
Explicit starting topics can refine category selection; neutral quiet-reading
art is the fallback. This is ambience, not a claim about mood or career fit.

No file paths, invented variants or private provider selection are added to
the component. The resolver retains the approved cloud-delivery adapter.
An image failure removes the thumbnail without leaving an empty frame. No
source image, frozen theme reference, canonical manifest or archive is changed.
There is no model request, image generation, upload or paid API call.

Theme changes re-resolve this supporting page image locally; saved record IDs,
wording and order do not change. This page-art behavior is distinct from the
backend's theme-filtered chat image selection described in the asset audit.

## Type and spacing

The user's question uses the existing Songti stack at 24/36px, framed by light
theme-colored square brackets under the small `此刻，我在意的` label. The section
heading uses the same stack at 18/30px. Supporting paragraphs and record text
use the shared system sans stack; the main card clue is 13/23px and its single
footer uses 11/18px source/date and edit text with 44px touch targets. Tapping
the source/date opens starting-answer details when available. The closing
quotation is 16/28px Songti. No daily score,
new recommendation card or growth metric is introduced.

The main surface retains 8px corners and theme-derived glass tokens. The
record section has transparent background, no enclosing border/shadow, 16px
row spacing and a fine theme-colored divider. Section gaps remain approximately
18–24px. Every actionable entry retains a 44px minimum target. The saved
attempt thumbnail is 72x96px, or 60x80px on narrow screens. An initial gold
change label failed contrast in four light palettes; final labels use theme
ink instead. Reduced-motion and image-failure paths remain available.

## Validation

The focused suite covers source/retention boundaries, exact user wording,
selected-only and multiple-topic states, historical content, both guarded
conversation entries, starting-detail actions, observation expansion, image
eligibility across all six themes, image failure, quotation rotation and
unchanged visual-library provenance. TypeScript, the Mini Program build and
the installed WXML/WXSS compiler checks pass. The canonical visual audit
confirms 48 originals, 42 deployed, 6 archived and unchanged frozen references.

Auxiliary captures in `output/home-continuity/final-themes/` cover six themes
at 390x844. `selected/` covers 320x740 and 375x667 with selection-only content.
The fixture uses actual components and synthetic user records, never private
account data. Visual review is local self-review; initial contrast findings
were corrected and affected palettes recaptured.

Native automation was attempted against a separate tourist project and the
disposable Mock API on port 8031. CLI auto succeeded on port 9464, but the
documented `App.getPageStack` request did not return within the bounded probe;
only IDE version metadata was available. Native Console/runtime and simulator
visual acceptance therefore remain unverified. No personal project/session
was used. Hardware touch, large system fonts and keyboard acceptance remain
separate from compiler/H5 checks.
