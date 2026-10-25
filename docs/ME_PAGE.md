# Me: owned records and grouped controls

The Me page follows PRODUCT_DIRECTION.md: current confirmed goals/constraints,
confirmed memories, dated initial answers and Journey remain distinct records.
It reuses the existing APIs and versioned correction controls, without adding
another profile store, inferred identity or generation on page entry.

## Presentation

The compact account header precedes three single-open accordion groups:

- My information and records: current phase, saved memories, independent memory
  context permission, initial answers and exploration-scoped Journey.
- Data and authorization: AI processing, chat retention, separate speech consent,
  and privacy information.
- Response and appearance: defaults for new conversations and theme preferences.

All groups start closed. Their content stays mounted, so closing a group does
not discard edits, errors or loaded records. The expanded contents have a 16px left inset relative to their group headers,
so child rows have a visible hierarchy without reducing their right-hand targets.
Native-sized header targets expose expanded state and controlled region identities; collapsed content is invisible
and outside pointer/focus interaction. A 220ms grid expansion and rotating
chevron respect reduced motion. Existing setting typography uses the shared
body font, 14px item text, 13px descriptions and normal weight. Only the original
page heading retains the heading font. Theme colors remain inherited.

Disabled initial-answer rows explicitly use a transparent background and theme
text. This prevents the native disabled-button default from becoming a pale
block in Quiet Night. Empty initial answers remain visibly different from
failed loading, without exposing an unavailable action.

Usage is a small text row. Logout remains outside the accordions. Account
deletion is the final row in Data and authorization, with theme-aware danger
text and its existing explicit confirmation flow. The existing logout markup and its dedicated styles are preserved.
The static local vine background is unchanged.

## Data and corrections

MeRecordsPanel reads owned memories and only the selected exploration snapshot.
Independent loading errors have retry actions; account/scope changes immediately
clear old data and stale responses are ignored. Initial selections, refinements,
notes, life conditions and constraints render verbatim. Missing answers stay
unanswered; old snapshots without a recorded response preference say unrecorded.
The current API supports viewing/deleting a dated snapshot, not editing each
original answer. Users can separately confirm a current phase through the existing
editor without rewriting the original collection date.

Memory permission updates read back /me after acknowledgement and invalidate
pending context. A failed readback offers a GET-only confirmation action instead
of silently repeating the mutation. Snapshot deletion requires explicit native
confirmation and its version; failed deletion preserves the visible original.

Record text now opens editing; a separate 44px checkbox selects for reviewed
merging. Manual records have no implied current-conversation source. Source
inspection fetches available retained original messages only on explicit action.
Unavailable sources never erase independently confirmed records. Journey receives
the selected exploration and a Me caller label; native back preserves the caller.

## Evidence and limits

Focused frontend tests cover disclosure exclusivity, record readback, account
isolation, failures and retry, explicit versioned deletion, original answer
selections, separate merge selection, manual provenance, source unavailability
and unchanged logout behavior. Related backend MockTransport tests cover the
existing owned-context and correction contracts. No live user database or paid
provider is used.

H5 screenshots at 390 x 844 and 320 x 740 are in
output/me-page-20261024/, including accordion-dark-final/ and
accordion-dark-open/. They are auxiliary evidence. WXML/WXSS compilation uses an
isolated project. Simulator automation failed to obtain SDKVersion from the
Developer Tools handshake; native animation, safe-area behavior, system font and
real-device touch/screen-reader acceptance remain unverified.
