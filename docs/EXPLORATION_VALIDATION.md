# Exploration update — 2026-10-17

This update was implemented and verified without any new paid model requests. No Git commit or push was made. Existing environment files, accounts and the production/local application budget were not reset. Native QA uses a separate output/exploration/native.db and HTTPX MockTransport; it does not use the real provider even though it exercises the deepseek-mode response contract.

## Root cause and state separation

Before the fix, index.vue initialize() used the same guarded(), busy and error as authentication, saved data and chat. OnboardingFlow received that error and rendered it in every flow footer. An unavailable /api/config therefore placed a backend failure on otherwise local questions and could block navigation while waiting for the request.

The page now has separate init/auth/data/ai errors and busy flags via operations.ts. Initialization does not lock anonymous navigation. Onboarding receives only auth failures, displays them on login or authenticated save, and clears them when leaving that step. Local draft storage has its own error. AI failures appear in chat. The HTTP adapter distinguishes network, timeout, HTTP, authentication, model and cancellation errors, logs only category/status/method/redacted route in development, and suppresses internal server details in UI. Backend generation logs contain only failure category and status.

In actual offline native QA, port 8002 had no listening service. The simulator completed multi-select, mainline, branch response, background, support mode and reflection. Reload restored the step and full draft. Login showed the accurate unavailable-service message; returning to reflection removed it, and anonymous browsing remained usable. A local saved claim is shown only after writing and reading back the same draft. The first QA attempt incorrectly checked the return button before login's request had settled; waiting for loading completion fixed the test, without a second production UI workaround.

## Onboarding semantics

Five explicit intents are direction, change, choices, start and possibility; optional self-expression and unsure are also available. Unsure is exclusive. Mainline selection retains all other concerns and all typed answers. Branch rules are local and type-safe:

| Intent | Next question |
|---|---|
| direction | What prompted reconsidering direction? |
| change | What do others ask for help with that feels natural? |
| choices | Which directions are being considered, and what makes choosing hard? |
| start | What must not be lost during change? |
| possibility | Start from experience, interest or a new activity? |
| other / unsure | A gentle optional opening, without inventing a goal |

exploration_intent, actual_question, focus_response, support_style and title are separate fields. title can remain empty in an issue and its card. Display fallbacks explicitly describe an unnamed exploration; they are not stored as a confirmed goal. A known legacy action label is normalized only in new input/local v2 draft migration; existing stored cards are not rewritten. Seven-day drafts keep background, constraints, stage and new fields. Old concerns and support identifiers remain accepted.

The preview explicitly identifies fixed-question organization, not AI analysis or a personality/ability assessment. Registration offers WeChat, explicitly labelled development login, unchecked terms and skip registration. After screenshot feedback, the anonymous-space top padding was reduced from status-bar + 90px to capsule-bottom + 18px. Its card now presents a concrete user clue and one continuation, rather than repeating uncertainty in heading and body.

A second screenshot review exposed a semantic error: empty title was incorrectly treated as no direction. Reflection now shows the user's actual question, branch answer, experience, constraints and life context first, then presents separate fixed-rule guidance. A question gets a question-based heading; other concrete inputs get a clue-based heading; a named exploration keeps its own title in the record. Only explicit unsure without concrete inputs gets the uncertainty wording. Guidance differs by Listen/Discover/Compare/Experiment and never asserts an ability or suitable career. Login and saved-card fallbacks also describe an unnamed exploration rather than inferring absent direction. Three additional frontend tests cover these distinctions.

## Modes, protocol and grounding

Listen acknowledges expression without forcing a plan or insight. Discover seeks grounded connections and asks when evidence is insufficient. Compare separates confirmed information, assumptions and unknowns while respecting constraints. Experiment specifies a reversible, affordable test. Modes remain changeable preferences, not permanent user classifications. Legacy clarify maps to discover; act maps to experiment at runtime.

The response remains compatible with old reply/suggestion output:

```json
{"reply":"A self-contained response","suggestion":null,"insight":null}
```

An optional insight contains title, observation, possibility, uncertainty, evidence and nullable experiment. evidence consists of two to four distinct verbatim user-provided fragments. An experiment contains action, tests, effort and stop_rule. The backend suppresses insight when quotations are missing, overlapping, unsupported, based only on assistant text/card hypotheses, or identical to a recently rejected angle. Listen suppresses insight. Ordinary reply is retained when grounding removes an insight.

This gate checks provenance of quoted fragments, not the correctness of the reasoning or semantic similarity of differently worded recommendations. The system prompt still needs real-model quality evaluation. It asks for uncertainty, respects rejection, prohibits fabricated career data and does not provide network research tools. Input contains the current confirmed card/issue, exploration answers, mode, up to five feedback records, eight recent messages and three in-session rejection records. The first turn can use onboarding answers without repeating the questionnaire.

## Insight actions and privacy

- Interest prepares an editable follow-up in the composer, retaining existing input; it does not send automatically. A full composer is never truncated or falsely marked prepared
- Rejection dismisses the card immediately, makes no request and carries at most three rejection records only during the active session
- Trying opens an experiment review sheet when a draft exists; otherwise it prepares an editable request for one. Opening a sheet does not save
- Confirmation updates only the existing card's next step, preserves confirmed facts/constraints, checks the card version and blocks duplicate submissions. The user can edit all four experiment fields or close without saving

No task engine, vector store, extra agent framework or new external service was introduced. Generated insights and reactions are not stored as personal facts. Full chat remains opt-in; reloading without that opt-in restores the confirmed card and preferences, not conversation/insight drafts. Consent withdrawal, cancellation, account deletion and user ownership checks remain intact. The additive exploration JSON migration is prepared but not applied to remote Supabase.

## Automated checks

- TypeScript: passed
- Frontend: 36 passed, including scope separation, error sanitization, branch semantics, legacy draft recovery, nullable outputs, insight actions, bounded rejection context, input preservation, reflection semantics and confirmation draft boundaries
- Backend: 50 passed, 1 skipped; MockTransport covers all modes, insufficient clues, evidence rejection, old protocol, separate consent and first-turn exploration context
- The skipped test requires an explicitly configured disposable local PostgreSQL database
- Nonzero historical ledger preservation is tested across both additive upgrades; no remote database is used
- Ruff and Developer Tools helper tests passed (2 helper tests)
- Final release build passed; bundled WeChat compilers accepted 6 WXSS and 7 WXML files, with image/reference checks passing
- The application's measured budget stayed at 920 micro-CNY before and after this update; the separate Mock ledger is not included in application usage
- The helper test's deliberate disabled-service-port output is a fixture, not a report about the currently enabled IDE

## Native acceptance

Primary environment: installed WeChat Developer Tools and the official miniprogram-automator SDK, using output/exploration/mp-weixin compiled with VITE_API_BASE_URL=http://127.0.0.1:8002/api. The project is labelled Agency OS Exploration Mock QA, with component hot reload kept disabled. Normal development still uses dist/dev/mp-weixin; release uses dist/build/mp-weixin.

iPhone 12/13 (390 × 844): offline onboarding and online Mock journeys passed. Actual textarea/button interactions covered selection, mainline preservation, draft reload, reflection, unchecked login, explicit AI consent, context reuse, optional Insight, interest, refusal, experiment review and confirmation with rapid repeated taps. Confirmed facts and constraints survived. No runtime exception event was recorded. A final repeat also checks timeout/cancel input recovery, tab state and reopening with no chat retention.

The initial device switch reported iPhone 6/7/8 Plus at 414px, which was correctly rejected as narrow acceptance rather than counted as a pass. After the user changed to iPhone 12/13 mini, the SDK measured 375 × 812 and the complete Mock journey passed with no runtime exception events. The latest reflection order/semantics adjustment also passed a separate complete 375px repeat at 16:48 on 2026-10-17: actual records precede guidance, scrolling reaches the final guidance, and the onboarding footer stays inside the viewport. Insight, explicit experiment confirmation, rapid taps, timeout, cancellation, tab state and default no-chat-retention reopening passed. Its report includes a source hash. The 390px complete flow was checked before this final reflection layout adjustment; the final adjustment was visually inspected at 375px. No H5 screenshot is used as native evidence.

Evidence files are ignored under output/exploration: offline-390-report.json, online-390-report.json, online-375-report.json, ledger-check.json and screenshots named by phase/width/screen. Reports distinguish Mock calls from paid requests. Previous storage/session values are restored after each run; test tokens are never printed or checked in. During SDK cold starts a page stack can briefly be empty; the driver waits and can launch the known QA root once. A separate early login check was changed to wait for the resulting home state instead of assuming 260ms is sufficient.

To reproduce from the repository root, build the isolated output and preserve any existing terminal environment values:

```powershell
$taskQaPath = Join-Path $PWD 'output/exploration/mp-weixin'
$taskPreviousOutput = $env:UNI_OUTPUT_DIR
$taskPreviousApi = $env:VITE_API_BASE_URL
try {
  $env:UNI_OUTPUT_DIR = $taskQaPath
  $env:VITE_API_BASE_URL = 'http://127.0.0.1:8002/api'
  npm --prefix apps/miniprogram run build:mp-weixin
} finally {
  $env:UNI_OUTPUT_DIR = $taskPreviousOutput
  $env:VITE_API_BASE_URL = $taskPreviousApi
}
& 'C:\Software\Tencent\微信web开发者工具\cli.bat' auto --project $taskQaPath --auto-port 9430
node tools/verify-exploration-native.cjs --offline
```

Use only the QA project's already-authorized local request-domain setting. The helper does not enable Developer Tools' service port. Run offline QA with only the isolated port-8002 server stopped. Then start the server in another terminal:

```powershell
uv run --directory apps/api python ../../tools/mock-exploration-api.py
node tools/verify-exploration-native.cjs
# After manually selecting a real 375px simulator device:
node tools/verify-exploration-native.cjs --narrow
```

The driver uses the already installed optional SDK at output/native-sdk/node_modules/miniprogram-automator. It never installs dependencies or opens the paid backend. Do not stop the normal API on port 8000 for offline QA. Device changes require reconnecting the SDK.

If the SDK is unavailable, manually walk the same isolated project: select several intents, choose a mainline and type a response; return and reload to verify recovery; complete context/mode/reflection while offline; verify login failure then skip registration. With the Mock API running, choose development login, explicitly grant AI consent, send a message and inspect Insight. Interest must only fill the composer, rejection must not save, and trying must open an editable experiment. Confirm once and rapidly tap again; the card must update once while preserving facts. Check both dimensions, scroll to the bottom of reflection/experiment screens, cancel a pending reply, switch tabs and reopen with chat retention off. Use synthetic examples instead of personal information.

## Remaining limits

### Chat spacing follow-up — 2026-10-17

Native geometry confirmed duplicated dock clearance: chat-content reserved 239px while the outer with-tabs shell added another 124px on the 375 × 812 simulator. This left 187.31px between the disclosure and composer at maximum scroll. The chat shell now removes its second allowance, and a shared composer-bottom variable plus the measured composer height reserves one clearance with a 16px content gap. The same variable covers Quiet Night and keyboard positioning. Native checks measured 15.98px for the light empty state, 15.71px with a four-line composer (129.33px high), and 16.08px after a Mock reply and Insight in Quiet Night. The isolated Mock provider handled one test request; no paid provider was called. TypeScript, 36 frontend tests, and the formal Mini Program build/native WXML/WXSS compiler checks passed. Run tools/verify-chat-spacing-native.cjs with the chat tab open in the isolated QA project at port 9430 to repeat the bottom-scroll geometry check. Physical keyboard behavior was not revalidated in this follow-up.

There were zero real DeepSeek generations for this update. Mock fixtures verify contracts and application behavior, not the quality of actual model-generated insights. A future paid quality check needs separate user confirmation of request count and cost boundary. Physical-device keyboard occlusion, larger text settings, real WeChat identity/permission sheets and remote PostgreSQL migration remain manual acceptance items. Windows window capture timed out and exposed no accessible device-menu control; any device change is performed by the user, then measured by the native SDK.

## Changed files

- apps/api/app/ai.py — modes, exploration context, optional insight and provenance gate
- apps/api/app/schemas.py — nullable insight, experiment, session rejection feedback, compatible modes and empty titles
- apps/api/app/main.py — exploration persistence/context and sanitized generation diagnostics
- apps/api/app/models.py; apps/api/app/local_schema.py — additive exploration JSON field and local upgrade
- supabase/migrations/20261017020000_exploration_context.sql — additive PostgreSQL migration, not remotely applied
- apps/api/tests/test_onboarding.py; apps/api/tests/test_insight.py — compatible persistence, ledger preservation, mode and grounding tests
- apps/miniprogram/src/http.ts; apps/miniprogram/src/operations.ts — categorized errors and scoped operation state
- apps/miniprogram/src/onboarding.ts; apps/miniprogram/src/domain.ts — branch rules, draft compatibility and response types
- apps/miniprogram/src/components/OnboardingFlow.vue; apps/miniprogram/src/components/SelectionCard.vue — local flow, branch UI, reflection, login and selection feedback
- apps/miniprogram/src/chat.ts; apps/miniprogram/src/pages/index/index.vue — insight actions, editable experiment confirmation, mode switching and message state
- apps/miniprogram/src/alpha.scss; apps/miniprogram/src/tokens.scss — quiet Insight presentation, sage accents, compact anonymous space and bottom/keyboard spacing
- apps/miniprogram/tests/http.test.ts; operations.test.ts; onboarding.test.ts; chat.test.ts; domain.test.ts — frontend regressions and behavior checks, retaining the existing suite
- tools/mock-exploration-api.py; tools/verify-exploration-native.cjs — isolated no-spend native acceptance helpers
- README.md; README_zh.md; docs/PRODUCT.md; docs/DESIGN.md; docs/EXPLORATION_VALIDATION.md — behavior, setup, design and evidence
