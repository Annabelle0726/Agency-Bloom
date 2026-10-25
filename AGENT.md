# Agency Bloom — Repository Working Guide

## Product intent

Agency Bloom helps people understand their own value, explore possibilities in a changing world, and make choices according to their own wishes within real constraints. Its purpose is to strengthen human agency. Career exploration is the first validation scenario, not the whole product identity. Read [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md) for the current product direction.

- Understand, Question, Explore and Become are revisitable dimensions of thinking, not compulsory conversation stages, user types, or progress levels. Listening, rest, asking for direct advice and changing one's mind are valid choices.
- Support both practical livelihood and personally meaningful living. A skill's market price does not define a person's whole value. Do not promise that unique value makes someone immune to AI displacement, or replace realistic discussion of income and constraints with reassurance.
- Ask a useful question when a distinction matters to the help requested; do not turn every answer into another question. Offer grounded advice when requested. Perspectives are tentative, evidence-linked and rejectable; challenge an assistant's earlier assumptions as readily as a user's premise. Do not diagnose or invent hidden motives.
- User-owned understanding is the intended outcome. AI paraphrases, possible values and proposed next steps remain drafts until the user confirms them. Discover must draw from voluntarily supplied real clues, respect current intent, and allow no suggestion when evidence is insufficient. No random daily self-analysis or unsolicited push.
- Preserve the existing pages and conversation system. The Perspective Shift implementation remains an offline, default-off Mock prototype until a separate implementation and validation task enables it. Product direction documents do not themselves activate features or establish model quality.
- For page planning and implementation, follow @docs/PRODUCT_DIRECTION.md, especially [Home entry and conversational onboarding](docs/PRODUCT_DIRECTION.md#home-entry-and-conversational-onboarding--2026-10-24) and [Detailed plans for the other pages](docs/PRODUCT_DIRECTION.md#detailed-plans-for-the-other-pages--2026-10-24). They cover the right-edge Bloom/bubble, five optional prompts, Conversation, Discover, Plan, Me and Journey, including data boundaries, failure states, delivery order and acceptance. Treat these as future design requirements, not already implemented behavior.

Bloom is not therapy, an autonomous life-planning agent, a productivity supervisor, or an AI relationship substitute. Commercial value and advantages over general-purpose AI must be tested in concrete scenarios; the mission alone does not establish demand.

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
- Conversation names and membership are saved as metadata. Transcripts, unsent composer drafts, structured reply artifacts and reviewed summaries require chat retention. Retained composer drafts live in a separate account-owned table, keyed by conversation or pre-send draft shell, and never enter model context until sent. With retention off, transcripts, drafts and reviewed summaries stay in memory only. Disabling retention clears stored messages, composer drafts and summaries, including in-flight saves; it does not delete separately confirmed memories/cards.
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

- Chat reserves the fixed composer's measured height exactly once, including inline notices. Do not add another fixed bottom padding or duplicate its safe-area allowance in the transcript or shell. Verify the last reply's action row is visible above the composer with a compact reading gap, including after keyboard dismissal.
- Adaptive chat routing is a local, versioned per-turn policy, never a classifier model request. Select the model and its matching rate card before budget reservation, and use that same selection for dispatch and settlement. Preserve fixed evaluation configurations and never automatically escalate or retry a paid generation.

- Chat exceptions must appear in a compact, theme-aware notice immediately above the composer, including while the keyboard is open. Do not place the only actionable error at the top of a long transcript, or rely on an avatar status dot alone.
- Keep the draft and composer available after a failure. Show the actual safe error category and an explicit recovery action when available; never retry a model request automatically.
- Clear a chat exception when a successful reply or verified recovery resolves it. Starting another attempt, editing a draft, switching conversations, or waiting for a timer is not proof of recovery. Error content and its request reference must remain isolated by conversation; a late result must not clear another conversation's error.
- Native acceptance must cover failure after an overflowing transcript, the notice above the input, preserved drafts, failed recovery, and automatic removal after successful recovery or a successful subsequent reply.

Morning Mist is the default outside the authenticated personal space. Theme changes require authentication and must persist without changing privacy settings. Preserve the saved `light` and `dark` IDs for existing accounts.

Inside the authenticated personal space, the theme follows the time of day by default through four local boundaries: 05:00 morning mist (`light`), 10:00 forest, 16:00 evening smoke (`dawn`), and 19:00 quiet night (`dark`). A manual pick in the appearance sheet overrides only the current slot: persist `{theme, slot}` under `agency.theme.override.v1:<userId>`, where the slot key is the local slot start (the 19:00 key remains through midnight). At the next 05/10/16/19 boundary, discard the override and resume the time theme. The Settings switch `随时间自动切换` is on by default; turning it off writes `agency.theme.auto.v1:<userId>` = false, clears the override, and keeps the visible theme as the account's long-term `user.theme`. Turning it back on resumes time themes. Migrate the old `agency.theme.manual.v1:<userId>` flag to auto-off so existing explicit choices remain long-term. Use a reactive clock, a timer for the next boundary, and an `onShow` refresh; defer automatic repainting while the keyboard is open, then apply the latest policy when it closes. Handle account switches per user ID. The `dawn` ID, its files, and stored preferences are unchanged; only its display strings were renamed to Evening Smoke / 暮烟 to match the dusk artwork. Do not rename theme IDs.

The user-selected `design/themes/references/mist.png` is authoritative for Morning Mist. Preserve the original PNG bytes in the verified cloud archive (references/mist.png). The six theme image/preview URLs now point to the references bucket without literal braces. For deliberate derivative maintenance, node tools/source-archive.cjs --cache materializes hash-checked copies only under ignored output/visual-source-cache/. Its background and thumbnail must derive from that source; do not replace it with a new generation or the superseded misty-lake artwork. Follow `design/themes/README.md` for crop dimensions and the limitations of the older preparation script. Keep large reference files outside Mini Program static assets.

## Visual selection and image updates

Chat artwork is selected by DeepSeek only within a server-reviewed candidate pool, using the existing chat request and returning one stable visual_id or null. Validate eligibility and exclude visible IDs/source families before persistence; malformed or ineligible suggestions fall back locally without a second call. Do not call this newly generated artwork or a timed image carousel. Each reply retains its own ID; theme changes resolve/hide variants locally, without another model request.

Discover/Plan imagery uses the deterministic client resolver. Discover recommendation rotation is local batching, not DS image selection. Preserve original bytes and the six frozen reference hashes in the verified Supabase source archive. On 2026-10-25 the user explicitly authorized removal of the 48 local masters and six local references after exact remote byte/SHA-256 verification. Their historical originalPath remains provenance metadata; use originalUrl and assets/visual-library/source-archive.json for cloud sources. Do not restore deleted local masters automatically. Keep lightweight runtime derivatives used by backend candidate validation. Backend filtering currently uses saved user.theme, which can differ from the automatic frontend theme; do not claim those are fully synchronized. See [current code audit](docs/VISUAL-ASSET-SYSTEM.md#current-selection-ownership--code-audit-2026-10-25) for conditions, limits and cloud delivery.

Mini Program image/audio quality is an aggregate package limit: keep the sum of supported raster, SVG, audio and MP4 files strictly below 200 * 1024 bytes. Do not treat it as a per-file limit. The verified media finalizer runs after static copying in both development and release builds; tools/check-mp-media.cjs and check-wechat.mjs enforce it. Preserve four explicit local Discover fallback thumbnails and small controls/avatars. Legacy presentation cloud URLs and exact byte receipts are in apps/miniprogram/src/app-media.json. Never prune an unverified or changed file.

## Privacy, credentials, and budget

- Read Aloud is a separate, revocable consent and an explicit per-reply action. Only visible final assistant reply text may reach TTS; never send private reasoning, system instructions, context payloads or arbitrary client text. Unretained replies require a server-issued, expiring proof. Never auto-read or auto-retry uncertain synthesis.
- First-use speech disclosure belongs in a compact inline notice above the composer, with an explicit enable action and a skip action. Keep the draft, textarea and keyboard available; do not open a pre-playback modal. Detailed consent management can remain in Settings. A missing speech database migration must return a safe, actionable setup error instead of an undifferentiated failure.
- Keep TTS behind its independent provider interface. Mock is the default; credentials alone must not enable Tencent calls. `AGENCY_TTS_PAID_ENABLED` stays false unless the user explicitly authorizes enabling the real service. TTS usage limits and cache are independent of DeepSeek's unchanged budget.
- Speech errors follow the composer-adjacent exception rule. Stop playback, abort pending downloads, destroy audio contexts and remove temporary files when switching conversations, hiding/leaving the page, logging out or revoking speech consent. Check native playback callbacks, not just button labels; never claim real-device acceptance from a simulator.

- Keep secrets in ignored backend environment files. Never put provider keys, database passwords, or server secrets in frontend variables, committed files, logs, screenshots, or reports.
- Do not delete databases, accounts, environment configuration, usage history, or budget ledgers.
- Keep the total running budget at CNY 500/month and the AI allocation at CNY 100/month unless the user changes them.
- AI data processing requires separate, revocable consent. Chat retention is on by default (product decision 2026-10-19); turning it off still purges stored messages and summaries immediately, and re-enabling applies only to future turns. Keep account-level authorization and editable, user-confirmed cards.
- Distinguish service connectivity, authentication failure, missing WeChat setup, and model-service failure. Never present a Mock response as a real provider response.

## Documentation and Git

Write repository documentation in English, with Chinese user-facing setup documentation in `README_zh.md`. Use English Git commit messages. Commit or push only when the user requests it; a commit request does not authorize a push. Before committing, inspect the staged diff, check for sensitive data, and state what was verified and what remains unverified.

# All codes should have **no-errors**! UI Max (use available skill + mobile-native skill), no worktree
