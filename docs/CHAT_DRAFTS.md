# Unsent composer drafts

The composer saves unsent text to the account while chat retention is enabled.
Existing conversations and never-sent conversation shells are supported. Text is
separate from chat messages and model context. The first message still creates
the conversation only when the user sends it.

## Database and API

Apply `supabase/migrations/20261025010000_chat_drafts.sql` before deploying the
updated API. Development SQLite creates the additive table at startup. No hosted
database or private application database was migrated during verification.

`chat_drafts` has an account/key primary key, optional conversation and exploration
foreign keys, exact composer text, an optimistic version and update time. Empty
rows preserve versions to reject stale writes. Conversation deletion cascades its
draft. Account deletion cascades all drafts. RLS is enabled and direct client
access is revoked, consistent with the existing FastAPI ownership boundary.

`GET /api/chat-drafts` returns owned drafts. `PUT /api/chat-drafts/{key}` accepts
`{content, issue_id, version}`. Keys are conversation UUIDs or `draft:<UUID>`.
Writes preserve whitespace, accept at most 2,000 characters, check ownership and
versions, and share the account lock used by privacy updates. Turning retention
off purges stored drafts and prevents pending writes from restoring them.

The client serializes writes per composer after a 500 ms debounce. Hiding the
page and logging out flush pending edits. Save failures preserve current input
and show a composer-adjacent notice. Returning to the page retries pending draft
synchronization. Successful chat sends clear the originating composer; failed
sends keep its text. Drafts are never written to device storage or sent to a model
by synchronization.

## Verification on 2026-10-25

The new migration and the complete preceding migration chain applied to a fresh,
disposable PostgreSQL 16 container. Reapplying the new migration succeeded; the
table has RLS enabled. SQLite API tests exercised restart restoration, exact
whitespace, ownership, version conflicts, clearing, deletion, retention purge and
input validation. Frontend tests exercised page restart before the first send,
existing conversation restoration, serialized edits during a pending write,
handled network failures, clearing and account/retention changes.

Final checks: TypeScript checking passed; 314 frontend tests across 58 files
passed; 29 targeted API tests passed; Ruff passed; all five tool tests passed.
The Mini Program build and bundled WeChat compilers passed (37 WXSS and 59 WXML
files). Compiler success does not establish simulator acceptance.

Native acceptance remains blocked. Separate tourist projects were built and
opened on automation ports 9471 and 9472, including a copy outside the repository.
The installed Developer Tools Nightly 2.01.2602282 returned only IDE version
metadata, without a Mini Program `SDKVersion`. The isolated window did not expose
a usable Mini Program runtime. No user account storage was changed by these
checks. `output/chat-drafts/native-result.json` records `verified: false`.

Once an isolated tourist runtime is available, start
`tools/mock-conversations-api.py`, build a separate project with
`VITE_API_BASE_URL=http://127.0.0.1:8018/api`, set the copy's app ID to
`touristappid` and project name to `Chat Drafts Isolated QA`, and launch it with
automation port 9472. Run `node tools/verify-chat-drafts-native.cjs <copy-path>`.
The helper verifies restart restoration and successful-send clearing using
synthetic data and records device dimensions and runtime errors. It refuses to
change storage without the expected isolated project and a native runtime.

The full API suite also reported nine frozen evaluation guard failures with
`evaluation_system_changed` (298 passed, one optional PostgreSQL test skipped).
The guard and system-prompt implementation were unchanged by this task. No
evaluation protection was relaxed. The owner subsequently authorized committing
the current changes with these validation limits disclosed; native acceptance
remains outstanding.
