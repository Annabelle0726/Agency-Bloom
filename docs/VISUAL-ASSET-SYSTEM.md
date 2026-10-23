# Visual asset system

Status: **Seven-category local ingestion complete; manual cloud upload pending.** Last updated 2026-10-23.

Current inventory: **48 originals, 42 deployed, 6 archived**. See [applied rename map and upload handoff](visual-library/LOCAL-INGESTION-2026-10-23.md). Existing visual IDs and all six frozen theme references are preserved. Runtime URLs are prepared but remain local until manual uploads pass HTTP/MIME/content-hash verification. Sections with Phase 1 counts below are historical baselines; the canonical manifest is the current source of truth. AI image selection remains unimplemented in main.

Phase 1 replaces ad-hoc page imagery with a provenance-tracked source library, an explicit runtime manifest, and a deterministic resolver. It keeps the existing visual language: quiet nature photography, reading corners, soft paper surfaces, and restrained theme-derived color. Imagery supports the page; it does not replace the page's primary action or add explanatory text.

## 1. Goals and non-goals

Phase 1 goals:

- Keep every original image, preserving extension and bytes, outside the Mini Program package.
- Give every image a stable ID, category, description, tags, page suitability, role, theme compatibility, source hash, and deployment status.
- Reference only real runtime files. Never invent a dark variant or imply that a daylight image is a night image.
- Select visuals deterministically by page, role, theme, tags, aspect, exclusions, and fallback.
- Prevent an image or crop variant from repeating on the same screen.
- Let a theme change re-resolve paths only: no model call, no image generation, no ID change, and no card reorder.
- Keep Discover, Explore, and Plan visually distinct, with no increase in text density and no buried primary action.

Phase 1 non-goals:

- No DeepSeek image-selection request.
- No new paid model call.
- No image generation at runtime.
- No automatic deletion of archived masters.
- No physical-device acceptance substitute using H5 screenshots.

## 2. Phase 1 source and runtime layout (historical baseline)

```text
assets/visual-library/
  originals/
    direction/     7 originals: forest paths, meadow paths, lake canoe
    reflection/   11 originals: reading desks, windows, seats, lakeside
    growth/        2 originals: lavender lake, bluebell forest
    rest/          7 originals: lake, moon, forest, night reading
  references/
    reference_bloom_pages_pair_01.png   design reference only
  recipes/
    bloom-pages.json                    legacy theme crop recipe
    visual-cards.json                   new 224x360 card recipe

docs/
  image-asset-audit.csv                 source-of-truth inventory
  image-asset-migration-map.md          old path -> new path -> ID -> SHA-256
  visual-library/
    contact-sheets/*.jpg                committed evidence sheets
    page-composition-preview.jpg        real-image composition preview

apps/miniprogram/src/static/
  bloom/      23 legacy theme JPEG derivatives (602,126 bytes)
  themes/     12 theme reference/atmosphere files (327,450 bytes)
  visuals/    13 new card derivatives (157,887 bytes)
```

Source totals: **28 images / 25,224,949 bytes** (10 from `design/img`, 18 from `assets/gen-img`). Categories: direction 7, reflection 11, growth 2, rest 7, reference 1. The generated card recipe creates 224x360 JPEG quality 73/MozJPEG derivatives under `static/visuals`; the source masters are never re-encoded for a rename.

Deployment totals: **22 deployed, 5 archived, 1 reference-only**. Of the deployed set, 20 are card-capable and 8 are hero-capable. There are 28 unique runtime files across the manifest.

## 3. Manifest

Canonical file: `assets/visual-manifest.json`. Schema: `assets/visual-manifest.schema.json`.
Runtime copy: `apps/miniprogram/src/visual-manifest.json` (generated; must remain byte-identical).

Every entry includes:

| Field | Meaning |
| --- | --- |
| `id` | Stable snake_case ID; never derived from the opaque original filename |
| `category` | `choices`, `connection`, `direction`, `growth`, `reflection`, `rest`, or `transition` |
| `description` | Human-readable Chinese description used by future selection prompts |
| `tags`, `mood` | Search/ranking vocabulary |
| `intendedPage` | `discover`, `explore`, `plan`, `shared`, `reference-only` |
| `visualRole` | `hero`, `page-background`, `card-thumbnail`, `section-illustration`, `decorative`, `reference-only` |
| `themeCompatibility` | Themes for which a real variant exists |
| `source` | ChatGPT-generated or user-supplied design reference |
| `originalPath` | Source master path outside the app package |
| `sourceSha256`, `sourceBytes` | Integrity and size evidence |
| `dimensions` | Original width, height, and aspect ratio |
| `status`, `deploy` | `deployed`, `archived`, `reference-only`; runtime candidate flag |
| `sourceGroup` | Provenance family used to prevent sibling crops from repeating |
| `runtimeVariants` | Theme -> card/illustration runtime path |
| `heroVariants` | Theme -> hero/background runtime path |

Rules enforced by `tools/validate-visual-manifest.cjs`:

- Every path exists and is inside the expected source/runtime roots.
- Source SHA-256 and byte size match the manifest.
- Runtime paths exist; dimensions and aspect ratio are valid.
- Deployed entries have at least one usable runtime variant.
- Archived entries have no runtime variants; reference-only entries are not deployable.
- No two different visual IDs share the same runtime path.
- The six frozen theme reference files are byte-identical to their recorded hashes.
- The canonical manifest and generated Mini Program copy are identical.

Validate with:

```bash
npm run check:visuals
```

This runs `visuals:sync --check` and `visuals:validate`. Regenerate contact sheets with `npm run visuals:sheets`.

## 4. Resolver

Implementation: `apps/miniprogram/src/visual-library.ts`.

```ts
resolveVisual(
  context: VisualContext,
  theme: string,
  role: VisualRole,
  usedVisualIds: readonly string[] = [],
): ResolvedVisual | null
```

`VisualContext` contains `page`, optional `category`, optional `tags`, optional `aspect` (a soft source-aspect preference), optional `preferredIds`, and optional `excludeSourceGroups`. `VisualRequest` adds the explicit `role` used by `resolveVisualSet`.

The resolver:

1. Normalizes the theme through `resolveTheme`.
2. Keeps only deployed, runtime-ready entries for the requested page.
3. Requires the requested role and a real variant for the active theme.
4. Applies category, tag, preferred-ID, excluded-source-group, and used-ID filters.
5. Excludes any candidate whose `originalPath` is already used on the same screen. This prevents a crop of the same source from appearing twice.
6. Returns the first valid preferred ID, otherwise ranks candidates by category, tag matches, theme fit, and closeness to the optional aspect preference. Ties resolve by stable ID comparison, not locale.
7. Returns `null` when nothing legal is available. The UI must degrade to text-only or styling; it must not substitute an irrelevant image or repeat one.

Page helpers:

- `resolveDiscoverVisuals(theme)` returns the legacy hero path plus up to three resolved cards. The hero ID is seeded into `usedVisualIds` so a card cannot repeat the hero source.
- `resolveExploreVisual(theme)` returns one compact welcome visual.
- `resolvePlanVisual(theme)` returns the decision-card visual, seeded with the Plan hero ID.

The resolver has no network, model, filesystem, or image-generation access. Theme changes call the same data and re-resolve paths; selected IDs and card order stay stable.

## 5. Page integration and current IDs

### Discover

`DiscoverView.vue` uses the thematic hero and three question cards. Integration preserves all three original questions and their draft-entry actions. The new visuals do not add copy.

| Theme | Hero | Card 1 | Card 2 | Card 3 |
| --- | --- | --- | --- | --- |
| light | `misty_lake_meadow_01` | `window_seat_01` | `forest_path_pink_01` | `sunlit_meadow_path_01` |
| dark | `night_lake_reading_01` | `moonlit_forest_01` | `moonlit_lake_01` | none (text-only card) |
| dawn | `dusk_lake_reading_01` | `golden_desk_book_01` | `autumn_forest_path_01` | `sunlit_meadow_path_01` |
| forest | `forest_sunbeam_path_01` | `sunlit_window_book_01` | `forest_path_green_01` | `bluebell_forest_01` |
| lavender | `lavender_lake_reading_01` | `window_seat_01` | `forest_path_violet_01` | `bluebell_forest_01` |
| minimal | `ivory_window_reading_01` | `sunlit_window_book_01` | `sunlit_meadow_path_01` | `window_seat_01` |

### Explore

There is no standalone Explore route. `ChatExploreVisual.vue` inserts one compact visual into the chat/exploration welcome screen, before the starter chips. The image is local, fixed-aspect, and does not compete with the composer.

| Theme | Visual |
| --- | --- |
| light | `sunlit_book_desk_01` |
| dark | `night_lake_reading_01` |
| dawn | `window_seat_01` |
| forest | `sunlit_book_desk_01` |
| lavender | `sunlit_book_desk_01` |
| minimal | `sunlit_book_desk_01` |

### Plan

`PlanView.vue` uses the existing thematic hero and a portrait decision-card image (78x104; 70x92 on narrow screens). The image sits in the decision overview; it does not displace the primary edit/lifecycle actions or add text.

| Theme | Hero | Decision image |
| --- | --- | --- |
| light | `window_lake_desk_01` | `misty_lake_canoe_01` |
| dark | `night_lake_reading_01` | `moonlit_lake_01` |
| dawn | `dusk_lake_reading_01` | `misty_lake_canoe_01` |
| forest | `sunlit_desk_01` | `misty_lake_canoe_01` |
| lavender | `lavender_lake_reading_01` | `sunlit_window_book_01` |
| minimal | `ivory_window_reading_01` | `misty_lake_canoe_01` |

### Dark-theme limitation

Only three real night assets exist: `night_lake_reading_01`, `moonlit_forest_01`, and `moonlit_lake_01`. Dark Discover therefore uses two night cards plus one text-only card. Dark Plan uses `moonlit_lake_01`, which also appears as a Discover card, and dark Explore uses `night_lake_reading_01`, the Discover/Plan hero. These are cross-page reuse, not same-screen duplicates. The system does not relabel daylight images as night images to fill slots.

## 6. Diversity and transition rules

- **Hero/card:** the Discover hero source is seeded into `usedVisualIds`; no card may repeat it.
- **Same screen:** used IDs and used source paths are excluded from each subsequent selection.
- **Crop variants:** sharing an `originalPath` is treated as the same image, even if two derivatives crop differently.
- **Cross-page:** the preferences favor distinct images. The dark theme is an explicit exception because only night assets exist.
- **Failure:** if no legal candidate remains, the card or slot is omitted or rendered as text/styling. There is no random or irrelevant fallback.
- **Theme transition:** only paths change. The visual IDs, chosen slots, and card order do not.
- **No model on theme change:** all helpers are synchronous local lookups.

## 7. Validation and test coverage

Covered by `apps/miniprogram/tests/visual-library.test.ts` and `tools/validate-visual-manifest.cjs`:

- Manifest/schema shape and runtime path existence.
- Original source SHA-256, byte size, and dimensions.
- Six frozen theme reference hashes.
- Stale references from old paths.
- Same-screen duplicate detection, including source siblings.
- Discover hero/card collision.
- Theme-specific fallback and all-theme fallback to `null`.
- Stable deterministic matching, preferred-ID behavior, and the soft aspect preference.
- No network/model access in the resolver module.
- Canonical/runtime manifest byte identity.

Useful commands:

```bash
npm run check:visuals
npm run typecheck
npm run test:ui
npm run test:api
npm run test:tools
npm run build:mp
```

## 8. Phase 2 DeepSeek selection contract (design only)

**Not implemented.** This section defines the interface that may be implemented only after explicit approval. There must be no second paid DeepSeek request.

### 8.1 Transport

The existing conversation/chat request is the only model call. A Phase 2 implementation may attach a `visualSelection` request to that existing payload or parse a `visualSelection` field from its existing response. If no such request is available (for example, initial Discover before a conversation), the app stays on the deterministic Phase 1 resolver.

Do not add:

- a separate `/visuals/select` model endpoint;
- a background prefetch;
- a model call triggered by theme changes;
- image generation or re-ranking after a theme change.

### 8.2 Request

Only compact candidate metadata is sent; never image bytes.

```ts
interface VisualSelectionRequest {
  page: 'discover' | 'explore' | 'plan'
  role: 'hero' | 'card-thumbnail' | 'decision-image'
  theme: ThemeId
  slot: string                    // e.g. discover-card-1, explore-welcome, plan-decision
  intent: string                  // short page/question context, no private conversation transcript
  candidates: Array<{
    id: string
    description: string
    tags: string[]
    mood: string[]
    category: string
    intendedPage: string[]
    visualRole: string[]
    themeCompatibility: ThemeId[]
    aspectRatio: number
    sourceGroup: string
  }>
  excludeVisualIds: string[]       // already chosen on this screen
  excludeSourceGroups: string[]    // provenance siblings of those choices
  constraints: {
    maxSelections: 1
    requireThemeCompatible: true
    requireRealVariant: true
    allowNull: true
  }
}
```

### 8.3 Response

The model returns an ID, not a path, URL, filename, or image.

```ts
interface VisualSelectionResponse {
  visualId: string | null
  reason?: string                  // short, user-safe; never shown as a caption by default
}
```

### 8.4 Validation gate

Before use, the client must verify:

1. `visualId` is exactly one of the request's candidate IDs.
2. The candidate is deployed, theme-compatible, and has a real variant for the active theme and role.
3. The candidate is not in `excludeVisualIds` and its `sourceGroup` is not excluded.
4. Same-screen diversity still holds after selection.
5. The response contains no path or arbitrary URL.

Any failure falls back to `resolveVisual(...)` with the same context and used IDs, or to `null`. A model response can never bypass the manifest or the deterministic diversity rules.

### 8.5 Persistence and theme changes

- Persist only the selected visual ID per slot.
- On theme change, re-run `resolveVisualPath(id, theme, role)`.
- If the ID is not compatible with the new theme, fall back deterministically; do not call the model and do not reorder cards.
- Do not persist generated prompts, model reasons, or image bytes.
- Do not send an extra model request to “fix” a fallback.

## 9. Evidence

- `docs/image-asset-audit.csv`: 28-row source audit with final status, deploy, references, and runtime paths.
- `docs/image-asset-migration-map.md`: all old-to-new paths and hashes.
- `docs/visual-library/contact-sheets/`: page-grouped source contact sheets.
- `docs/visual-library/page-composition-preview.jpg`: real-image Dawn composition preview.
- `output/visual-native/`: local native simulator evidence (not part of the app package).

Phase 1 acceptance and the remaining native limitations are recorded in the final report. Narrow native layout and physical-device hit-target checks remain unverified if the tools cannot switch device size or perform physical taps.
