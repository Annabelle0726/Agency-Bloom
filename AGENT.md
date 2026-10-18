# Agency OS — Repository Working Guide

## Product intent

Agency OS helps adults explore career possibilities, compare choices, and learn from affordable real-world experiments. Preserve the user's decision-making authority. It is not therapy, a generic planner, or an AI relationship substitute.

Use confirmed user information as facts. Keep model assumptions and unverified market information separate. Suggestions and insights are optional; only explicit user confirmation can turn them into saved decision-card content. Do not add automatic career research, unsolicited reminders, or extra model calls.

## Project structure

- `apps/miniprogram`: Vue 3, TypeScript, uni-app, and SCSS; WeChat Mini Program is the primary platform.
- `apps/api`: Python/FastAPI, local SQLite development, and PostgreSQL deployment support.
- `supabase/migrations`: additive database changes; preserve existing accounts and records.
- `design/themes`: theme reference artwork, provenance, and preparation notes.
- `docs`: product, design, setup, and validation records.
- `tools`: local development and acceptance helpers.

Read the current implementation and existing tests before editing. Preserve unrelated working-tree changes, especially when another task is editing the same file. Do not reset, overwrite, or include unrelated changes in a commit.

## Development and acceptance

Run from the repository root in PowerShell:

```powershell
# Terminal 1: application API
npm run dev:api
# Terminal 2: watched Mini Program build and Developer Tools
npm run dev:wechat
```

`dev:mp` watches the Mini Program without opening the tools. These frontend commands do not start the Python API. `npm run dev` provides an auxiliary H5 preview.

- Development output: `apps/miniprogram/dist/dev/mp-weixin`
- Formal build output: `apps/miniprogram/dist/build/mp-weixin`
- Developer Tools installation: `C:\Software\Tencent\微信web开发者工具`

Edit source files, never generated output. Keep global SCSS as direct style sources in `App.vue`. Diagnose native component style isolation before changing it; do not disable isolation globally as a shortcut.

Use checks appropriate to the change:

```powershell
npm run typecheck
npm run test:ui
npm run test:api
npm run lint:api
npm run test:tools
npm run build:mp
```

WeChat simulator rendering is the primary UI acceptance target. H5 screenshots and native compiler success do not prove simulator acceptance. Report the actual device dimensions, exercised flows, and remaining limits. Native helpers have specific ports and fixture requirements; read their headers before running them. Use isolated Mock APIs for interaction tests, not the paid provider.

## Interface and themes

Keep the experience quiet, readable, and responsive. Prefer immediate press feedback, restrained motion, and compact spacing. Respect the status bar, capsule, keyboard, fixed composer, and bottom safe area. Prevent duplicate submissions. Do not add decorative space that obscures useful content. New product copy should avoid unnecessary terminal full stops.

Morning Mist is the default outside the authenticated personal space. Theme changes require authentication and must persist without changing privacy settings. Preserve the saved `light` and `dark` IDs for existing accounts.

The user-selected `design/themes/references/mist.png` is authoritative for Morning Mist. Preserve the original PNG. Its background and thumbnail must derive from that source; do not replace it with a new generation or the superseded misty-lake artwork. Follow `design/themes/README.md` for crop dimensions and the limitations of the older preparation script. Keep large reference files outside Mini Program static assets.

## Privacy, credentials, and budget

- Keep secrets in ignored backend environment files. Never put provider keys, database passwords, or server secrets in frontend variables, committed files, logs, screenshots, or reports.
- Do not delete databases, accounts, environment configuration, usage history, or budget ledgers.
- Keep the total running budget at CNY 100/month and the AI allocation at CNY 20/month unless the user changes them. Preserve reservations, rate limits, and recorded usage.
- Do not initiate a paid DeepSeek test without explicit authorization for that test. Do not remove a live-test guard or retry a paid request automatically.
- AI data processing requires separate, revocable consent. Full conversation retention stays opt-in. Keep account-level authorization and editable, user-confirmed cards.
- Distinguish service connectivity, authentication failure, missing WeChat setup, and model-service failure. Never present a Mock response as a real provider response.

## Documentation and Git

Write repository documentation in English, with Chinese user-facing setup documentation in `README_zh.md`. Use English Git commit messages. Commit or push only when the user requests it; a commit request does not authorize a push. Before committing, inspect the staged diff, check for sensitive data, and state what was verified and what remains unverified.
