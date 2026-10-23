# Local visual ingestion and manual storage handoff — 2026-10-23

Implemented directly on main. This is an applied migration, not a dry run.

## Result

- 22 pending local files were inspected and semantically renamed.
- 20 new distinct images were deployed; their approved metadata is in batch-2026-10-23/approvals.json.
- One byte-identical conversation image remains archived as a separate original, with the same sourceGroup as its deployed canonical image.
- rest.jfif is byte-identical to the existing bluebell_forest_01 master. Its stable ID is retained and its source now lives in rest/rest_bluebell_forest_01.jfif. The deleted growth path was not restored.
- The intentionally deleted reference_bloom_pages_pair_01 is removed from the active manifest. Its historical metadata remains in retired-assets.json; its file was not restored.
- Current inventory: 48 records, 42 deployed and 6 archived; all 48 physical originals are registered. There are 47 distinct source hashes.
- All original bytes and six frozen theme-reference SHA-256 values were preserved. The mountain-journal portrait crop was adjusted to keep the traveler and journal visible; its crop rectangle is reproducible from the recipe.
- Existing visual IDs remain unchanged. Three older sources were reclassified, and the bluebell source was relocated.
- No DeepSeek calls, cloud upload, cloud deletion, or Git push occurred.

## Categories

| Category | Originals | Deployed |
| --- | ---: | ---: |
| choices | 4 | 4 |
| connection | 3 | 2 |
| direction | 4 | 4 |
| growth | 8 | 8 |
| reflection | 13 | 10 |
| rest | 9 | 7 |
| transition | 7 | 7 |

## Pending-file rename map

The full machine-readable map includes old paths, new paths, stable IDs and complete SHA-256 values in batch-2026-10-23/migration-map.json. Every row below was applied in the main working directory.

| # | Previous filename | New path under originals/ | Visual ID | Handling | SHA-256 |
| ---: | --- | --- | --- | --- | --- |
| 1 | 661313485a8cd4536ab19f767ff9545a.png | choices/choices_garden_forked_steps_01.png | choices_garden_forked_steps_01 | new-import | cee0a9c508e41279def6f4d5398f56070445c7b60363b731518432444d60377e |
| 2 | db3fb00b39b849a5debb8e68d41bd9f0.png | choices/choices_window_notebook_01.png | choices_window_notebook_01 | new-import | 8dbe2a6f460f1288f010ef65cc9978119c0140751c084a9d156ae7bdd5448db9 |
| 3 | f76bab6b48598053919638ed226066fa.png | choices/choices_mountain_forked_path_01.png | choices_mountain_forked_path_01 | new-import | cd06c071223eacb7878b4c8dc364af68b61e2b6cadbc749568463127a8165391 |
| 4 | 11a8c99d-5108-4da8-a083-429f35aac852.png | connection/connection_garden_conversation_01.png | connection_garden_conversation_01 | new-import | 4158267d1f898dafab377bc29f60d8e5d1bb522fa72e99174eb47d2303a29d1a |
| 5 | 3aa04edb4f2a7404c9fe725a44134449.png | connection/connection_window_tea_conversation_01.png | connection_window_tea_conversation_01 | new-import | d1eacc7d88bd59c8e90002153074311303e2e2e07059ea30c7f111cb6437c187 |
| 6 | 91a972fd70aef384c3d32bb1ec62a12d.png | connection/connection_window_tea_conversation_duplicate_01.png | connection_window_tea_conversation_duplicate_01 | duplicate-archived | d1eacc7d88bd59c8e90002153074311303e2e2e07059ea30c7f111cb6437c187 |
| 7 | 0859d0556eea49c9e00a25eee56b02a8.png | growth/growth_pottery_wheel_01.png | growth_pottery_wheel_01 | new-import | 0141854a8015dbfc49140637a548dea8c72900ba182576a344878554173afd7c |
| 8 | 2857d79972bf885dd0c9254faef5fdcb.png | growth/growth_sunlit_design_collage_01.png | growth_sunlit_design_collage_01 | new-import | e1c909736702570d24fb51992fe3c71e9f47679338500fd6aa2fbc2372299a0f |
| 9 | 43c478cee1c8083e68690b7b7dbe9d3f.png | growth/growth_sunlit_dance_practice_01.png | growth_sunlit_dance_practice_01 | new-import | 40a5229f22b7a0880f8b2945faad527f22f5d432f5c37a9e6869565e9df01f70 |
| 10 | 4e3b6138e9587478700e71eadd554438.png | growth/growth_window_design_study_01.png | growth_window_design_study_01 | new-import | ee56168c3ef712d9773d7e47ca02cb5d5ca1d64d8ef72dad69c7e4d841876677 |
| 11 | 5279a483f5859bef0e6a0fb9208ca8d3.png | growth/growth_handcraft_stitching_01.png | growth_handcraft_stitching_01 | new-import | 77c2117bdb523638e19053d1be4cd6211ce759db35152e92cef02eb9b0419812 |
| 12 | 94c1dce395682386c962d43501abc45a.png | growth/growth_sunset_canoe_journey_01.png | growth_sunset_canoe_journey_01 | new-import | 3899d8c44d2988a11b4b91b87d4aed90667777683074aa124e7edd55f0630420 |
| 13 | 7313b00f1744bb36ded39de4e2010d9c.png | reflection/reflection_lakeside_sky_lantern_01.png | reflection_lakeside_sky_lantern_01 | new-import | 90c7a1d035b39febb682918a89bbccd10d02e67cd81e5b76b87c7cd6dac95325 |
| 14 | fde401221592b4e907e8f04af111df01.png | reflection/reflection_sunset_mountain_journal_01.png | reflection_sunset_mountain_journal_01 | new-import | 19e7bf5556d532d1e7274a7492bc6d48b1a04347d54c7e3ca29c7aa47f18a1d8 |
| 15 | 01321b82750385073f9aae1a123c052b.png | rest/rest_mountain_paper_plane_01.png | rest_mountain_paper_plane_01 | new-import | a33a116eef56ee752d44c606d753c54832aecaf079f5e9df822509b145a9ef4b |
| 16 | rest.jfif | rest/rest_bluebell_forest_01.jfif | bluebell_forest_01 | existing-relocated | 89866c7b0f8c33092623b6897dcc4e9d8a4588698f24bb6446cdf6b597d2b0f2 |
| 17 | 65eed1d499407f47582bc52addc42985.png | transition/transition_sunlit_new_home_01.png | transition_sunlit_new_home_01 | new-import | 68ce1ffc82aa968bae944e9887210af0b25cc3f47c19a2477ccba84898867585 |
| 18 | 76e749112757266ee39a59bf8a0cbeac.png | transition/transition_storm_to_sunrise_01.png | transition_storm_to_sunrise_01 | new-import | 76da8883c9c16712ffc541c80e24ccb257b063b26e73193695e3e778dd892d0c |
| 19 | 8b587c2d243e8d48a0353638091b68cb.png | transition/transition_sunrise_station_suitcase_01.png | transition_sunrise_station_suitcase_01 | new-import | e765e3a620bf5ee72f2a3a4c4e5dfaec69e41090af15f36c2dedb4d3c9203c5b |
| 20 | Gemini_Generated_Image_c5b4w4c5b4w4c5b4.jfif | transition/transition_golden_station_departure_01.jfif | transition_golden_station_departure_01 | new-import | 6d18da152eb3e6dd55241c7059045b9e371b018bfa60ce92de26ee02e361a5c9 |
| 21 | c5ef92ea88c9583d2902f3a82b0ee2c2.png | transition/transition_open_door_journey_01.png | transition_open_door_journey_01 | new-import | f65a6b910c082b4440bd0fdc77062f9023c4b7f3c0eb8d344e1b7b7735bea7e6 |
| 22 | d250b0dbad5453c7eedcedd2da853736.png | transition/transition_quiet_platform_walk_01.png | transition_quiet_platform_walk_01 | new-import | db23c952988d94dd078cec3127959501bf335ea4866423adebfc2c4e7c9fb86c |

## Existing-source reclassification

| Visual ID (unchanged) | Previous path | Current path |
| --- | --- | --- |
| misty_lake_canoe_01 | assets/visual-library/originals/direction/direction_misty_lake_canoe_01.jfif | assets/visual-library/originals/choices/choices_misty_lake_canoe_01.jfif |
| autumn_forest_path_01 | assets/visual-library/originals/direction/direction_autumn_forest_path_01.jfif | assets/visual-library/originals/transition/transition_autumn_forest_path_01.jfif |
| forest_path_violet_01 | assets/visual-library/originals/direction/direction_forest_path_violet_01.jfif | assets/visual-library/originals/growth/growth_forest_path_violet_01.jfif |

## Manual Supabase upload

Bucket: visual-library. Public base URL: https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/visual-library/

Upload the contents of C:/Projects/Agency-Bloom/output/visual-storage-upload/ into the bucket root while preserving its seven category directories. This folder contains 48 optimized JPEG derivatives (978,655 bytes); archived images, raw source masters and theme-reference originals are excluded.

Object keys, exact public URLs, source IDs, content hashes and local upload files are recorded in assets/visual-library/storage-upload-plan.json. Example:

https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/visual-library/growth/growth_handcraft_stitching_01.jpg

Runtime storage routes are ready in apps/miniprogram/src/visual-storage.json, with enabled=false. Local assets remain active until every uploaded object passes verification. Regenerate the upload folder with npm run visuals:storage.

After manual upload, verify without activating:

    npm run visuals:storage -- --verify

To verify and activate the reviewed URLs together:

    npm run visuals:storage -- --verify --activate

The verifier requires HTTP 200, image/jpeg, byte size and SHA-256 equality for every object. A failed check cannot enable remote paths. It performs no upload. Keep existing cloud objects; do not overwrite a same-name object with different content. Local derivatives are retained in this change.

## Verification

- npm run check:visuals: passed (48 originals, 48 runtime files, frozen theme references unchanged).
- npm run typecheck: passed.
- npm run test:ui: 157 tests passed in 27 files.
- npm run test:visuals: 14 tests passed, including rollback, idempotency, duplicate detection, preserved staged changes, upload verification and URL activation guards.
- npm run test:tools: 2 tests passed.
- npm run build:mp: passed; artifact references and images exist. The native WXML/WXSS compiler check was skipped because Developer Tools was not detected. The build directory is approximately 2.75 MiB, so retaining all local assets still exceeds the historical 2 MiB package limit; this task does not claim to resolve package size before cloud migration.
- Public Supabase URLs, China-mainland network access and WeChat physical-device rendering remain unverified until the user uploads the files and tests on-device. Compiler success is not physical-device acceptance.

## Retired worktree

The C:/Projects/Agency-Bloom-phase2a worktree was removed after preservation checks. The phase-2a branch and its committed offline-selection implementation remain intact; they were not merged into main. Four dirty files and a full binary patch are preserved in C:/Projects/Agency-Bloom-handoff-20261023/, together with their SHA-256 inventory. Unrelated main working-tree changes are excluded from this task commit.
