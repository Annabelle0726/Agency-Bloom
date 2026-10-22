# Image asset audit

Status: **implemented and accepted for Phase 1 on 2026-10-22.** This document replaces the earlier audit-only draft. The machine-readable source of truth is [`docs/image-asset-audit.csv`](image-asset-audit.csv); the runtime contract is [`assets/visual-manifest.json`](../assets/visual-manifest.json).

## 1. Final inventory

| Measure | Result |
| --- | --- |
| Source images | **28** |
| Source bytes | **25,224,949** |
| From `design/img` | 10 images / 20,573,165 bytes |
| From `assets/gen-img` | 18 images / 4,651,784 bytes |
| Categories | direction 7, reflection 11, growth 2, rest 7, reference 1 |
| Deployed | **22** |
| New cards deployed in Phase 1 | **13** |
| Archived | **5** |
| Reference-only | **1** |
| Card-capable deployed | **20** |
| Hero-capable deployed | **8** |
| Unique runtime files referenced by manifest | **28** |

The source paths and hashes are recorded per image in the CSV and checked by `npm run check:visuals`. Original extensions are preserved; no source was re-encoded to rename it. New `.jfif` masters are category-prefixed for scanning, but their stable visual IDs omit the category prefix.

## 2. Deployed set

### Existing runtime sources retained (9)

`night_lake_reading_01`, `dusk_lake_reading_01`, `lavender_lake_reading_01`, `ivory_window_reading_01`, `misty_lake_meadow_01`, `forest_sunbeam_path_01`, `sunlit_desk_01`, `lakeside_sunset_01`, `window_lake_desk_01`.

Their 23 built-in JPEG derivatives remain at `apps/miniprogram/src/static/bloom/` (602,126 bytes). The new manifest records their source IDs and variants; it does not rename or regenerate the approved runtime files.

### New cards deployed (13)

`misty_lake_canoe_01`, `window_seat_01`, `forest_path_green_01`, `autumn_forest_path_01`, `forest_path_violet_01`, `forest_path_pink_01`, `moonlit_forest_01`, `sunlit_window_book_01`, `bluebell_forest_01`, `golden_desk_book_01`, `moonlit_lake_01`, `sunlit_book_desk_01`, `sunlit_meadow_path_01`.

These live at `apps/miniprogram/src/static/visuals/{direction,reflection,growth,rest}/` as 13 JPEG derivatives, 224x360, quality 73/MozJPEG, 157,887 bytes total. The recipe is `assets/visual-library/recipes/visual-cards.json`.

### Archived (5)

`dawn_lake_wildflowers_01`, `book_tea_blanket_01`, `mountain_lake_reflection_01`, `window_seat_pillows_01`, `sunlit_notebook_desk_01`.

They keep their source masters under `assets/visual-library/originals/` and have no runtime variants. They remain useful as future alternates but are not selectable in Phase 1.

### Reference-only (1)

`reference_bloom_pages_pair_01` is the approved two-page UI reference. It is stored at `assets/visual-library/references/reference_bloom_pages_pair_01.png`, marked `deploy: false`, and excluded from the candidate pool. It is not content imagery.

## 3. Page usage

### Discover

| Theme | Hero | Cards |
| --- | --- | --- |
| light | `misty_lake_meadow_01` | `window_seat_01`, `forest_path_pink_01`, `sunlit_meadow_path_01` |
| dark | `night_lake_reading_01` | `moonlit_forest_01`, `moonlit_lake_01`, text-only third card |
| dawn | `dusk_lake_reading_01` | `golden_desk_book_01`, `autumn_forest_path_01`, `sunlit_meadow_path_01` |
| forest | `forest_sunbeam_path_01` | `sunlit_window_book_01`, `forest_path_green_01`, `bluebell_forest_01` |
| lavender | `lavender_lake_reading_01` | `window_seat_01`, `forest_path_violet_01`, `bluebell_forest_01` |
| minimal | `ivory_window_reading_01` | `sunlit_window_book_01`, `sunlit_meadow_path_01`, `window_seat_01` |

The hero source is placed in `usedVisualIds` before card selection. No card repeats the hero, another card's source, or another card's `sourceGroup` on the same screen.

### Explore

| Theme | Welcome visual |
| --- | --- |
| light | `sunlit_book_desk_01` |
| dark | `night_lake_reading_01` |
| dawn | `window_seat_01` |
| forest | `sunlit_book_desk_01` |
| lavender | `sunlit_book_desk_01` |
| minimal | `sunlit_book_desk_01` |

Explore has no standalone route. `ChatExploreVisual.vue` places one compact local image in the chat/exploration welcome screen, above the starter chips. It does not add a new primary action or a second text block.

### Plan

| Theme | Hero | Decision image |
| --- | --- | --- |
| light | `window_lake_desk_01` | `misty_lake_canoe_01` |
| dark | `night_lake_reading_01` | `moonlit_lake_01` |
| dawn | `dusk_lake_reading_01` | `misty_lake_canoe_01` |
| forest | `sunlit_desk_01` | `misty_lake_canoe_01` |
| lavender | `lavender_lake_reading_01` | `sunlit_window_book_01` |
| minimal | `ivory_window_reading_01` | `misty_lake_canoe_01` |

The decision image is a portrait 78x104 slot (70x92 at narrow widths) at the top right of the decision overview. It does not replace the edit affordance or increase the page's text density.

### Dark limitation

Only three real night sources exist: `night_lake_reading_01`, `moonlit_forest_01`, and `moonlit_lake_01`. Dark Discover shows two image cards and one text-only card. Dark Plan uses `moonlit_lake_01`, which is also a Discover card; dark Explore uses the night hero source. These are cross-page repeats forced by the honest source pool, not same-screen duplicates. No daylight source is relabeled as night.

## 4. Source and reference integrity

Six frozen theme reference files under `design/themes/references/` are byte-identical to `HEAD` before and after the migration:

```text
ALL_REFERENCES_UNCHANGED = true
dawn.jpg      87a53e63c9aca67fb70bfc38f09166a33b8231fed0fcdb83152c6326e264914c
forest.jpg    c3941575581faf2984c9c87df33cc8de7db50a058226ae078434e1820073c55f
lavender.jpg  da0e225a3e06d4548b96dd0d44c1403037c1ea2bb3cc17c11221d9af415bb49b
minimal.jpg   19cc1f4be7756c6a6e45c574a9f44a0a690d728aa0efd9b7c5b0b60be72b5733
mist.png      2c22ccfb33ea549297714b12bf19ecdbf678f09debd50f3ce887a270038091db
night.jpg     4413c84833bb8ad61eb0c484e476919578dff2d814be12754906b0e40cf26dda
```

Migration checks:

- Original SHA-256 and byte size match for all 28 sources.
- The old `design/img/` and `assets/gen-img/` directories no longer exist.
- Old paths are absent from the active source, docs, and manifest; the validator fails on a stale legacy path.
- `assets/visual-library/recipes/bloom-pages.json` is the moved legacy crop recipe; it is not an image.
- The canonical manifest and `apps/miniprogram/src/visual-manifest.json` are byte-identical.
- No duplicate original paths, IDs, or runtime paths exist.

## 5. Implementation and validation

Files:

- `apps/miniprogram/src/visual-library.ts` — deterministic resolver and page helpers.
- `apps/miniprogram/src/visual-manifest.json` — generated runtime copy.
- `apps/miniprogram/src/page-art.ts` — approved legacy paths plus source-ID mapping.
- `apps/miniprogram/src/pages/index/views/DiscoverView.vue` — hero and three cards.
- `apps/miniprogram/src/pages/index/views/PlanView.vue` — decision image.
- `apps/miniprogram/src/pages/index/chat/ChatExploreVisual.vue` — Explore welcome visual.
- `tools/sync-visual-manifest.cjs`, `tools/validate-visual-manifest.cjs` — sync and validation.
- `tools/prepare-visual-cards.cjs` — new card derivatives.
- `tools/generate-visual-contact-sheets.cjs` — committed evidence sheets.

Resolver contract:

```ts
resolveVisual(context, theme, role, usedVisualIds)
```

It filters by page, role, theme, real variant, category, tags, preferred IDs, excluded source groups, used IDs, and used original paths. The optional `aspect` value is a soft ranking signal, not a validity filter. It returns a preferred legal match, then a deterministic score-ranked match, then `null`. It never calls the network or a model.

Testing:

- `npm run check:visuals` — manifest, path, hash, dimension, reference, stale-path, and duplicate checks.
- `npm run typecheck` — Vue/TypeScript passes.
- `npm run test:ui` — full frontend suite.
- `npm run test:api` — API suite.
- `npm run test:tools` — WeChat tooling tests.
- `npm run build:mp` — uni-app production build plus bundled WXML/WXSS compiler checks.

The resolver test suite covers deterministic results, the soft aspect preference, same-screen diversity, source-sibling de-duplication, Discover hero/card collisions, dark text-only fallback, all-theme fallback to `null`, stable path lookup, and absence of `fetch`/DeepSeek/HTTP access.

## 6. Native acceptance

Environment reported by the native simulator:

```text
model: iPhone 15 Pro Max
screen/window: 430x932
pixelRatio: 3
statusBarHeight: 54
SDKVersion: 3.17.3
```

Acceptance used the **build output** at `apps/miniprogram/dist/build/mp-weixin`, not H5. The simulator screenshots are 323x699 because the IDE scales the 430x932 viewport.

Verified on the native simulator:

- All six themes: light, dark, dawn, forest, lavender, minimal.
- Discover hero and three cards for each theme; dark shows the deliberate text-only third card.
- Explore welcome visual for each theme.
- Plan hero and decision image for each theme.
- Theme appearance modal opens, applies each selection, and the account preference was restored to `dawn`; a simulator refresh kept `dawn`.
- Plan edit modal opens and closes without changing data.
- Plan page scrolls and the decision image remains correctly composed.
- No visible horizontal overflow at 430px.
- No new chat message was sent and no paid model call was made during acceptance.

Limitations recorded explicitly:

- **Narrow 320px native layout remains unverified.** The available automation surface did not expose a device-size switch; systemInfo stayed at 430x932. H5 screenshots are not used as a substitute.
- **Physical-device hit targets and finger-coordinate taps remain unverified.** The automator cannot reach uni-app custom components by selector; interactions were driven through the components' native event emitters. Modal visibility, tab transitions, and scroll behavior were verified, but physical tap geometry was not.
- Dark cross-page reuse is intentional and documented above.

## 7. Package size

| Location | Bytes | Files |
| --- | --- | --- |
| `apps/miniprogram/src/static/bloom` | 602,126 | 23 |
| `apps/miniprogram/src/static/themes` | 327,450 | 12 |
| `apps/miniprogram/src/static/visuals` | 157,887 | 13 |
| Static total | **1,087,463** | 48 |
| Production build `dist/build/mp-weixin` | **2,515,650** | 341 |

The source library (25.2 MB) is outside the package. The build output is recorded here for size visibility; a separate Mini Program upload/package-limit check was not performed in this phase.

## 8. Visual evidence

- `docs/visual-library/contact-sheets/discover.jpg`
- `docs/visual-library/contact-sheets/explore.jpg`
- `docs/visual-library/contact-sheets/plan.jpg`
- `docs/visual-library/contact-sheets/shared-decorative.jpg`
- `docs/visual-library/contact-sheets/archive-reference.jpg`
- `docs/visual-library/page-composition-preview.jpg`
- Local native simulator evidence: `output/visual-native/` (not shipped in the app).

## 9. Phase 2

Phase 2 is **not implemented**. The DeepSeek visual-selection contract is documented in [`docs/VISUAL-ASSET-SYSTEM.md`](VISUAL-ASSET-SYSTEM.md#8-phase-2-deepseek-selection-contract-design-only). It must reuse an existing chat request, return only a candidate visual ID, pass the same validation/diversity gate, and never make a second paid request or generate imagery. Explicit approval is required before implementation.
