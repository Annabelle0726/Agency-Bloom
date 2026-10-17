# Agency OS

[简体中文](README_zh.md)

Agency OS — Your Life. Your Direction. Your Agency.

A mobile-first WeChat Mini Program for understanding your circumstances, clarifying a current concern, comparing possibilities, and choosing a small real-world step. The Alpha follows one current issue and keeps the decision card under the user's control.

Built with Vue 3, TypeScript and uni-app, with a Python/FastAPI API. **WeChat Developer Tools is the primary UI acceptance environment.** The H5 output is an auxiliary local test harness.

## Install

Requirements: Node.js 22+, npm, uv, and WeChat Developer Tools. Run in PowerShell from the repository root:

```powershell
cd C:\Projects\AgencyOS
npm ci
npm --prefix apps/miniprogram ci
uv sync --directory apps/api --frozen
# Only create this file if it does not exist; preserve existing credentials
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
```

Run the local API in a separate terminal:

```powershell
npm run dev:api
```

The default API is http://127.0.0.1:8000; its interactive docs are at /docs. Local development authentication and the AI provider are independent: SQLite/dev login can use real DeepSeek. A fresh checkout defaults to demo AI until explicitly configured. Real WeChat authentication requires the backend AppID/AppSecret configuration described in [setup](docs/SETUP.md).

Keep two terminals open: run `npm run dev:api` in the first, and `npm run dev:wechat` in the second. `dev:mp`, `dev:wechat` and `build:mp` compile the frontend only; they do not start the API. `dev:wechat` now reports whether the local API is reachable before watching. Login rechecks a failed startup connection on entry, and returning to the Mini Program retries an offline check. A failed connection remains retryable without losing the local draft. Missing WeChat credentials are shown as pending setup, separately from a network failure; explicit development login remains available when enabled. The agreement is unchecked by default and appears before the login buttons.

## Real DeepSeek chat

Set these values in the ignored backend file apps/api/.env, preserving the existing database URL and budget. Put the key only in that file, never in frontend VITE_ variables:

```ini
AGENCY_AI_MODE=deepseek
AGENCY_DEEPSEEK_MODEL=deepseek-flash
AGENCY_DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENCY_DEEPSEEK_API_KEY=YOUR_KEY
AGENCY_MAX_OUTPUT_TOKENS=768
```

Restart dev:api after changing environment settings. GET http://127.0.0.1:8000/api/config must report ai_mode=deepseek. The backend explicitly disables thinking and streaming, uses JSON output, and never falls back to demo replies after provider errors. Output tokens are a ceiling, not a target: casual conversation stays brief; career comparisons can be longer.

The current local installation was switched to real DeepSeek and one paid request succeeded on 2026-10-17. It used 680 input and 60 output tokens, with an estimated CNY 0.000920 cost. See [the detailed evidence and limitations](docs/DEEPSEEK_VALIDATION.md). A GET-only credential/model/CNY balance check is available:

```powershell
uv run --directory apps/api python ../../tools/verify-deepseek.py
```

The operator's --live-once option writes a durable attempt guard before one paid generation. That attempt has already been used in this workspace; do not remove its guard or rerun a paid check. Automated tests use MockTransport, not provider credits.

Natural conversation can return suggestion=null. A useful career proposal appears as a draft and reaches the decision card only after user review and confirmation. Context includes the current card/issue, support preference, up to five recent feedback records and eight recent messages; full chat storage remains opt-in. Budget reservations use peak/cache-miss prices and settle successful calls using token receipts; uncertain failures retain their reservation. Historical usage is preserved.

Chat displays an original gentle sprout avatar for Agency OS and a default user avatar. In My, the user can explicitly select a WeChat avatar or restore the default. The chosen file stays on this device, scoped to the account, and is never included in model requests. SVG sources are retained beside bundled PNGs for reliable native rendering. The real WeChat selection sheet and physical-device keyboard still need manual acceptance.

## Daily Mini Program development

```powershell
npm run dev:mp
```

This keeps the uni-app compiler running and writes changes to:

```text
C:\Projects\AgencyOS\apps\miniprogram\dist\dev\mp-weixin
```

Import that directory into WeChat Developer Tools once. It contains its own generated project.config.json. Alternatively, import C:\Projects\AgencyOS: the repository-level project.config.json points its miniprogramRoot at the same development output. Check the actual Mini Program root in Project Details.

Edit files under apps/miniprogram/src, save, and let the running compiler update WXML, WXSS, JS and assets. Developer Tools normally recompiles changed output automatically; if it does not refresh, click Compile once. Do not edit generated files or copy source files into the output directory.

Global SCSS files are direct Vue style sources in App.vue. Keep this structure: the previous nested Sass @use setup could emit stale WXSS during incremental builds. With dev:mp running, npm run check:mp:watch temporarily adds an unused style probe, verifies its appearance in app.wxss, then restores the source and verifies removal. Component hot reload (compileHotReLoad) is disabled; normal watched compilation and simulator reload remain enabled. This avoids stale native component templates after structural changes.

For automatic opening after the first successful watched compile:

```powershell
npm run dev:wechat
```

This convenience command keeps the compiler running and opens the development output using the installed CLI. It defaults to C:\Software\Tencent\微信web开发者工具\cli.bat. Override a different installation without editing the script:

```powershell
$env:WECHAT_DEVTOOLS_CLI = 'D:\Apps\WeChatDevTools\cli.bat'
npm run dev:wechat
```

CLI operations require the Developer Tools service port. Enable it yourself in Settings > Security Settings > Service Port only when you choose to use CLI integration. The helper never enables it. If it is disabled, development compilation continues and you can import the output directory manually.

To open an already compiled development output:

```powershell
npm run wechat:open
```

## Release build

```powershell
npm run build:mp
npm run wechat:open:build
```

The release output is C:\Projects\AgencyOS\apps\miniprogram\dist\build\mp-weixin. You can also import that directory manually. A release build runs once; it does not watch source changes. Keep it as a separate Developer Tools project so it cannot be confused with daily development.

When the installed WeChat WXML/WXSS compilers are available, build:mp also runs them against the generated output. This catches native stylesheet syntax failures that a successful uni-app build can miss. On machines without Developer Tools this part is explicitly skipped; use npm run check:mp for a required native compiler check, or npm run check:mp:dev for watched output. Set WECHAT_DEVTOOLS_HOME if the tool installation directory differs. Compiler acceptance does not replace simulator testing.

| Location | Purpose |
|---|---|
| C:\Projects\AgencyOS | Source repository and optional development project wrapper |
| apps/miniprogram/dist/dev/mp-weixin | Watched development output |
| apps/miniprogram/dist/build/mp-weixin | One-time release output |
| C:\Software\Tencent\微信web开发者工具 | Installed tools and CLI, never an application output directory |

Importing a compiled directory uses the private settings in that directory, not the repository's project.private.config.json. For localhost API testing, check the local request-domain setting in that specific project. Private settings are ignored by Git. Real devices cannot reach the PC backend through their own 127.0.0.1; configure an accessible API address, and use HTTPS plus registered request domains for release.

## Auxiliary H5 preview

```powershell
npm run dev
```

Open http://127.0.0.1:5173. This is useful for fast logic checks, but a successful H5 or Playwright run does not prove that WXSS, component boundaries, the WeChat capsule, keyboard, or safe areas work in a Mini Program.

## Native acceptance and troubleshooting

Use Developer Tools Console and WXML/Styles inspection before changing CSS:

1. Confirm the loaded project and miniprogramRoot match the dev/build directory you compiled. The installation directory and src directory are not valid compiled roots.
2. Check Console for JavaScript, WXSS compilation, component, asset and request failures. A successful uni-app build is not a successful simulator run.
3. Inspect the component JSON/JS options and its own WXSS. Global app.wxss and browser CSS do not establish how styles cross a native component boundary. Do not disable isolation for every component as a workaround.
4. Inspect the welcome image's actual src, bounds, and loading state. Its packaged path is /static/mountain-lake.jpg; check the image, its parent height, positioning and styles separately.
5. Check computed dimensions and CSS variable values inside the component. Unsupported selectors, inherited variables and extra custom-component host nodes can produce different layouts from H5.
6. Check iPhone 12/13 dimensions and a narrow device. Walk through welcome, all five onboarding steps, reflection, login, home, and theme switching. Check capsule/status-bar clearance, bottom buttons, keyboard and fast repeated taps.
7. If source changes are absent, check that the watcher is still running and that the tool is reading dist/dev. Recompile once before investigating caches. Do not repeatedly clear all application data.

See [native acceptance evidence](docs/WECHAT_VALIDATION.md). That record distinguishes simulator results, static artifact checks, auxiliary H5 checks, and unverified physical-device behavior.

The 2026-10-17 repair was verified in the actual WeChat simulator on iPhone 12/13 (390 × 844) and iPhone 6/7/8 (375 × 667), including onboarding, local demo login, home and themes. Physical-device keyboard occlusion and real WeChat authentication still require manual acceptance. After a device switch or recompilation, reconnect automation to avoid stale component handles.

The Quiet Night home uses native raster artwork with editable SVG sources, an absolutely positioned jade accessory, 6–8px interface corners, subtle entry/halo motion and a floating tabbar. Its presentation is isolated in night-home.scss and NightCompass.vue. See the separate redesign section in the acceptance record for viewport-specific evidence; old simulator screenshots do not validate a newer design.

## Checks

The exploration update separates initialization, authentication, signed-in data and AI errors. Anonymous onboarding is local and remains usable without an API connection. It uses deterministic, typed branches for direction, transferable experience, comparison, cautious change and new possibilities; the user selects one mainline while other interests remain editable background. An issue title may stay empty. Local drafts retain the user's question, selected intent, branch answer and optional title separately; seven-day v2 drafts migrate compatibly to v3.

Current interaction preferences are Listen, Discover, Compare and Experiment. Legacy clarify maps to discover and act maps to experiment without rewriting old accounts. Preferences can be changed in chat or My. Optional insight output requires verbatim evidence from at least two distinct user-provided clues. The backend removes an ungrounded insight while retaining the ordinary reply. The gate verifies quotation provenance, not occupational suitability or the reasoning itself.

Insight actions are explicit: interest prepares an editable follow-up, rejection dismisses the angle and carries bounded feedback only in the current session, and trying an experiment opens a review sheet. The experiment specifies action, what it tests, effort and a stop condition; only explicit confirmation updates the existing card's next step. These actions never automatically call a second model. Insight drafts and reactions are not restored as long-term facts.

This update made **no new paid model requests**. See [exploration acceptance](docs/EXPLORATION_VALIDATION.md) for Mock results, native simulator evidence and remaining manual checks. The additive exploration migration has not been applied to remote Supabase. Do not reset an existing database or budget ledger.

```powershell
npm run typecheck
npm run test:ui
npm run test:tools
npm run build:mp
npm run check:mp:dev
npm run test:api
npm run lint:api
```

The optional PostgreSQL integration test needs a disposable local database; it does not use the remote Supabase project. See [validation](docs/VALIDATION.md).

## Alpha behavior

- Anonymous concern selection, a chosen focus, optional life context, support preferences and a clearly labelled fixed-rule reflection
- Local draft recovery for seven days; login before saving to the backend
- One current decision card separating confirmed information, assumptions, missing information and a user-chosen next step
- Separate AI consent; suggestions require confirmation before updating the card
- Optional full chat retention, cancellation, feedback, history, account deletion and usage limits
- Morning Mist by default; Quiet Night is available after login through My > Appearance

Real DeepSeek generation and native chat display have been checked. Supabase PostgreSQL migrations are prepared, including the additive AI usage receipt column; remote migration and real WeChat login still require separate integration checks.

## Project layout

```text
apps/miniprogram/       Vue 3 + TypeScript + uni-app
  src/components/      Onboarding, buttons, cards, progress and icons
  src/pages/index/     Current issue, chat, settings and authentication
  src/onboarding.ts    Draft recovery and fixed reflection rules
  src/static/          Bundled images and icons
apps/api/              FastAPI, persistence, authentication and model adapter
supabase/migrations/   PostgreSQL schema, RLS and permissions
tools/                 Local workflow and acceptance helpers
docs/                  Product, design, setup and validation records
```

Environment files, databases, dependencies, build output, private Developer Tools settings and screenshots are ignored by Git. Keep model keys, WeChat AppSecret, Supabase secrets and database passwords on the backend. Existing root Lib/ and Scripts/ virtual-environment files are preserved and ignored.

More: [product](docs/PRODUCT.md), [design](docs/DESIGN.md), [setup](docs/SETUP.md).
