# Visual library inbox

Drop new reference images here with any filenames. Filenames are treated only as
file identifiers; they are never used to infer category, tags, page use or Theme.

## Review flow

1. Run a dry-run (the default):

   ```powershell
   npm run visuals:ingest -- --dry-run
   ```

   This writes a review folder under `inbox/review-YYYYMMDD-HHMMSS/` and does
   not touch the manifest, originals, or runtime images.

2. Optionally add reviewed descriptions in `descriptions.json`. Supported fields
   are `description`, `category`, `tags`, `mood`, `intendedPage`,
   `visualRole`, `themeCompatibility`, `sourceGroup`, and `id`. A plain string
   value is treated as `description`. All semantic fields must come from a
   human-reviewed description, not from the filename.

3. Open `approval-checklist.md` and the contact sheet. Check every row's
   thumbnail, proposed ID/filename, category, page use, Theme compatibility and
   card/hero crop preview. Exact duplicates, likely duplicates and path
   conflicts are marked and cannot be approved by accident.

4. Edit the generated `approvals.json`. Set `approved: true` only for entries
   you reviewed. Unconfirmed entries stay in the inbox and are not imported.

5. Apply the approved batch:

   ```powershell
   npm run visuals:ingest -- --apply --approvals assets/visual-library/inbox/review-YYYYMMDD-HHMMSS/approvals.json
   ```

   `--apply` stages and verifies originals and derivatives, updates both the
   canonical manifest and the Mini Program copy, then validates every reference.
   A failed batch rolls back its files and manifests. Existing images, IDs,
   paths, source bytes and accepted page combinations are never renamed, moved
   or overwritten.

## Contract

- Accepted formats: JPEG/JFIF and PNG. Source bytes and the original extension
  are preserved under `assets/visual-library/originals/<category>/`.
- Card derivatives are 224×360 JPEG (q73, MozJPEG). Hero derivatives are
  750×940 JPEG.
- New entries are only appended as `deployed` after approval. There is no
  `needs-review` manifest status; unreviewed files remain inbox-only.
- Repeated `--apply` is idempotent. If an entry already exists with the same
  SHA-256, missing derivatives are repaired instead of adding a second entry.
- Theme reference files under `design/themes/references/` are frozen and are
  never modified by ingestion.
