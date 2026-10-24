# Agency Bloom

<p align="center">
  <img src="./assets/readme/hero.png" width="100%" 
alt="Agency Bloom — a WeChat Mini Program for exploring career choices, comparing possibilities, and choosing one small real-world step. The decision card stays under your control.">
</p>

<p align="center">
  <a href="README_zh.md">简体中文</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <em>Your Life. Your Direction. Your Agency.</em>
</p>

<p align="center">
  <a href="https://github.com/Annabelle0726/Agency-Bloom/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/Annabelle0726/Agency-Bloom/check.yml?style=flat-square&label=checks" alt="GitHub Actions checks status"></a>
  <img src="https://img.shields.io/badge/status-alpha-526C49?style=flat-square" alt="Project status: alpha">
  <img src="https://img.shields.io/badge/license-Source--Available-29374B?style=flat-square" alt="License: Source-Available">
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/%E6%9D%A1%E6%AC%BE-%E8%8B%B1%E6%96%87%E4%B8%BA%E5%87%86-4D6BC4?style=flat-square&label=%E4%B8%AD%E6%96%87%E8%AF%91%E6%9C%AC" alt="Chinese translation available"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue_3-3.4.21-4E5A52?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue 3.4.21">
  <img src="https://img.shields.io/badge/TypeScript-~5.6.3-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript ~5.6.3">
  <img src="https://img.shields.io/badge/uni--app-3.0.0-2B3D45?style=flat-square" alt="uni-app 3.0.0">
  <img src="https://img.shields.io/badge/Vite-5.2.8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 5.2.8">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.143.2-009485?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI 0.143.2">
  <img src="https://img.shields.io/badge/Python-%E2%89%A53.12-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.12+">
  <img src="https://img.shields.io/badge/SQLAlchemy-2.1.4-D71F00?style=flat-square" alt="SQLAlchemy 2.1.4">
  <img src="https://img.shields.io/badge/DeepSeek-flash-4D6BC4?style=flat-square" alt="DeepSeek flash model">
  <img src="https://img.shields.io/badge/platform-WeChat_Mini_Program-07C160?style=flat-square&logo=wechat&logoColor=white" alt="Platform: WeChat Mini Program">
</p>

**Agency Bloom** is a mobile-first WeChat Mini Program for adults who want to understand their circumstances, clarify a current concern, compare possibilities, and choose one small, affordable real-world step. The Alpha follows one current issue at a time, and every AI suggestion stays a draft until you confirm it.

## Why it is different

- **You hold the pen.** The model proposes; only explicit confirmation turns a suggestion into card content. Assumptions, unknowns, and confirmed facts stay visually separated.
- **Grounded or dropped.** Optional insights must quote at least two verbatim clues from your own words. The backend discards anything it cannot ground.
- **Consent by default, memory by choice.** Chat retention is opt-in. Long-term memories are user-confirmed, scoped (global or per exploration), and their use is a separate switch, off by default.
- **Bounded context.** Each conversation sends only its own recent messages, its reviewed summary, and explicitly linked context — never a silent merge of other transcripts.
- **Budget discipline.** Every model call reserves against a CNY ledger before it happens and settles from the token receipt. No retries, no silent fallback to demo replies.

## How it works

<p align="center">
  <img src="./assets/readme/workflow.png" width="100%" alt="Three-stage flow: the Vue 3 Mini Program talks to a FastAPI backend; the backend stores confirmed cards and memories in SQLite or PostgreSQL; the DeepSeek model only returns drafts the user must confirm.">
</p>

## Quick start

Requirements: Node.js 22+, npm, uv, and WeChat Developer Tools. From the repository root in PowerShell:

```powershell
npm ci
npm --prefix apps/miniprogram ci
uv sync --directory apps/api --frozen
# Only create this file if it does not exist; preserve existing credentials
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
```

Keep two terminals open:

```powershell
# Terminal 1 — backend API on http://127.0.0.1:8000
npm run dev:api

# Terminal 2 — watched Mini Program build + open Developer Tools
npm run dev:wechat
```

`dev:mp` compiles without opening the tools; `npm run dev` gives an auxiliary H5 preview at `http://127.0.0.1:5173`. **WeChat Developer Tools is the primary UI acceptance environment** — H5 passing proves nothing about WXSS, the capsule, keyboard, or safe areas.

The fresh-checkout default AI mode is `demo` (no paid calls). To enable real DeepSeek chat, set the following in the ignored backend file `apps/api/.env`, then restart `dev:api`:

```ini
AGENCY_AI_MODE=deepseek
AGENCY_DEEPSEEK_MODEL=deepseek-flash
AGENCY_AI_ROUTING=adaptive
AGENCY_DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENCY_DEEPSEEK_API_KEY=YOUR_KEY
AGENCY_MAX_OUTPUT_TOKENS=4096
```

Keys live only in that file — never in frontend `VITE_` variables. Chat defaults to local adaptive routing: Flash without thinking for ordinary requests, Pro with thinking for explicit analysis and comparisons. It streams visible reply text, validates the completed reply, and never automatically retries after provider errors. Routing introduces no classifier model call and preserves the CNY 100 monthly AI cap. See [adaptive chat](docs/ADAPTIVE_CHAT.md) for the policy, fixed-mode override and acceptance limits. The older [DeepSeek validation](docs/DEEPSEEK_VALIDATION.md) records a historical one-call check, not a current latency benchmark.

## Themes

<p align="center">
  <img src="./assets/readme/themes.png" width="100%" alt="Six theme swatches: Morning Mist, Quiet Night with a faint-star black sky, Evening Smoke, Forest, Lavender, and Minimal.">
</p>

Morning Mist is the default outside the authenticated space. After login, automatic switching is on by default across four local boundaries: Morning Mist (05:00–09:59), Forest (10:00–15:59), Evening Smoke (16:00–18:59), and Quiet Night (19:00–04:59). A manual pick under **My → Appearance** — Quiet Night (deep black with faint stars), Evening Smoke, Forest, Lavender, or Minimal — overrides only the current slot; the next boundary restores the time theme. The **随时间自动切换** switch in Settings, on by default, can be turned off to keep manual choices long-term. Automatic changes wait while the keyboard is open.

## Alpha features

- Anonymous onboarding with five intent branches; local drafts kept 7 days, login before anything uploads
- One current decision card separating confirmed facts, hypotheses, unknowns, and a user-chosen next step
- Separate AI consent; optional insight output with verbatim-evidence gating
- Conversation workspaces per exploration — archive, restore, versioned deletion; drafts and pending replies isolated by conversation
- User-confirmed long-term memories with scope, enable/disable, merge, and delete; a per-reply disclosure shows exactly what context the model received
- Optional full chat retention, cancellation of in-flight replies, feedback history, account deletion, and usage limits

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

The optional PostgreSQL integration test needs a disposable local database; it never touches the remote Supabase project. See [validation](docs/VALIDATION.md).

## Project layout

```text
apps/miniprogram/       Vue 3 + TypeScript + uni-app
  src/components/      Onboarding, cards, drawer, avatars, icons
  src/pages/index/     Current issue, chat, settings, authentication
  src/onboarding.ts    Draft recovery and fixed reflection rules
  src/static/          Bundled theme art and icons
apps/api/              FastAPI, persistence, auth, DeepSeek adapter, cost ledger
supabase/migrations/   PostgreSQL schema, RLS, permissions (additive only)
tools/                 Local workflow and acceptance helpers
docs/                  Product, design, setup, validation records
```

Environment files, databases, build output, and private Developer Tools settings are ignored by Git. Model keys, WeChat AppSecret, Supabase secrets, and database passwords stay on the backend.

## Notes and limits

- Real WeChat login requires backend AppID/AppSecret setup ([setup](docs/SETUP.md)); physical-device keyboard occlusion and the real avatar sheet still need manual acceptance.
- Remote Supabase migrations are applied; do not reset existing databases or budget ledgers.
- Real devices cannot reach a PC backend through their own `127.0.0.1`; release builds need HTTPS plus registered request domains.

## License

This project is **source-available, not open source** — see [LICENSE.md](LICENSE.md).

- ✅ **Allowed:** personal learning, local running, and non-commercial modification for your own use.
- ❌ **Not allowed:** commercial use, redistribution, or public deployment without written permission ([contact](LICENSE.md#9-contact-and-permission-requests)).
- Bundled brand assets and the Morning Mist reference image are not re-granted for reuse; see Sections 4 and 6 of the license for third-party components and unresolved material.

A Chinese reference translation is available at [LICENSE_zh.md](LICENSE_zh.md); the English version prevails.

More: [product](docs/PRODUCT.md) · [design](docs/DESIGN.md) · [setup](docs/SETUP.md) · [native acceptance evidence](docs/WECHAT_VALIDATION.md)
