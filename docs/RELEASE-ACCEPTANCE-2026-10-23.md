# Conversation and interface acceptance — 2026-10-23

## Result and scope

Starting revision: `8077dac`. This reviews the pending conversation-quality,
evaluation-guard, optional Perspective Shift, streaming/selection/error-recovery,
consent, shared-avatar, icon and home-theme changes. It is an engineering review
and offline acceptance pass, **not a live DeepSeek quality evaluation or a release
approval**. The original eight-request CNY 3.05 experiment remains BLOCKED.

The repository's local `project.config.json` changes are IDE preferences and are
excluded from the implementation commit. No environment file, formal account,
private transcript, production database or budget ledger was changed. API tests
and UI fixtures use disposable SQLite, fictional identities and MockTransport.
No real provider request or paid judging model was used.

## Code and contract review

- Context remains scoped to one conversation, reviewed summaries, explicitly
  linked cards and enabled matching memories. Recent turns are bounded; earlier
  relevant exchanges remain verbatim. Changed schedules are marked for checking
  only in the request-local context, without changing saved personal facts.
- Suggestions, summaries, phase changes and memories retain explicit review/save
  boundaries. Ordinary conversation can omit a suggestion. Model-output and
  source validation do not establish semantic truth or therapeutic suitability.
- Normal chat has one opted-in provider stream. Public reply previews are
  provisional; final schema, usage and finish checks precede persistence.
  Cancellation/failure preserves inputs, with no automatic model retry.
- Response explanations remain optional, extractive and evidence-linked. Raw
  provider reasoning is neither a UI artifact nor a persisted/debug artifact.
- Evaluation admission and monthly reservations share a transaction; duplicate
  dispatch, ninth attempts, price/contract drift, unknown cost and restarts are
  covered by offline tests. Hosted token/framing bounds are still unverified,
  so the guard rejects real transports. A local byte count is not hosted billing
  proof. The CNY 100 AI allocation and 4096 output cap are unchanged.
- Perspective Shift remains default-off and explicitly limited to its isolated
  Mock prototype. Its evidence and suppression tests are contract tests; a real
  quote can still be misinterpreted. It does not add another model call or modify
  the frozen baseline inputs, system hash or rubric.

## Found and corrected

The three Home focus rows inherited uni-app/WeChat's light button background
instead of using the enclosing theme surface. In Quiet Night, measured H5 styles
were `#e8edf4` text on `#f8f8f8`, about 1.11:1 contrast. The new focused regression
reproduced that failure before the fix. `themes.scss` now explicitly uses a
transparent row and removes the native pseudo-element border. Existing panel,
theme colors, tag colors and geometry are retained.

The H5 helper checks title and secondary-text contrast at the composited panel
gradient endpoints for all six themes. This is a CSS-surface calculation, not a
native pixel/a11y certification. Settled dark-theme screenshots were visually
checked after the correction.

One independent Oil UI review of the current H5 screenshots identified this
contrast defect. The primary reviewer then checked the corrected result.
Initially pale Settings/chat/opening captures were entrance-animation timing,
not evidence for changing their palette. The helper now waits for finite
animations and the visible theme-save state before taking evidence or closing
the sheet. Previously approved auth/opening button shapes are preserved.

A second reproducibility defect was confirmed with Git checkout filtering under
`core.autocrlf=true`: the frozen manifest and rubric became CRLF and failed their
byte-level SHA-256 contracts. Narrow `.gitattributes` entries now enforce LF for
those two files and the offline `cases.json` corpus, whose raw hash is used by
matched comparisons. All three input files and pinned hashes are unchanged. Three
tooling regressions exercise real Git filters in temporary repositories with autocrlf
true, false and input, without altering the application working tree or Git config.

A suspected cross-conversation status-recovery error was not reproduced through
the complete UI flow. No speculative recovery refactor was introduced.
No other significant copy defect was found in the reviewed states; privacy,
demo and uncertainty disclosures remain visible.

## Executed checks

| Check | Result |
| --- | --- |
| Full API suite | 265 passed, 1 skipped |
| Optional PostgreSQL integration | Skipped: disposable PostgreSQL not configured |
| Ruff, app and tests | Passed |
| TypeScript | Passed |
| Frontend | 174 passed in 31 files |
| CLI/tooling tests | 5 passed, including 3 byte-hashed fixture checkout regressions |
| Visual ingest/storage/pruning tests | 18 passed |
| Mini Program production build | Passed |
| Native compilers/reference checks | 20 WXSS, 47 WXML passed |
| Whitespace/diff check | Passed |
| Repeated H5 interaction run | 10 groups passed in each of 3 consecutive final runs |
| Paid requests | 0 |

The final application code changed after baseline only in the focus-row CSS;
backend code was not modified during this pass. Frozen-file Git attributes and
their tooling checks were added independently of application behavior. Existing Sass legacy-API warnings
and Git CRLF notices are nonfatal; they are not hidden as application failures.

## H5 interaction coverage and reproduction

`tools/verify-release-h5.cjs` asserts the isolated fixture marker on port 8018
before operating. Run `tools/mock-conversations-api.py`, then the actual Vue app
in a dedicated terminal with process-only
`VITE_API_BASE_URL=http://127.0.0.1:8018/api` and H5 port 5188. Point
`PLAYWRIGHT_MODULE` and, if needed, `PLAYWRIGHT_BROWSER` at existing local
installations. Run the helper from the repository root. Do not point it at a
formal service. `--focus-only` runs the dark focus-row regression alone.

Ten groups cover opening/login consent; six persisted themes across Home, Plan,
Discover, Settings and chat; unsent independent Discovery drafts; malformed
replies, preserved input and successful recovery; failed status lookup isolation;
AI-consent save failure/no provider call; reviewed summaries and separately
confirmed memories; explicit card saves and reload; conversation archive without
removing its exploration/memory; and 320/360/430px layouts. Default viewport is
390x844. The six-theme flow creates 30 page captures. All test identities and
quoted material are synthetic. Mock output is not claimed as model quality.

Evidence: `output/release-acceptance/h5/`; final repeated reports and logs:
`output/acceptance-20261023-sim/h5-final-1.json` through `h5-final-3.json`.
Screenshots are full-page H5 captures with a fixed-navigation viewport; the
navigation appearing halfway down a tall capture is not alone an occlusion bug.

## Native simulator boundary and remaining work

The installed Developer Tools Nightly is `2.01.2602282`. The existing project
returned SDK `3.17.4`, but `App.getPageStack` did not respond within the bounded
probe. Fresh tourist/minimal copies did not return a usable runtime either.
Matching the working project's compiler settings did not establish page control.
The user separately confirmed that their normal simulator page displays.
These observations do not prove an application-rendering failure or a particular
SDK incompatibility.

The proposed native Mock workflow stopped during preflight, before switching the
simulator to a fictional session or running its interaction helpers. The blocked
runner was stopped and the normal development project was reopened. No native
flow is recorded as passed. The compiler checks and H5 results above must not be
represented as native UI acceptance.

Remaining gates: restore reliable native page control, then rerun the existing
isolated consent/error/streaming/conversation/Perspective/Moment helpers against
the current sources. Native keyboard/safe-area layout, selected-range dragging,
real phone tilt and clipboard interaction remain unverified this pass. Hosted
PostgreSQL concurrency and actual DeepSeek naturalness, continuity, grounding,
latency and cost also remain unverified. Keep the live experiment and production
Perspective Shift disabled until their respective prerequisites and approvals.
