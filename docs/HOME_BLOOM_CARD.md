# Home card and Bloom

Updated 2026-10-25 after owner review. This implements the Home card portion of
PRODUCT_DIRECTION.md; conversational onboarding remains a separate task.

## Current behavior

- Bloom is the only conversation entry on this card. There is no separate CTA.
  The existing conversation selection and local draft behavior remain intact.
- The independent View and edit control sits at the trailing edge of the footer.
- A small transparent character rests on the top-right card edge. The invitation
  beside it is content-sized, single-line, padded by 6px/10px and has no close
  control. No unsolicited model request or saved assistant greeting is created.
- A questionnaire option is not rendered as a claim about the user's present
  condition. Selection-only cards use a neutral continuation heading and dated
  topic metadata. User-authored questions and authorized reviewed summaries
  remain available; no account data is rewritten or deleted.
- Card corners stay 8px. Existing theme quotation-surface tokens provide the
  translucent fill, edge light and shadow. Titles use the existing heading font.
  Extra foliage and the all-conversations link were removed after owner review.
- Bloom breathes with a restrained 5.8-second local image scale, anchored near
  its hands. The hit target and card do not move. Press feedback changes image
  opacity; loading pauses motion, dims only the image and shows opening text.
  Transparent backgrounds are explicit for normal, pressed and disabled native
  button states. Reduced motion stops animation; the existing foreground flag
  pauses it when the personal space is hidden. No JavaScript animation loop,
  video, new media service or motion dependency is introduced.

## Validation

- TypeScript check passed
- Two focused UI suites / nine tests passed, including dated selection-only
  clues, retention boundaries, user-authored titles, duplicate-copy removal,
  Bloom-only navigation, no close control and disabled duplicate-entry guarding
- Native Mini Program build and bundled WXML/WXSS compiler checks passed
- Auxiliary H5 captures at 390x844, 375x667 and 320x740 cover the selected
  life-rhythm case; additional captures cover Quiet Night with no exploration
  and the post-click loading state. The loading capture shows the transparent
  background retained rather than a native button rectangle
- Final captures contain no console errors, horizontal overflow or broken
  images. Existing brand wordmarks are retained intentionally. Cold Vite
  compilation exceeded the first capture's element wait; that capture was
  discarded and all affected viewports were retaken after the component loaded
- Local visual self-review only; no independent score or hardware claim

Evidence: output/home-bloom/bloom-entry-20261025/. These screenshots are
auxiliary H5 evidence, not WeChat simulator evidence. Native runtime acceptance
remains unverified: the earlier isolated tourist project did not supply a
runnable SDK session. Compiler success does not establish native interaction,
button-state or accessibility acceptance. The personal account/project was
not attached to the QA helper.

The isolated native helper is tools/verify-home-bloom-native.cjs. It targets
only its copied tourist project and disposable Mock API. Artwork provenance
and the final imagegen prompt are in design/home-bloom/README.md. No paid model
was used for application interaction QA. Existing Sass legacy API deprecation
warnings are unchanged.
