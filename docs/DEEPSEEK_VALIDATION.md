# DeepSeek integration validation


## Current selection ownership — code audit 2026-10-25

| Surface / event | Selection owner |
| --- | --- |
| A normal chat reply with eligible exploration context | Backend prepares 3–5 reviewed candidates; DeepSeek returns one stable visual_id or null in the existing chat generation |
| Invalid, repeated or out-of-pool model suggestion | Backend chooses the first remaining legal candidate, or no image; no repair request |
| Discover page artwork and Plan artwork | Deterministic client visual-library resolver; not model-selected |
| Discover “换一换” | Local recommendation batching in use-discovery.ts; it does not ask DeepSeek to rotate images |
| Theme changes / restored chat messages | Client resolves stored IDs and compatible variants locally; no new model call |

Chat candidates require exploration context and a message of at least four characters. Candidate filtering uses deployment, role/page, theme, actual derivative availability, source families and visible IDs. The client sends up to 40 distinct visual IDs from the current retained/in-memory message history. This is bounded conversation deduplication, not a global guarantee that an image is never reused.

The existing system prompt tells DeepSeek to choose a suitable candidate when the user explicitly asks for a picture/change; ordinary replies may select art only when helpful. Null or omission means no image. Summaries, explicit crisis language, fixed evaluation runs and disabled visual selection receive no candidate slot. A pool with fewer than three legal candidates stays text-only. A failed candidate lookup degrades to text.

The server validates the ID before returning/persisting it. Each assistant message keeps its own visual_id; a subsequent reply does not replace all earlier images. The client maps the ID to an approved Supabase URL, hides incompatible or failed chat art, and does not generate a new bitmap. There is no periodic DeepSeek image-rotation timer, background image request or extra selection-model call.

Configuration: AGENCY_VISUAL_SELECTION_ENABLED defaults true in Settings; actual environment overrides and the deployed process must be checked separately. This audit examines repository code, not proof that a particular running server loaded the latest code. No paid provider request was made for this audit.

### Current limits

The backend filters candidates by saved user.theme. The frontend's automatic time theme can differ from that saved value; a returned image may therefore be hidden by client compatibility checks. Automatic palette changes do not independently resubmit chat or synchronize the saved theme. Do not describe this as fully synchronized time-theme-aware DS rotation.

The current uncommitted Discover implementation also contains three local cardSrc fallback paths. Those fallbacks are local frontend behavior, not DS choices; packaging/cloud compatibility needs separate UI acceptance. This documentation audit does not modify that concurrent work.

Sources: apps/api/app/main.py, ai.py and visual_selection.py; apps/miniprogram/src/chat.ts, visual-library.ts, pages/index/chat/ChatVisual.vue, pages/index/views/DiscoverView.vue, PlanView.vue and use-discovery.ts.

## Historical acceptance — 2026-10-17

The following provider settings, prices and paid-call count describe that dated run, not the current environment or cumulative project usage. The later visual-selection check is recorded in [cloud acceptance](visual-library/CLOUD-ACCEPTANCE-2026-10-23.md).


## Provider and accounting

The ignored local apps/api/.env enables deepseek-flash at https://api.deepseek.com. The running API reports ai_mode=deepseek. Source defaults remain demo for unconfigured installations. Local development login does not determine the AI mode. No key is present in tracked code or frontend configuration.

Official references checked before spending:

- [CNY model prices](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)
- [Thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/)
- [Chat completions and usage](https://api-docs.deepseek.com/api/create-chat-completion)
- [Account balance and currency](https://api-docs.deepseek.com/api/get-user-balance/)

The rate card version is deepseek-flash-cny-2026-10-17. Per million tokens, peak rates are CNY 2 cache-miss input, 0.04 cached input and 8 output; off-peak rates are 1, 0.02 and 4. Peak bands are Beijing weekday 09:00–12:00 and 14:00–18:00, excluding Chinese public holidays. Verified holiday dates can be configured explicitly; unknown weekday holidays use a conservative peak ceiling. No USD/CNY conversion is assumed. Preflight confirmed the key, configured model and an available CNY account through GET requests.

Reservations use peak/cache-miss estimates before calling the provider. Successful requests settle from reported input/cache/output tokens and provider creation time, rounded upward to integer micro-CNY for the ledger. The receipt is an estimate, not a provider invoice. Failed, cancelled or unparseable requests retain the existing reservation because provider billing may be uncertain. Existing budget rows are never reinitialized. A regression test migrates an existing SQLite ledger with CNY 1.234567 already used and verifies only the next request's cost is added.

## Exactly one paid generation

The operator helper performed one POST through the full FastAPI chat route using a disposable local user, explicit AI consent, an empty conversation and max_output_tokens=384. HTTP retries were disabled. All other conversational tests use MockTransport. A durable ignored output/deepseek/live-attempt.json guard prevents accidental paid reruns.

| Field | Result |
|---|---|
| Input | 我想你了 |
| HTTP status / mode | 200 / deepseek |
| Provider response ID | 8d645d0d-536d-4125-bb6b-d0ef040b8921 |
| Requested / returned model | deepseek-flash / deepseek-flash |
| Thinking / streaming | disabled / false |
| Input / output / total tokens | 680 / 60 / 740 |
| Cache hit / miss tokens | 0 / 680 |
| Price band | Saturday off-peak |
| Estimated cost | CNY 0.000920 |
| Ledger before / after | 0 / 920 micro-CNY |
| Suggestion | null |

The real reply responded to the emotional input without a career proposal. Its explanation of AI relationship boundaries was too defensive. The system prompt was subsequently refined to acknowledge the feeling naturally, avoid unsolicited boundary lectures and avoid inferring loneliness. That tone refinement has **not** been verified with another paid generation, respecting the one-request limit. Mock fixtures prove the contract and application flow, not the final model's semantic quality across all five cases.

Only this synthetic smoke user opted into saved chat to allow display-only native verification. The default for real users remains no permanent full chat storage. Usage receipts store token/cost/provider metadata, not prompts, replies or keys. Remote Supabase migration 20261017010000_ai_usage_receipts.sql is additive and has not been applied remotely.

## Conversation and privacy contract

The system prompt separates greeting/emotion, exploration, comparison and action feedback. It prioritizes the latest intent over existing career context. Exploration asks at most one useful question; feedback uses the current issue and attempt. No career research tools are supplied. Unknown market claims remain unknowns. A structured proposal contains only options, hypotheses, unknowns and next_step; confirmed facts and constraints are rejected as proposal fields. Existing cards remain compatible.

Context includes the current confirmed card and issue, support preferences, selected background, up to five recent feedback items and eight recent messages. Chat is stored only after explicit opt-in. The frontend keeps the active conversation in memory across tab changes, blocks duplicate sends, preserves input on errors/cancellation, and clears obsolete state when switching issues/accounts. Suggestions are nullable and can only reach a saved card through the existing review-and-confirm route.

## Native Mini Program evidence

Primary environment: installed WeChat Developer Tools, official miniprogram-automator SDK, iPhone 12/13 (Pro), 390 × 844, base library 3.17.4. No H5 test is used as native evidence.

An isolated native build targeted a local MockTransport-only API on port 8001 and a disposable database. Five actual textarea/send-button flows passed: 你好, 我想你了, 我不知道自己未来做什么, 程序员和 AI 产品经理，我应该怎么选择？, 我尝试过了，但失败了. Only comparison displayed a proposal. Opening its review sheet did not save automatically; clicking confirmation updated the card while preserving confirmed facts and constraints. Loading, timeout, cancellation and tab changes retained the appropriate input/context. No runtime exception event was recorded.

A separate native build targeted the running real API on port 8000 and loaded the two saved messages from the one successful paid request. The displayed reply exactly matched the provider receipt; no proposal or demo label appeared. The ledger remained CNY 0.000920 before and after this read-only check. No second generation was sent. Tests restored the previous session rather than clearing user data.

Ignored local evidence: output/deepseek/live-check.json, native-mock-report.json, native-real-report.json and their native screenshots. The SDK occasionally times out immediately after an IDE project switch; reconnecting after initialization resolves stale handles without model calls.

## Avatars

Original editable SVG artwork defines a gentle ivory-and-sage sprout character and a neutral user fallback. Bundled PNGs are used in native image elements to avoid SVG layout inconsistencies. Both messages and pending messages have explicit 34px avatar bounds. The user can explicitly invoke WeChat's chooseAvatar button from My; selection is optional and independent of AI consent. Files are saved on-device per account, replaced files are removed, and restoring the default/account deletion clears the local selection. Avatar data never enters chat/model requests. File save failures keep the existing avatar. Unit tests cover account isolation, replacement, removal and failures. The final native build rendered both avatars at 34 × 34 and exposed the chooseAvatar button in My; screenshots were inspected. The system selection sheet was not automated.

## Checks and remaining limits

- Backend: 36 passed, 1 skipped (optional PostgreSQL integration requires a disposable local database)
- Frontend: 17 passed, including nullable proposals, duplicate prevention, failed/cancelled input recovery, recent context, stale request isolation and local avatar storage
- TypeScript and Ruff checks passed
- WeChat release build passed; bundled native compilers accepted 6 WXSS and 7 WXML files, with image/reference checks passing
- Developer Tools helper tests: 2 passed; the disabled-port error printed in this test is an intentional fixture, not the current service-port state
- Physical-device keyboard behavior, real WeChat identity login and the actual avatar-selection permission sheet still need manual acceptance
- Remote Supabase migration has not run; no remote database credentials or schema were changed
- Only the emotional-input example received a real model response; the other four semantic cases still need evaluation during intentional user trials

Start the API with npm run dev:api and the watched Mini Program with npm run dev:mp in separate terminals, then npm run wechat:open. Environment changes require an API restart. localhost works in the simulator with that project's local domain-check setting; a real phone needs a reachable backend address, and production needs HTTPS and a registered request domain.
