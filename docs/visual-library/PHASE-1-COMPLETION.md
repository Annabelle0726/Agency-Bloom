# Phase 1 completion report — visual asset library

Date: 2026-10-22. Scope: source migration, manifest, resolver, page integration, validation, native acceptance, documentation. Phase 2 is **not implemented**.

**Result: 14 of 14 Phase 1 items complete.** Two native limitations remain explicitly unverified and are listed at the end; they are not represented as passed.

## 1. Source migration and provenance

All 28 source images were migrated into `assets/visual-library/originals/{direction,reflection,growth,rest}/` with their original extensions and bytes preserved. Totals: **28 images / 25,224,949 bytes** (10 from the earlier design set, 18 from the generated set). Categories: direction 7, reflection 11, growth 2, rest 7, plus 1 design reference. Every old-to-new path, stable ID, byte count, and SHA-256 is recorded in `docs/image-asset-migration-map.md`. The old source directories no longer exist.

## 2. Six theme references unchanged

The six files under `design/themes/references/` are byte-identical to `HEAD`. Recorded before/after SHA-256 values, including `ALL_REFERENCES_UNCHANGED = true`, are in `docs/IMAGE-ASSET-AUDIT.md` and enforced by the validator.

## 3. Manifest contract

`assets/visual-manifest.json` has 28 entries with stable IDs, descriptions, tags, mood, intended pages, roles, theme compatibility, source paths, source hashes and sizes, dimensions/aspect ratio, status, deploy flag, source groups, and runtime/hero variants. The generated Mini Program copy is byte-identical (38,967 bytes). No path is invented and no dark variant is claimed without a real file.

## 4. Runtime deployment

**22 deployed, 5 archived, 1 reference-only**; 20 card-capable and 8 hero-capable; 28 unique runtime files. Phase 1 adds 13 cards (224x360 JPEG quality 73/MozJPEG, 157,887 bytes) under `apps/miniprogram/src/static/visuals/`. Existing `static/bloom` and `static/themes` paths remain intact. Archived masters have no runtime variants. The design reference is excluded from selection.

## 5. Deterministic resolver

`apps/miniprogram/src/visual-library.ts` exposes the exact contract `resolveVisual(context, theme, role, usedVisualIds)`. It filters page, role, theme, real variant, category, tags, preferred IDs, source groups, used IDs, and used original paths. An optional `aspect` value acts as a soft source-aspect ranking signal. Preferred IDs win first; otherwise ranking is deterministic and ties use stable ID comparison, not locale. It returns `null` when no legal candidate exists. It performs no network, model, filesystem, or image-generation work.

## 6. Discover integration

Discover uses the approved hero and three question cards without changing the three questions, draft-entry actions, or adding copy. The hero source is seeded into `usedVisualIds`, so no card repeats the hero. Dark intentionally shows two image cards plus one text-only card rather than relabeling daylight imagery. See the per-page matrix below.

## 7. Explore integration

There is no new Explore route. `ChatExploreVisual.vue` adds one compact local visual to the chat/exploration welcome screen above the starter chips. It adds no primary action and no dense descriptive copy; the image is atmosphere only.

## 8. Plan integration

Plan keeps the approved hero, decision fields, edit/lifecycle actions, and stored text. A portrait decision image occupies 78x104 (70x92 on narrow layouts) at the top right of the decision overview. It never replaces the edit affordance and does not increase page text density.

## 9. Theme transition behavior

Theme changes only re-resolve local paths. They do not change IDs, reorder cards, call a model, generate an image, or create a second request. If the selected visual is not compatible with the new theme, the resolver falls back deterministically. The app/account theme was restored to `dawn`; a simulator refresh retained `dawn`.

## 10. Visual diversity and fallback

Within one screen, the resolver excludes used IDs and used original paths, so crop siblings cannot repeat. Discover additionally excludes the hero from its cards. Cross-page choices favor distinct assets. The dark theme's cross-page night-asset reuse is intentional because only three real night sources exist. Any empty slot degrades to text/styling or `null`; it never substitutes an irrelevant image.

## 11. Automated validation

- `npm run check:visuals` — passed: 28 visuals, 22 deployed, 5 archived, 1 reference-only, 20 card-capable, 8 hero-capable, 28 runtime files, six references unchanged.
- `npm run typecheck` — passed.
- `npm run test:ui` — 19 files / 117 tests passed.
- `npm run test:api` — 222 passed, 1 skipped.
- `npm run test:tools` — 2 passed.
- `npm run build:mp` — passed; 14 WXSS / 41 WXML compiler checks; production output 2,515,650 bytes / 341 files.

Manifest validation covers paths, schema, source SHA-256/bytes, dimensions, frozen theme references, stale legacy references, duplicate runtime paths, and canonical/runtime identity. Resolver tests cover determinism, the soft aspect preference, same-screen duplicate prevention, hero/card collisions, dark text-only fallback, all-theme fallback to `null`, and absence of network/model access.

## 12. Native acceptance

WeChat Developer Tools native simulator, `apps/miniprogram/dist/build/mp-weixin` (not H5):

- Device reported: iPhone 15 Pro Max, 430x932, pixelRatio 3, SDK 3.17.3.
- Six themes checked: light, dark, dawn, forest, lavender, minimal.
- Discover hero + cards checked for every theme, including the dark text-only third card.
- Explore welcome visual checked for every theme.
- Plan hero + decision image checked for every theme.
- Plan edit modal opened/closed; Plan scrolled without breaking composition.
- Theme appearance selected each theme; account theme restored to `dawn` and persisted through simulator refresh.
- No new chat message was sent and no paid model call was made.
- No visible horizontal overflow at 430px.

Evidence: `output/visual-native/` (local, not shipped). Committed evidence: five page-grouped contact sheets and a real-image Dawn composition preview under `docs/visual-library/`.

## 13. Documentation and evidence

- `docs/VISUAL-ASSET-SYSTEM.md` — architecture, resolver, page IDs, diversity rules, Phase 2 contract.
- `docs/IMAGE-ASSET-AUDIT.md` — final audit, hashes, deployment, native limits.
- `docs/image-asset-audit.csv` — 28-row machine-readable source audit.
- `docs/image-asset-migration-map.md` — every old-to-new path with hash and ID.
- `assets/visual-library/README.md` — source ownership and maintenance rules.
- `docs/visual-library/` — contact sheets, composition preview, evidence README.
- `docs/BLOOM-PAGES.md` — updated page design and acceptance notes.

## 14. Scope and Phase 2 status

Phase 2 is **not implemented**. No DeepSeek visual-selection request, second paid call, model-based matching, or runtime image generation was added. The interface contract is documented in `docs/VISUAL-ASSET-SYSTEM.md` section 8: reuse an existing chat request, send compact candidate metadata, return only a candidate ID, validate against the manifest/diversity gate, and fall back deterministically. Implementation requires explicit approval after Phase 1 acceptance.

## Per-page Visual ID list

### Discover

| Theme | Hero | Card 1 | Card 2 | Card 3 |
| --- | --- | --- | --- | --- |
| light | `misty_lake_meadow_01` | `window_seat_01` | `forest_path_pink_01` | `sunlit_meadow_path_01` |
| dark | `night_lake_reading_01` | `moonlit_forest_01` | `moonlit_lake_01` | text-only |
| dawn | `dusk_lake_reading_01` | `golden_desk_book_01` | `autumn_forest_path_01` | `sunlit_meadow_path_01` |
| forest | `forest_sunbeam_path_01` | `sunlit_window_book_01` | `forest_path_green_01` | `bluebell_forest_01` |
| lavender | `lavender_lake_reading_01` | `window_seat_01` | `forest_path_violet_01` | `bluebell_forest_01` |
| minimal | `ivory_window_reading_01` | `sunlit_window_book_01` | `sunlit_meadow_path_01` | `window_seat_01` |

### Explore

| Theme | Welcome visual |
| --- | --- |
| light | `sunlit_book_desk_01` |
| dark | `night_lake_reading_01` |
| dawn | `window_seat_01` |
| forest | `sunlit_book_desk_01` |
| lavender | `sunlit_book_desk_01` |
| minimal | `sunlit_book_desk_01` |

### Plan

| Theme | Hero | Decision image |
| --- | --- | --- |
| light | `window_lake_desk_01` | `misty_lake_canoe_01` |
| dark | `night_lake_reading_01` | `moonlit_lake_01` |
| dawn | `dusk_lake_reading_01` | `misty_lake_canoe_01` |
| forest | `sunlit_desk_01` | `misty_lake_canoe_01` |
| lavender | `lavender_lake_reading_01` | `sunlit_window_book_01` |
| minimal | `ivory_window_reading_01` | `misty_lake_canoe_01` |

Dark Plan's `moonlit_lake_01` and dark Explore's `night_lake_reading_01` are cross-page reuse, not same-screen duplicates. Dark Discover's third card is intentionally text-only.

## Explicitly unverified

1. **320px native layout.** The available automation did not expose a device-size control; `systemInfo` stayed at 430x932. Browser/H5 captures were not substituted.
2. **Physical-device hit targets.** The automator cannot select uni-app custom components by selector, so interactions were invoked through native component event emitters. Modal/tab transitions, scrolling, and visual state were verified; physical finger-coordinate hit geometry was not.

Phase 1 stops here. Phase 2 implementation needs explicit approval.
