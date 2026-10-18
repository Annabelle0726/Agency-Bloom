# Conversation workspace validation — 2026-10-18

## Scope and isolation

Verified with synthetic data only. No private conversation database, hosted migration, real WeChat login or paid model request was used. Provider behavior was injected through `httpx.MockTransport`; runtime QA used a fresh temporary SQLite database on localhost port 8018. Native checks ran in a separately copied tourist Mini Program project on automation port 9438, leaving the existing application project's storage alone.

## Results

- Backend: 78 passed, 1 skipped. The skipped test requires a disposable local PostgreSQL database and was not run against a hosted or application database.
- Frontend: 64 passed across 11 test files.
- TypeScript/Vue type checking: passed.
- Python lint: passed.
- Existing tool tests: 2 passed. Their deliberate disabled-service-port error is an expected fixture, not a validation failure.
- Native compilation: 11 WXML and 11 WXSS files compiled with the installed WeChat compilers. The toolchain emits existing Sass legacy-API deprecation warnings.
- Native simulator: iPhone 12/13 (Pro), 390 × 844 logical pixels. No runtime exceptions; zero paid requests.

Native interactions covered right-edge drawer geometry, creating independent conversations, retaining A/B drafts while switching, delivering a slow A reply only to A, reviewing a generated summary before persistence, creating/enabling/merging/disabling memory, archiving/restoring without ending the exploration, restoring the last selected conversation after relaunch, restoring retained messages, and confirming unsent drafts do not survive relaunch.

The backend additionally covers ownership failures, explicit cross-exploration references, memory scope/removal, stable message cursor pagination, default/non-retained behavior, summary purge, optimistic memory merge, idempotent legacy migration and invalidation of in-flight requests. A stale authentication-permission regression test first demonstrated that a revoked request reached the mock provider; admission now locks and refreshes current permission before generation and the test passes without an upstream call.

## Issues found during verification

Native drawer clicks originally bubbled to the backdrop, closing the drawer on internal actions. Adding an explicit container stop-propagation handler fixed the reproduced interaction. Geometry checks wait for the entry animation to settle. This Developer Tools version can retain stale automation bindings after relaunch; the isolated QA helper reconnects to the same dedicated port before reading native page state.

## Remaining validation boundaries

No real-device keyboard/IME, accessibility-reader, narrow-device or production PostgreSQL acceptance is claimed. The simulator result does not establish those properties. Live model response quality, hallucination rate and provider pricing correctness were not evaluated by these mocks. No deployment or hosted schema migration was performed. Summaries remain bounded to reviewed summary plus recent messages, not an unlimited transcript search.

Repeatable QA instructions are in [CONVERSATIONS.md](CONVERSATIONS.md) and the two conversation QA helper headers. Screenshots and the machine-readable native report are generated under ignored `output/conversations/`; they contain only synthetic test text and are not committed.
