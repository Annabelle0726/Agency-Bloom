# Initial snapshots in the workspace drawer

The drawer exposes three persistent destinations: conversations, long-term memory,
and initial snapshots. The home starting-record link opens initial snapshots and
places the current issue first. Current-phase memory editing remains available
from the existing direction entry.

Snapshots preserve dated starting answers; they are not confirmed long-term
memories. They remain readable when memory use is disabled. This view reads the
existing account-scoped snapshot endpoint and does not create new records.
Missing snapshots, loading failures, and partial failures have distinct states.
Failed reads can be retried. Late responses are discarded after account/view
changes or unmount. Deletion retains confirmation and version checks.
The introduction explicitly states that initial snapshots are read-only and
cannot be edited. Home places the muted snapshot entry at the right of View
and edit; the latter occupies the center position.

Conversation and memory category filters share `drawer-filter-tabs`: centered
text, a 44px minimum touch target, and zero vertical button padding. Colors and
selected states continue to use the active theme tokens.

Regression coverage: `apps/miniprogram/tests/drawer-snapshots.test.ts`.

## Snapshot presentation

The snapshot destination has its own scoped record-card treatment, rather than
inheriting the memory list's plain rows. Each card uses existing theme material
tokens, 8px corners, a small leaf/source/date header and a 20/30px Songti title.
Labels use 12/19px system text; answers use 14/24px with preserved line breaks
and no line clamp. Fine dividers separate the original questions and answers.
Unfilled answers remain explicit and use a quieter style. Source wording and
stored responses are not changed or replaced with generated copy.

Deletion sits in an independent trailing footer with a 44px touch target. Its
existing confirmation, ownership, version and refresh behavior are retained.
Empty/error panels share the theme, 8px corners and readable padding; retry
remains a separate visible action. Native style isolation stays apply-shared;
new selectors are scoped to snapshot content rather than all drawer records.

TypeScript, the eight existing drawer/snapshot tests, the Mini Program build and
37 WXSS / 59 WXML bundled compiler checks passed. Auxiliary renders of the real
drawer with synthetic records are in output/initial-snapshots-20261025/. Forest
checks cover 375x667, 390x844 and 320x740; dark, empty, error and scrolled-footer
states are also rendered. These are auxiliary H5 checks, not WeChat simulator
or real-device acceptance. No private database or paid model was used.
The initial empty hint measured below 4.5:1 on the Forest soft fill; it now
uses theme ink and its rerender passes the contrast check. Default native
button pseudo-borders are cleared on the main tabs and close control. Final
top-of-drawer captures are in output/initial-snapshots-20261025/final/.
