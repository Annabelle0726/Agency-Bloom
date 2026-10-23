# Cloud visual activation and acceptance — 2026-10-23

All 48 manually uploaded JPEG objects passed HTTP 200, MIME, length and exact SHA-256 checks. The canonical upload plan and client config are verified and enabled. No image was uploaded by the agent.

Chat selection reuses the existing model request. Candidates contain reviewed semantic metadata and stable IDs; the model receives no image bytes, source paths or storage URLs. The server validates the returned ID against theme, role, deployment, actual derivative availability, used IDs and source families. Explicit null remains null; malformed or out-of-pool suggestions fall back to one legal candidate. Summaries and explicit crisis language omit optional artwork. Set AGENCY_VISUAL_SELECTION_ENABLED=false to disable new selections.

The client stores the stable ID, resolves its approved Supabase URL locally and hides incompatible or failed images. Compatible theme changes preserve the ID without a model call. The chat image uses the existing theme colors, a 126 × 202 frame, 160 ms load fade and restrained press feedback; reduced motion removes transitions. It is library selection, not newly generated artwork. The local component was self-reviewed in source; visual/device acceptance remains blocked below.

Formal builds now remove only the 48 byte-verified cloud-backed copies from generated output (978,655 bytes). Source derivatives, originals and frozen theme references remain intact. Disabled cloud configuration keeps local copies on the next build. The build pruner validates the complete removal set before deleting anything. The compiler check now supports this installation's code/package.nw path.

## Verification

- All 48 cloud objects verified and activated.
- Current working tree: TypeScript passed; UI 167 passed; API 263 passed / 1 skipped; Ruff passed; original tooling tests 2 passed.
- The first full API run hit the existing multiprocess guard test's 20-second join deadline while a build was running. The guard suite passed 16/16 separately; a sequential full rerun passed 263 / 1 skipped. The skipped test requires PostgreSQL integration configuration.
- Task-only staged source was copied for validation without a Git worktree or branch. TypeScript passed; UI 138 passed; API 197 passed / 1 skipped, then the final visual suite passed 10/10 including two added crisis/history regressions. Ruff passed.
- Task-only formal build passed, including 18 WXSS and 44 WXML native compilations. Visual tooling 18/18 passed, including four build-pruning cases.
- Main working formal build: 1924933 bytes. Task-only formal build: 1884765 bytes.
- Original/source hash tests and all six frozen theme-reference hash tests passed.

## Genuine provider check

Two explicitly requested normal-chat requests used the configured DeepSeek model (deepseek-v4-pro) with fictional adult context and a separate durable QA database. This was not the blocked fixed eight-case evaluation. Both responses were successful, chose distinct valid library IDs and survived conversation reload.

| Turn | Selected stable ID |
| --- | --- |
| 1 | forest_path_green_01 |
| 2 | forest_sunbeam_path_01 |

Recorded estimated QA cost: 0.052857 CNY. No retry occurred. The isolated QA allocation was capped at CNY 1; the normal monthly allocation remains CNY 100. Canonical spending was read only (664327 micro-CNY before and after); the additional QA spend remains separately recorded and must be included in monthly reconciliation. No private transcript, account or production budget row was modified, and backend environment bytes were unchanged. Usage receipts and the separate ledger remain under output/visual-cloud-qa; credentials and provider reasoning are absent from this report.

## Device acceptance remains blocked

The isolated WeChat project opened, but Tool.getInfo returned only the IDE version, with no SDKVersion. The SDK refused connection, App commands did not return, and no physical device or remote-debug QR was established. **Neither simulator UI acceptance nor physical-phone acceptance is claimed.** Compiler success and live backend success do not establish those results.

The repository includes a bounded isolated Mock fixture on port 8032 and a device helper on automation port 9454. It refuses an unavailable runtime and only labels a run physical when systemInfo.platform is not devtools. To resume, build with VITE_API_BASE_URL=http://192.168.1.6:8032/api, prepare a fresh isolated project with tools/verify-visual-cloud-native.cjs --prepare (add --phone-project for the configured AppID), start the fixture and open that project through CLI auto. Start its simulator before running the helper; --remote waits for the user's phone scan. This helper uses MockTransport; genuine provider checks are recorded separately above.

## Output cleanup

Removed 109 obsolete top-level screenshot, log, temporary-script and copied-QA entries, totaling 119996405 bytes. The exact inventory is OUTPUT-CLEANUP-2026-10-23.json.

The output directory itself is retained: native-sdk is used by QA helpers; databases, environment/budget/evaluation records, patches, current-day work, manual upload files and directories containing dependency junctions were preserved. No frozen reference, original visual or intentionally deleted user asset was changed or restored.

Only this task's changes are staged. Pre-existing and concurrently edited application work remains outside the commit.
