# Agency Bloom

<p align="center">
  <img src="./assets/readme/hero.png" width="100%" 
alt="Agency Bloom — a WeChat Mini Program for exploring career choices, comparing possibilities, and choosing one small real-world step. The decision card stays under your control.">
</p>

<p align="center">
  <a href="README_zh.md">简体中文</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <em>Your Life. Your Direction. Your Agency.</em>
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
AGENCY_DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENCY_DEEPSEEK_API_KEY=YOUR_KEY
AGENCY_MAX_OUTPUT_TOKENS=768
```

Keys live only in that file — never in frontend `VITE_` variables. The backend disables thinking and streaming, requires JSON output, and never falls back after provider errors. One paid request was verified on 2026-10-17 (680 input / 60 output tokens, ≈ CNY 0.000920); see [DeepSeek validation](docs/DEEPSEEK_VALIDATION.md) for evidence and the `--live-once` guard.

## Themes

<p align="center">
  <img src="./assets/readme/themes.png" width="100%" alt="Six theme swatches: Morning Mist (default), Quiet Night with a faint-star black sky, First Light, Forest, Lavender, and Minimal.">
</p>

Morning Mist is the default outside the authenticated space; Quiet Night (deep black with faint stars), First Light, Forest, Lavender, and Minimal are available after login under **My → Appearance**.

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
- Remote Supabase migrations are prepared but not applied; do not reset existing databases or budget ledgers.
- Real devices cannot reach a PC backend through their own `127.0.0.1`; release builds need HTTPS plus registered request domains.

More: [product](docs/PRODUCT.md) · [design](docs/DESIGN.md) · [setup](docs/SETUP.md) · [native acceptance evidence](docs/WECHAT_VALIDATION.md)
