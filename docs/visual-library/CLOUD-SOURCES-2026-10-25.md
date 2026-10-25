# Verified cloud-only source migration

## Full-resolution source archive — 2026-10-25

The user requested cloud-only source masters. All 48 full-resolution originals (65,804,902 bytes) were uploaded without overwriting runtime JPEGs to visual-library/originals/{category}/{original-filename.ext}. All six frozen reference originals (2,901,350 bytes) were independently verified at references/{filename}. These braces denote placeholders: actual object URLs contain no braces; literal braces return HTTP 400.

Every cloud source was downloaded and checked against its original byte length and SHA-256 before the 54 local masters were removed. Stable IDs, original hashes and extensions are unchanged. The historical originalPath is retained for provenance/deduplication; originalUrl is the usable full-resolution URL. assets/visual-library/source-archive.json records all 54 URLs, expected bytes, immutable hashes and verification timestamps. Uploaded staging copies were also removed after verification.

Runtime card/hero JPEGs keep their existing visual-library/{category}/{name}.jpg URLs; they were not overwritten with large originals. The backend loads local manifest metadata and validates lightweight runtime derivatives, so DeepSeek selection does not require local full-resolution masters and does not receive source bytes or source URLs. Six theme image/preview URLs now use the verified references bucket. Lightweight optimized local derivatives remain available for validation and maintenance.

Run node tools/source-archive.cjs to verify all remote source bytes again. Add --cache only for intentional image maintenance; it downloads checked files under ignored output/visual-source-cache, not into the removed source directories. Card/contact-sheet tools resolve that cache when local masters are absent. Legacy tools that require a full source tree need an explicit temporary restoration for maintenance; never silently restore deleted originals.

The old Git history still contains previous image commits. This task removes working-tree sources and records Git deletions; it does not rewrite history or force-push.

## Verification results

- All 54 full-resolution cloud objects passed a fresh download, exact byte-length and SHA-256 check immediately before deletion. No local master files remain at the registered historical paths.
- All 48 existing runtime JPEG URLs were independently fetched and verified after migration; none was overwritten.
- Manifest synchronization and source/archive validation passed after deletion. All stable IDs and original hashes are preserved.
- Backend visual-selection MockTransport suite: 10 passed after local source removal. No paid model call was made.
- Source archive tests: 3 passed; ingestion/storage/build-pruning tests: 18 passed.
- TypeScript passed. The affected visual-library/theme/chat-image/storage tests passed in the post-deletion frontend run. The complete frontend run recorded 319 passes, one conversation-drawer timeout and an unhandled uni teardown error from plan-actions; the full suite is not marked green.
- Mini Program build and native compiler checks passed: 37 WXSS, 59 WXML. This is not physical-device or simulator-interaction acceptance.
- Git history is preserved and nothing is pushed. Existing unrelated working-tree edits remain outside this commit.


## Packaged image/audio budget — 2026-10-25

WeChat DevTools checks the aggregate size of media in the compiled package, not each file separately. The installed IMAGE_AND_AUDIO_LIMIT implementation sums matching compiled files and requires totalBytes / 1024 < 200 (strictly below 204,800 bytes). Its extension list includes SVG, audio and MP4 as well as raster images. The linked tutorial is https://developers.weixin.qq.com/community/develop/doc/00040e5a0846706e893dcc24256009 . The rule was verified in the installed DevTools implementation because the tutorial could not be fetched.

The initial formal package contained 1,513,449 media bytes even though no individual file exceeded 200K. A further 32 approved presentation/legacy images (1,390,696 bytes) now use verified objects under visual-library/app-media/ without modifying their bytes or overwriting existing objects. apps/miniprogram/src/app-media.json contains their public URLs, lengths, SHA-256 values and verification timestamps. resolveAppMedia handles opening slides and legacy imagery; resolveStoredVisualPath retains its existing visual mapping and uses this exact fallback map. Small controls, avatars, icons and four explicit Discover fallback thumbnails stay local. Lightweight source derivatives remain available to backend validation and maintenance.

The Mini Program Vite writeBundle hook runs after static copying for both development and release builds. It removes only exact verified cloud-backed artifact copies and fails if aggregate media reaches 200KiB. tools/check-mp-media.cjs and the native artifact checker independently enforce the same rule. Unexpected or changed files are not silently removed. Editing a static source while the development static-copy watcher is active can copy it again; rerun a complete build and the budget check before upload.

Both fresh development and release builds measured 131 media files, 183,372 bytes (179.07KiB), below the limit. The release build passed native compilation (38 WXSS, 60 WXML). Focused frontend tests passed 29/29; tool tests passed 24/24; TypeScript passed. Backend visual-selection MockTransport tests and manifest validation passed. These results do not claim physical-device image loading or a fresh UI code-quality-panel scan. Recompile the current project and rerun its code-quality scan; do not reuse a pre-migration result.

The commit contains only this cloud/source and media-budget work. Other in-progress UI/API edits remain outside it. No push or Git history rewrite is authorized.
