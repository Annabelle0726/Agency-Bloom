# Conversations and user-controlled memory

## Delivered behavior

An exploration owns a versioned decision card and feedback. Each conversation has a primary exploration, a title, a response mode, independent chat state, and an optional reviewed summary. Multiple explorations can remain active. Up to three other owned exploration cards can be explicitly linked to a conversation; their transcripts are never included automatically.

The right drawer exposes active conversations, archived conversations, exploration switching/creation, and a memory manager. Mobile windows are independently retained conversations shown one at a time, with a strip for switching opened conversations. Only the selected conversation ID is remembered locally per account; drafts and message text are not written to device storage. Closing the drawer does not cancel a reply. Hiding the Mini Program cancels outstanding requests; background execution and desktop side-by-side panes are not promised.

Archiving hides a conversation from the active list and stops a pending response. Restoring it does not create a new exploration. Ending an exploration prevents further chat until it is explicitly resumed. The decision card remains separate from generated chat suggestions, summaries and memories.

## Context contract

For retained conversations, the server supplies the authoritative recent transcript, ignoring client-provided history. Non-retained conversations send bounded in-memory history. Chat receives at most eight recent messages plus the reviewed summary; explicit summarization receives at most eighty recent messages plus the previous reviewed summary. The UI states this scope. This is bounded continuity, not a claim that the entire historical transcript fits in the model context.

The prompt also receives the primary exploration card/background/feedback, the conversation's response mode, explicitly linked cards and enabled memories within the relevant scopes. All of these are data, never system instructions. Current user corrections outrank older summaries and memory. A summary does not promote speculative statements into facts.

`POST /api/conversations/{id}/chat` accepts `task=chat|summary`. Both share consent checks, daily limits, monthly budget reservations, cancellation, provider schema validation and no automatic retry. A summary response is a draft, not a persisted message. `PUT /api/conversations/{id}/summary` saves a reviewed summary only when chat retention is enabled; otherwise the UI keeps the reviewed text in memory until the session ends. No model call is made by saving, editing, archiving, linking or merging memory.

The prompt requests grounded progress (specific details, explained connections, unresolved questions) instead of generic reassurance. Mock tests validate routing and contracts; they do not establish live-model quality. Paid quality evaluation requires separate authorization.

## Retention and memory

Conversation metadata persists, including user-entered titles and exploration membership. No title is silently generated from private message text. Full transcript retention remains off by default. Only successful completed chat turns and their structured suggestion/insight payloads are retained when enabled. Drafts are not written to device storage.

Turning retention off deletes message rows and all conversation summaries and cancels pending work. The frontend clears these retained artifacts too. Enabling retention applies to future turns, not historical in-memory messages. Long-term memories and decision cards are independently user-confirmed records and remain until explicitly removed or the account is deleted.

Memories have content, category (fact/preference/constraint), scope (global or exploration), enabled state, source conversation reference and optimistic version. There are at most forty memories per user. Memory use is a separate switch, off by default. Editing, disabling, deleting or merging a memory invalidates pending generations so a late response does not silently use superseded context. Merging is atomic, requires current versions, and replaces selected records only after the user reviews the new text and scope. It uses no additional model call.

Deleting a memory removes it from the memory context; it does not redact the same words from old chat messages or externally processed requests. All content access stays behind account ownership checks. Database tables have RLS enabled and direct Supabase API roles revoked, consistent with the existing FastAPI-owned data model.

## API and migration

- `/api/conversations`: create and list (active/archived, exploration filter, offset/limit).
- `/api/conversations/{id}`: get and versioned update (rename, response mode, links, archive/restore).
- `/api/conversations/{id}/messages`: stable `(created_at,id)` cursor pagination and structured response artifacts.
- `/api/conversations/{id}/summary`: versioned user-reviewed summary or explicit removal.
- `/api/memories`: owned list and explicitly confirmed creation.
- `/api/memories/{id}`: versioned edit/disable/delete.
- `/api/memories/merge`: atomic reviewed replacement of 2–10 owned records.
- `/api/requests/{request_id}`: ownership-checked status without another model call. Only retained completed chat is recoverable from messages. No response-body cache is created when retention is off.
- `/api/issues/{id}/resume`: resume an ended exploration.

`20261018010000_conversations_and_memories.sql` must be applied to a deployment before its new API is started. SQLite development startup performs the corresponding upgrade. Old messages receive a stable conversation whose ID matches their exploration, without inventing thread boundaries. The one-active-exploration index is removed intentionally; accounts, cards, feedback and cost ledgers are preserved. Existing issue-scoped chat endpoints remain compatible for older clients.

No hosted migration or private local application migration is performed by the verification workflow. Deployment backups and migration execution remain deployment work.

## Verification

Run from the repository root so importing the test application does not load `apps/api/.env`:

```powershell
$env:AGENCY_AI_MODE='demo'
$env:AGENCY_DATABASE_URL='sqlite://'
uv run --offline --project apps/api pytest -c apps/api/pyproject.toml apps/api/tests
uv run --offline --project apps/api ruff check apps/api/app apps/api/tests
npm run typecheck
npm run test:ui
npm run test:tools
```

For native QA use `tools/mock-conversations-api.py` and the header of `tools/verify-conversations-native.cjs`. The latter verifies its tourist project and Mock marker before touching synthetic storage, then exercises drawer geometry, independent drafts, late reply routing, summary review/save, memory use, archive/restore and restart recovery. Never run it against the normal project or provider. WXML/WXSS compilation and simulator acceptance are separate checks.
