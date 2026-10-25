# Home records — 2026-10-25

Layout, record order and type sizes below describe the earlier iteration.
The owner's subsequent open-record and question-first direction is implemented
and documented in [Home continuity hierarchy](HOME_CONTINUITY.md).

## Scope and product intent

The owner approved the Bloom card and quotation and explicitly requested that
both stay unchanged. This change replaces only the old middle "Today's focus"
menu with saved content from the selected exploration. It follows the Home
return-and-revision contract in `PRODUCT_DIRECTION.md`.

`HomeRecordsCard.vue` shows at most two records: the latest actual observation,
then a saved next step. With no next step, the next most recent observation can
take its place. Repeated text and exact duplicates of the primary card's
visible content are excluded. Records come exclusively from the current
`Issue.feedback` and `Issue.card.next_step`; no transcript, memory, profile,
inferred emotion, generated recommendation or extra model request is used.

Observation dates use the feedback's real creation time. A next step has no
field-level confirmation timestamp, so no date is invented for it. The full
experiment remains accessible in the existing Plan view. An observation opens
inline to expose the user's complete wording, with an explicit collapse hint.
Only known record types receive local labels; the content itself remains the
user's saved text. A changed wish is not classified as failure or a new goal.

Without saved records, a single compact recording entry replaces the large
empty card. An ended exploration offers read-only review rather than creating
new feedback or silently restoring it. Expansion state resets on exploration
switches and disappears when its record is removed.

## UI specification

- Section heading: the existing Songti heading family, 18px/30px, weight 400;
  17px on screens up to 360px to match the approved Home card and quotation.
- Record content: the existing system sans family, 16px/24px, weight 400.
- Actions: system sans, 14px/21px, weight 500, minimum 44px touch target.
- Types, dates and collapse hints: system sans, 12px/18px, weight 400.
- Surface: existing quotation fill, border, inset-light and shadow tokens;
  8px corners and one subtle divider between reading groups.
- Horizontal inset: 20px, or 16px on narrow screens. Record groups use 16px
  vertical padding; icon/text gaps are 12px, or 8px on narrow screens.
- Icons use the established SVG system at 20px. The disclosure sits in the
  metadata row, giving user-written content its available width. An early
  right-column disclosure caused an orphaned final character on a narrow
  screen; this was corrected without shrinking the record text.
- Press feedback changes the local surface; disclosure rotation takes 130ms.
  Reduced motion removes the transition. Content does not wait for animation.

The approved `HomeBloomCard.vue`, `home-entry.ts`, quotation source, quotation
rotation and global theme stylesheet are outside this change. The quotation
markup inside HomeView is also preserved. A local baseline/hash check in
`output/home-records/protect-approved.cjs` verifies these boundaries.

## Validation

Seven pure data tests and four component interaction tests cover empty states,
scoped records, sorting, deduplication, full wording, missing dates, changed
wishes, ended exploration access, local expansion and existing destinations.
TypeScript checking passes. Native compilation and simulator availability are
reported separately; compiler success never establishes simulator acceptance.
`npm run build:mp` passed, including 37 WXSS and 59 WXML checks with the installed
WeChat compilers. Existing Sass legacy-API deprecation warnings remain.

The tourist-only helper `tools/verify-home-records-native.cjs` uses the copied
project at `output/home-records/native-project`, automation port 9463 and a
disposable Mock API on 8031. In this run the IDE endpoint returned version
metadata without a Mini Program `SDKVersion`; native UI acceptance remains
unverified. The owned QA project is closed after verification. No personal
session/database or paid provider is used for testing.

Auxiliary H5 evidence uses actual Vue components and synthetic saved records.
It covers dark/light surfaces, 390/375/320px widths, the empty entry and full
record expansion. Evidence is under `output/home-records/`; final screenshots
are selected only after the target component has mounted. Cold-compilation
capture failures are not accepted as visual evidence. Existing brand labels
remain intentional. This is local visual self-review, not an independent
visual score or a claim of real-device acceptance.

Final selected evidence: `accepted-dark-390/page.png`,
`final-dark/page-375x667.png`, `final-dark/page-320x740.png`,
`accepted-forest/page.png`, `expanded/page.png` and `empty/page.png` under that
output folder. The initial failed 390px captures in the intermediate report
are superseded by `accepted-dark-390/`. The fixture no longer waits for an
animation frame before mounting, avoiding an unnecessary dependency on the
test browser's first background paint. Expanded-record evidence was retaken
after scrolling its button clear of the fixed navigation, then verifying the
visible collapse hint. No approved navigation styling was changed to obtain
the capture.
