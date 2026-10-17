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

The default API is http://127.0.0.1:8000; its interactive docs are at /docs. Local demo authentication uses SQLite and fixed example replies, without model calls. Real WeChat authentication requires the backend AppID/AppSecret configuration described in [setup](docs/SETUP.md).

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

## Checks

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

Supabase PostgreSQL migrations and DeepSeek/WeChat adapters are prepared. Remote Supabase, real model calls and real WeChat login require their own integration checks.

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
