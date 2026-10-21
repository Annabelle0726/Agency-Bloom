# Icon System

## Decision

Agency Bloom uses **Lucide Icons v1.60.0 geometry** as its single line-icon language. The upstream paths are stored in [`tools/prepare-icons.mjs`](../tools/prepare-icons.mjs) and generated into [`apps/miniprogram/src/icons.ts`](../apps/miniprogram/src/icons.ts) and the editable files in `apps/miniprogram/src/static/icons`.

Lucide was chosen over Phosphor because:

- Its 24 × 24 grid, round caps and joins, and low-density line work match the quiet onboarding direction.
- One line weight is enough for this product; Phosphor's multiple weights would invite inconsistent use.
- The project already used a 24 × 24 line vocabulary, so existing non-onboarding icons can share the same source geometry.
- The ISC license is permissive and the SVG paths can be vendored without a runtime package.

Lucide is the only icon library in the UI. Do not add Phosphor, Heroicons, or hand-drawn one-off icons to the same surface. The brand sprout mark is artwork, not an interface icon.

## Geometry contract

- Canvas: `24 × 24`, `viewBox="0 0 24 24"`.
- Project stroke: `1.75px`, normalized in one place (`iconStrokeWidth`).
- Caps and joins: `round`.
- Fill: `none` for interface icons.
- Do not stretch individual paths or change the viewBox per icon.
- Use the upstream optical padding; do not crop paths to the canvas edge.
- Rendered sizes: 12–24px in controls and metadata, 22px inside the 42px onboarding icon tile.

The generated SVG is:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
     fill="none" stroke="COLOR" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round">…</svg>
```

## WeChat rendering path

Inline Vue `<svg>` nodes are not a reliable WeChat Mini Program rendering path. `SvgIcon.vue` therefore keeps the proven native path:

1. `iconSvg(name, color)` builds the SVG string.
2. `iconDataUri(name, color)` base64-encodes it and caches by `name:color`.
3. A native `<image mode="aspectFit">` displays the `data:image/svg+xml;base64,…` source.

This is offline, has no runtime image request, and avoids CSS filters for dynamic icons. The editable `.svg` files remain in `src/static/icons` for inspection and for legacy static-image consumers.

## Theme contract

`icon-system.ts` defines:

```ts
interface IconPalette {
  ink: string
  accent: string
  muted: string
  paper: string
}
```

`pages/index/index.vue` provides `ICON_PALETTE_KEY` from `activeTheme.palette`. `SvgIcon` resolves `tone="ink|accent|muted|paper"` against that palette; `light` remains supported for white icons on filled buttons. Pages must not pass fixed brand greens or blues.

The same six palettes drive the onboarding card tokens in `themes.ts`:

| Token family | Purpose |
|---|---|
| `--quiet-surface*` | card, pressed, and selected surfaces |
| `--quiet-border*` | faint resting border and accent selected border |
| `--quiet-tile*` | 42px icon-tile tint |
| `--quiet-check*` | check/radio control |
| `--cta-*` | quiet primary CTA, disabled, and pressed states |
| `--onboarding-wash-*` | theme-aware photo wash |

All interface icons therefore change with the active theme. By product rule, the onboarding screen itself renders Morning Mist because it is outside the authenticated personal space; the six-theme behavior is exercised by the palette tests and by components inside the space. The fixed light onboarding surface is intentional, not a hard-coded icon color.

Legacy static-image glyphs (`AppTopbar`, `PlanView`, `ChatHeader`) still use `--icon-filter`; `SvgIcon` does not, because its color is already resolved from the active palette.

## Semantic mapping

| Context | Icon | Lucide name |
|---|---|---|
| Direction unclear | compass | `compass` |
| AI / industry change | orbit | `orbit` |
| Compare choices | split | `split` |
| Change without losing stability | shield-check | `shield-check` |
| Something else on the mind | message-heart | `message-circle-heart` |
| New possibilities | door-open | `door-open` |
| Cannot name it yet | message-more | `message-circle-more` |
| Listen first | ear | `ear` |
| Discover possibilities | spark | `sparkles` |
| Compare trade-offs | scale | `scale` |
| Try a small experiment | flask | `flask-conical` |
| Selected | check | `check` |

Icons are chosen for meaning, not decoration. The Step 2 quick answers intentionally have no icons: their text is already concrete, and a second symbolic layer would add noise. The right-side check or radio carries the state.

## Motion

- Card colors and borders: 160ms `var(--ease-out)`.
- Press: `scale(.988)` for 120ms; no bounce.
- Check/radio: 160ms opacity/scale transition.
- Icon tiles change tint; icons themselves do not spin, pulse, or loop.
- `prefers-reduced-motion: reduce` disables transforms and transitions.

No Lottie or SVG animation library is installed. There is no complex vector sequence in onboarding, and `lottie-miniprogram` would add a runtime dependency, package weight, and a second rendering path for no product benefit. Revisit only if a future illustration genuinely requires multi-state vector animation, then measure package size and WeChat compatibility first.

## Adding or changing an icon

1. Add the Lucide geometry to the `lucide` map in `tools/prepare-icons.mjs`.
2. Run `node tools/prepare-icons.mjs`.
3. Commit the generated `icons.ts` and `src/static/icons/*.svg` changes.
4. Add the semantic mapping in `onboarding.ts` or the consuming component.
5. Run `npm run typecheck`, `npm run test:ui`, and `npm run build:mp`.

Do not hand-edit `icons.ts` or the generated SVG files. The generator enforces the 24 × 24 canvas and 1.8px stroke so a new icon cannot drift silently.

## Verification

- `npm run typecheck` passes.
- `npm run test:ui` passes, including icon normalization, semantic coverage, six-palette contrast, and onboarding behavior.
- `npm run build:mp` passes the WeChat bundled-compiler and reference checks.
- The isolated WeChat simulator capture (`tools/capture-onboarding-step1-native.cjs`) verifies seven Step 1 cards, the shared `SvgIcon` boundary, an offline base64 SVG source, and local draft selection persistence.
- Screenshots are captured at 390 × 844 on the simulator's iPhone 12/13 (Pro) profile.

Not verified in this pass: physical-device font rasterization, screen-reader traversal, and onboarding under a non-Morning-Mist palette (the screen is fixed to Morning Mist by product rule).
