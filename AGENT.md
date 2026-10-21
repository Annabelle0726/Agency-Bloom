# Agency Bloom — Repository Working Guide

## Product intent

Agency Bloom helps adults explore career possibilities, compare choices, and learn from affordable real-world experiments. Preserve the user's decision-making authority. It is not therapy, a generic planner, or an AI relationship substitute.

Use confirmed user information as facts. Keep model assumptions and unverified market information separate. Suggestions and insights are optional; only explicit user confirmation can turn them into saved decision-card content. Do not add automatic career research, unsolicited reminders, or extra model calls.

## Web grounding

Web search is an explicit, per-turn user action (`web_search: true` on the chat request), powered by the optional Bocha key in backend environment files. It is never automatic, never a background fetch, and never a second model call.

- Search results are unverified external data. They enter the prompt as attributed snippets (`web_search_results` with site, URL and summary), and the system prompt must require the model to say "根据网上资料" or name the source, mark unverified numbers as 待核实, prefer confirmed user information on conflict, and never write search results into `confirmed`/`constraints` or propose card edits from them.
- The UI shows returned sources under the reply (`web_sources`), labelled as unverified. A failed or unconfigured search degrades silently to a normal un-grounded turn; it must not block the reply or fabricate sources.
- No page fetching, crawling, or chained tool use: one search call per turn at most, results truncated to five, no persistence of raw result pages. The search key is a backend secret under the same rules as the provider key.

## Conversations, context, and memory

Read [CONTEXT.md](CONTEXT.md) for the domain vocabulary and [docs/CONVERSATIONS.md](docs/CONVERSATIONS.md) for contracts and migration details.

- An exploration is a long-running question; a conversation is an independent discussion. Multiple active explorations and multiple conversations per exploration are supported. Archive a conversation without ending its exploration. Window selection is UI state, not a new account or exploration.
- The left drawer is the conversation/exploration navigator and memory manager. Its tabs are active conversations, explorations, then archived conversations. Hide idle native scrollbars; show a theme-colored overflow indicator only while scrolling. Keep drafts, errors, pending requests, summaries and proposals isolated by conversation ID. A response arriving after a window switch belongs to its originating conversation.
- Empty conversation lists offer an actionable new-conversation entry and a short local greeting. Only use enabled global/current-exploration memory when the account has enabled memory use; otherwise quote the user's actual question or use neutral copy. Never call a model or persist a fabricated chat turn for this greeting.
- Conversation deletion requires ownership and the current version, cancels in-flight work and removes its messages, summary, links and local window/draft. Independently confirmed cards/memories and usage records survive with source references cleared. Legacy startup backfill runs only when adding the conversation column, so deleted conversations never return after restart.
- Use only the current conversation's recent messages, its reviewed summary, its exploration, explicitly linked exploration cards (at most three), and enabled, scope-matched memories. Never silently combine transcripts from other conversations.
- Summarization is an explicit user action using the same consent, budget, cancellation and no-retry boundary as chat. Generated summaries are drafts; review is required before they become context. Summary generation must not append invented conversation turns or automatically create memories/cards.
- Conversation names and membership are saved as metadata. Transcripts, structured reply artifacts and reviewed summaries require chat retention. With retention off, transcripts, drafts and reviewed summaries stay in memory only. Disabling retention clears stored messages and summaries, including in-flight saves; it does not delete separately confirmed memories/cards.
- Long-term memories require explicit confirmation, support global or exploration scope, and are editable, individually enabled/disabled, mergeable and deletable. Using memories is a separate account preference, off by default. Merging requires a reviewable replacement and version checks. Never infer permanent personality traits from a rejection or a conversation summary.
- Changes to consent, context links, summaries or memories invalidate affected pending generations. Preserve account ownership, optimistic versions, budget reservations and usage-only billing records. Deleting a memory does not rewrite its wording in existing chat transcripts.
- SQLite startup upgrades and PostgreSQL migrations preserve old messages by assigning one deterministic legacy conversation per exploration. Do not infer historical thread boundaries. Never run migrations or QA against the user's private database during development verification.
- Validate through isolated MockTransport, then a separate tourist Mini Program project. `tools/mock-conversations-api.py` uses a fresh disposable database on port 8018; `tools/verify-conversations-native.cjs` targets only its copied project and automation port 9438. Never connect that helper to the user's existing project/session.

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

Inside the authenticated personal space, when the account has never picked a theme manually, the theme follows the time of day quietly via `themeByTimeOfDay`: morning mist in the early morning (5–9), forest through the day, evening smoke near dusk (16–18), quiet night from 19:00. The first manual pick in the appearance sheet writes a per-account local flag (`agency.theme.manual.v1:<userId>`), after which no automatic switching happens. The `dawn` ID, its files, and stored preferences are unchanged; only its display strings were renamed to Evening Smoke / 暮烟 to match the dusk artwork. Do not rename theme IDs.

The user-selected `design/themes/references/mist.png` is authoritative for Morning Mist. Preserve the original PNG. Its background and thumbnail must derive from that source; do not replace it with a new generation or the superseded misty-lake artwork. Follow `design/themes/README.md` for crop dimensions and the limitations of the older preparation script. Keep large reference files outside Mini Program static assets.

## Privacy, credentials, and budget

- Keep secrets in ignored backend environment files. Never put provider keys, database passwords, or server secrets in frontend variables, committed files, logs, screenshots, or reports.
- Do not delete databases, accounts, environment configuration, usage history, or budget ledgers.
- Keep the total running budget at CNY 500/month and the AI allocation at CNY 100/month unless the user changes them.
- AI data processing requires separate, revocable consent. Chat retention is on by default (product decision 2026-10-19); turning it off still purges stored messages and summaries immediately, and re-enabling applies only to future turns. Keep account-level authorization and editable, user-confirmed cards.
- Distinguish service connectivity, authentication failure, missing WeChat setup, and model-service failure. Never present a Mock response as a real provider response.

## Documentation and Git

Write repository documentation in English, with Chinese user-facing setup documentation in `README_zh.md`. Use English Git commit messages. Commit or push only when the user requests it; a commit request does not authorize a push. Before committing, inspect the staged diff, check for sensitive data, and state what was verified and what remains unverified.

# All codes should have no errors!