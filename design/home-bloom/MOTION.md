# Bloom eye motion

The owner requested eye movement rather than whole-character breathing.
Oil Motion's scope routes small CSS/JS/SVG microinteractions to ordinary frontend
implementation; no generated video, atlas, external service or credential setup
is needed for this movement. The existing raster identity remains unchanged.

- Identity: the cropped 210 x 246 transparent portrait in bloom-home-top.png
- Composition: original body, hands and card border stay stationary
- Moving subject: two separately masked pupils, bounded to about 0.7 CSS pixels
- Timing: a nine-second glance cycle with pauses facing forward, left and right
- Rendering: native-compatible local views/gradients; no canvas or frame timer
- Loading: eye overlays appear only after the portrait has loaded
- Lifecycle: the existing foreground/busy flag pauses eye motion; reduced motion
  hides the overlay and shows the original static eyes
- Interaction: Bloom remains the sole chat entry; no inferred mood, engagement
  score, camera data or model call is associated with eye motion

Coordinates include the aspectFit margins of the 76 x 82 and 70 x 76 frames.
Four-times-resolution auxiliary captures are in
output/home-bloom/eye-motion-20261025/eyes/. The browser motion report checks
that pupils change position while the body transform stays none, and that
reduced-motion mode is static. These checks do not establish native-device
animation quality or sensor behavior.
