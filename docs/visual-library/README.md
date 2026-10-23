# Current inventory — 2026-10-23

See [applied local ingestion and manual upload handoff](LOCAL-INGESTION-2026-10-23.md): 48 originals across seven categories, 42 deployed and 6 archived. The older Phase 1 contact sheets and report below are historical evidence.

# Visual library evidence

This folder contains committed visual-review evidence for the Mini Program asset library. It is documentation only; no file here is loaded by the app.

## Contents

- `contact-sheets/discover.jpg` — hero and question-card candidates for Discover.
- `contact-sheets/explore.jpg` — compact Explore welcome-screen candidates.
- `contact-sheets/plan.jpg` — Plan hero and decision-image candidates.
- `contact-sheets/shared-decorative.jpg` — atmospheric and shared assets.
- `contact-sheets/archive-reference.jpg` — five archived masters and the design reference. None are runtime candidates.
- `page-composition-preview.jpg` — a Dawn-theme composition built from the real runtime files.
- `PHASE-1-COMPLETION.md` — the 14-item Phase 1 report and per-page Visual ID matrix.

Each contact-sheet tile shows:

1. the original filename (bottom, monospace);
2. the stable Visual ID;
3. category, deployment status, and source dimensions;
4. intended page(s), visual role(s), and theme compatibility.

The thumbnails use the source masters with `contain` fit. The app uses separately generated 224x360 card derivatives; the source files are never re-encoded for a rename.

## Regenerate

From the repository root:

```bash
npm run visuals:sheets
```

The generator reads `assets/visual-manifest.json` and writes only this evidence folder. It does not modify source masters, runtime assets, the manifest, or the Mini Program package.

## Reading the sheets

Assets can appear on more than one page sheet because they are valid for more than one surface. That is intentional and is not a same-screen duplicate. The current dark theme has only three real night assets, so dark Discover intentionally shows two image cards and one text-only card; dark Plan and Explore reuse night sources across pages.

See [`docs/VISUAL-ASSET-SYSTEM.md`](../VISUAL-ASSET-SYSTEM.md) for the manifest, resolver, diversity rules, and the Phase 2 selection contract (design only).
