# Workspace review — 2026-10-25

## Scope

Review and commit of the full pending workspace: grounded Discover angles and reading states, Home continuity records, explicit Plan review and attempt status, exploration-scoped memory sync, conversation pinning, onboarding and mobile surface refinements, embedded entry typography, and supporting documentation/migrations.

## Corrections during review

- Restored absolute full-viewport positioning of the auth photograph and shade. A gradient edit had overwritten the shared positioning rule, allowing the image to take up normal document flow. Explicit edge offsets now keep the photograph behind the content.
- Kept the latest opening copy compact and rebuilt its embedded font subset, including the auth heading. Font provenance, license and glyph hashes are committed with the generator.
- Added guards against stale conversation activation after account changes and against overwriting a retained draft when a Discover destination finishes loading. Plan save/refinement completion cannot update another account or exploration's busy/error state.
- Updated approved visual-source assertions to recognize exact verified app-media URLs after the earlier cloud migration.
- Recovered the frozen evaluation system prompt from commit e6cf02d7. Its existing SYSTEM_SHA is unchanged. Normal product wording is independent; altered evaluation fixtures and wire prompts remain rejected. All paid-dispatch, reservation, budget and review gates remain intact.
- The release command now runs the complete media finalizer after compilation/static copying, rather than pruning only visual-library copies. This closes the observed late-copy packaging gap.
- Flushed pending Vue ticks before removing test globals in Plan action tests, eliminating an unhandled test teardown callback.

## Verification

- TypeScript check passed.
- Frontend: 341 tests passed across 63 files, without unhandled errors on the final run.
- Backend full regression: 337 passed, one skipped, and one multiprocessing reservation test timed out while the machine was under load. That unchanged concurrency test passed three consecutive isolated reruns (4.40s, 3.36s, 3.92s). All 17 frozen-evaluation tests also passed as a group.
- API Ruff lint passed after import ordering was corrected.
- Tool checks passed (5 tests); visual tooling tests and manifest synchronization/validation passed. The visual manifest retains 48 entries, 42 deployed, six archived, and unchanged frozen theme references.
- Formal Mini Program build and bundled native WXML/WXSS compiler checks passed. Packaged image/audio total: 183,372 bytes, below the strict 204,800-byte limit.
- H5 checks at 390x844, 375x812 and 320x640 verified compact final copy, scrollable closing text, full background geometry, embedded auth heading glyph rendering, and reachable consent/login controls. These are layout checks, not native-device acceptance.
- Staging audit found no private environment files, databases, private keys or recognized provider-secret formats. Ignored runtime output, ledgers and credentials are not part of this commit.

## Remaining acceptance limits

The separate tourist Mini Program project opened through the CLI, but runtime automation timed out. Native simulator interaction, physical-device typography/motion and image-loading latency are not marked passed. No real model/TTS call, production database migration, push or deployment was performed. The conversation pin migration is included as source only.

Detailed transient logs and H5 evidence are under output/review-all-20261025/ and output/entry-polish-20261025/.
