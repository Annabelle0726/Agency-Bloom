# Home card and Bloom

The card uses a question-first hierarchy and a compact source footer.
The existing Bloom artwork and greeting behavior are preserved.

Updated 2026-10-25 after owner review. This implements the Home card portion of
PRODUCT_DIRECTION.md; conversational onboarding remains a separate task.

## Current behavior

- Bloom is the only conversation entry on this card. There is no separate CTA.
  The existing conversation selection and local draft behavior remain intact.
- The independent View and edit control sits at the trailing edge of the footer.
- A small transparent character rests on the top-right card edge. The invitation
  beside it is content-sized, single-line, padded by 6px/10px and has no close
  control. No unsolicited model request or saved assistant greeting is created.
- The small label `此刻，我在意的` precedes the actual saved question or an
  explicitly selected concrete starting point. Two soft theme-colored corners,
  at the upper left and lower right, frame that headline without literal square
  brackets. The contextual label and leaf share a single row with an 8px gap.
  The question remains the strongest text and
  its original wording stays selectable and unchanged. Generic invitation
  headlines are superseded by the owner's question-first direction.
- Only one related, authorized clue supplies the two-to-three-line description.
  A sibling questionnaire selection is not used as evidence for a different
  selected headline. Several unprioritized areas do not establish a primary
  concern. Reviewed summaries still follow retention settings; no model call
  or saved record rewrite is introduced.
- Source/date and the right-aligned View and edit action share one quiet footer
  with 11px text and 44px touch targets. When starting answers exist, tapping
  the source/date opens their existing detail viewer. All answers remain there,
  rather than being flattened into the card. The duplicate conversation link
  and second metadata row were removed; Bloom remains the chat entry.
- Card corners stay 8px. Existing theme quotation-surface tokens provide the
  translucent fill, edge light and shadow. Titles use the existing heading font.
  Extra foliage and the all-conversations link were removed after owner review.
- Bloom now plays a one-shot, 1.2-second Remotion greeting: a small head nod and
  left-hand wave, settling back to the original pose. The invitation remains
  hidden until the greeting view emits animationend, then fades in. The former
  pupil loop was removed. Press feedback changes portrait
  opacity; loading pauses motion, dims only the image and shows opening text.
  Transparent backgrounds are explicit for normal, pressed and disabled native
  button states. Reduced motion stops animation; the existing foreground flag
  pauses it when the personal space is hidden. Reduced motion or an atlas error
  shows the static portrait and invitation immediately. Remotion is an isolated
  design-time project; only a transparent PNG atlas and generated timing/CSS
  are delivered to uni-app. No per-frame JavaScript loop or runtime React
  dependency is introduced.

## Validation

- The offset-corner follow-up passed TypeScript, the same 21 focused tests and
  the native bundled compilers (37 WXSS / 59 WXML). Compilation completed;
  its first post-build check saw no app.json, then a separate check passed
  after the output was available. Auxiliary captures at 375x667 and 390x844
  are in output/home-bloom/corner-frame-20261025/final/. They verify the two
  separate corners and the adjacent label/leaf row, not native runtime behavior.
- The question-card refinement passed TypeScript and three focused suites / 21
  tests. The Mini Program build passed 37 WXSS / 59 WXML bundled compiler
  checks; both watched dev and production WXML contain the bracketed question
  and no duplicate card CTA. Native runtime acceptance is unverified: the isolated automation port
  9457 was unavailable. Auxiliary component-only captures and fixture data are
  in output/home-bloom/question-card-20261025/; these are not simulator evidence.
  Forest captures at 375x667, 390x844 and 320x740 have no console errors,
  horizontal overflow or failed images. A dark 390x844 capture also passed.
  Initial cold-preview compilation exceeded the element wait; those failed
  captures were discarded and the Forest set was retaken after compilation.
- The editorial-heading follow-up passed TypeScript, two focused suites / 14
  tests, and the Mini Program build with 36 WXSS and 58 WXML compiler checks.
  Both dev and production artifacts contain the new cover-copy map. Auxiliary
  captures are in output/home-bloom/title-copy-20261025/; native runtime
  acceptance remains unverified for this follow-up.
- TypeScript check passed
- Four focused UI suites / eighteen tests passed, including dated selection-only
  clues, retention boundaries, user-authored titles, duplicate-copy removal,
  Bloom-only navigation, no close control, disabled duplicate-entry guarding,
  gaze lifecycle, image-ready fallback, ordered greeting completion, unrelated
  animation events and greeting-asset failure
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

## Follow-up: chat-entry image readiness

Actual Home-to-Chat navigation in the isolated H5 application exposed a distinct
loading defect in CompanionAvatar. Before the PNG painted its background, the
gaze layer had already mounted its pale sockets. The initial local trace showed
an unpainted image at 815ms and a painted image at 861ms. This reproduces the
state, not the owner's exact one-second duration; cold loading can extend it.

The fix warms the chat PNG while Home is visible and gates the gaze and glow on
the avatar's own image-load event. An immediate CSS-drawn robot stays visible
until load, or on error, without external assets. It does not show disconnected
white sockets. The post-fix navigation trace had zero invalid frames across 65
samples, including an image-not-ready frame. The regression test holds the
image unready until an explicit load event and verifies that an error restores
the fallback. A separate attempt to hold a blocked PNG in the browser did not
finish because the page reload timed out; no prolonged cold-network rendering
result is claimed. Its per-page network interception was removed afterwards.

Footer layout now has a 28px contribution plus 4px top spacing. Negative vertical
margins keep its native button's actual 44px hit height, removing excess visual
space without shrinking the touch target. Bottom card padding is 10px, or 8px
on narrow screens.

Follow-up evidence: output/home-bloom/eye-motion-20261025/,
output/home-bloom/navigation-before.json and navigation-after.json. The eye-motion
report samples changing pupils with a stationary body and checks reduced motion.
Details of the existing-art layering are in design/home-bloom/MOTION.md. This
microinteraction follows Oil Motion's frontend routing rule; it does not require
a generated video, sprite atlas, new credentials or another paid media service.
That earlier eye-motion iteration is now superseded by the Remotion atlas in
design/home-bloom/remotion/. The current atlas has 36 transparent frames at
30fps (1200ms), returns to its exact starting pose and is approximately 193 KiB.
Current reports and H5 captures are in output/home-bloom/remotion-greeting/.

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
