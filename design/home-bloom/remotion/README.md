# Bloom greeting (Remotion)

A 1.2-second, one-shot greeting followed by the invitation bubble. The existing
transparent portrait is rigged into a small head nod and a left-hand lift; the
right paw remains on the card. The last frame exactly matches the first frame.
No new character generation, model call, audio or runtime React dependency is
introduced to the Mini Program.

## Author and preview

```powershell
cd design/home-bloom/remotion
npm ci
npm run studio
```

Studio runs on http://localhost:3021. `BloomHello` is the transparent character;
`BloomGreetingPreview` demonstrates the card and delayed invitation. Seek or
play the preview to inspect the gesture and text order. Composition code is in
`src/Root.tsx`; the source portrait is `public/bloom.png`, copied from the existing
Mini Program portrait. The template-cloning command timed out on GitHub, so the
minimal project was scaffolded locally with pinned Remotion 4.0.538 packages.

## Build the Mini Program asset

```powershell
npm run render:atlas
```

The renderer uses locally installed Chrome by default. Set
`REMOTION_BROWSER_EXECUTABLE` to another supported Chromium executable if needed.
It uses Remotion's `bundle`, `selectComposition` and `renderFrames` APIs, with
transparent PNG frames; see the [renderFrames reference](https://www.remotion.dev/docs/renderer/render-frames).

The script writes three generated runtime files:

- `apps/miniprogram/src/static/bloom-greeting.png`: 6 x 6 transparent atlas,
  912 x 984 pixels, approximately 193 KiB
- `apps/miniprogram/src/bloom-greeting.generated.json`: 36 frames, 30 fps,
  1200ms, atlas dimensions and source
- `apps/miniprogram/src/bloom-greeting.generated.scss`: discrete frame positions

Frames and reports stay in ignored `output/home-bloom/remotion-greeting/`.
The renderer asserts that the first and final frames match. The atlas corner
has alpha zero. The app plays it once through a clipped native view/image pair;
no per-frame JavaScript timer, WebM video or Remotion player is shipped in the
Mini Program. Keep the generated keyframes in the same scoped SCSS compilation
as their animation-name reference.

The greeting starts after the atlas loads. Its view's animation-end event
reveals the real, dynamic invitation text. Reduced motion and asset failure use
the static portrait with immediate text. Bloom stays clickable throughout;
opening a chat pauses decoration and displays the loading text immediately.
Re-renders do not restart the greeting; a new Home view mounts a fresh greeting.

## Evidence and limits

Remotion rendering, exact rest-frame equality, transparent pixels, component
state tests, reduced-motion checks and native WXML/WXSS compilation are checked.
Auxiliary H5 captures cover 375px and 320px widths. Controlled browser timeline
samples verify multiple sprite positions, hidden text before the end event and
visible text afterward. The minimised interactive browser throttled natural
animation playback, so this report does not infer wall-clock timing from it.
Native simulator and physical-device playback remain unverified.
