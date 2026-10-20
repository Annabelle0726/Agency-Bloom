# Conversations and user-controlled memory

## Delivered behavior

An exploration owns a versioned decision card and feedback. Each conversation has a primary exploration, a title, a response mode, independent chat state, and an optional reviewed summary. Multiple explorations can remain active. Up to three other owned exploration cards can be explicitly linked to a conversation; their transcripts are never included automatically.

The left drawer exposes active conversations, explorations, archived conversations (in that order), and a memory manager. Its empty state also opens the new-conversation form. A local greeting quotes one enabled global/current-exploration memory only with memory-use consent, falling back to the user's actual question or neutral copy. This makes no model request and creates no chat message. Native scrollbars are hidden; a theme-colored indicator appears briefly only when scrolling overflowing content. Browser scrollbars use the same theme tokens.

Mobile windows are independently retained conversations shown one at a time, with a strip for switching opened conversations. Only the selected conversation ID is remembered locally per account; drafts and message text are not written to device storage. Closing the drawer does not cancel a reply. Hiding the Mini Program cancels outstanding requests; background execution and desktop side-by-side panes are not promised.

Archiving hides a conversation from the active list and stops a pending response. Restoring it does not create a new exploration. Ending an exploration prevents further chat until it is explicitly resumed. The decision card remains separate from generated chat suggestions, summaries and memories.

Deletion is available in both active and archived lists, after an explicit scope confirmation. `DELETE /api/conversations/{id}?version=N` checks ownership and version, cancels pending requests, and deletes the conversation, messages and context links. Memory source references and usage-only billing references become null; confirmed memories, exploration cards and budget ledgers survive. The UI clears the deleted window/draft and selects another active conversation in that exploration when available. Otherwise it offers a new conversation and disables the composer.

## Context contract

For retained conversations, the server supplies the authoritative recent transcript, ignoring client-provided history. Non-retained conversations send bounded in-memory history. Chat receives at most eight recent messages plus the reviewed summary; explicit summarization receives at most eighty recent messages plus the previous reviewed summary. The UI states this scope. This is bounded continuity, not a claim that the entire historical transcript fits in the model context.

The prompt also receives the primary exploration card/background/feedback, the conversation's response mode, explicitly linked cards and enabled memories within the relevant scopes. All of these are data, never system instructions. Current user corrections outrank older summaries and memory. A summary does not promote speculative statements into facts.

`POST /api/conversations/{id}/chat` accepts `task=chat|summary`. Both share consent checks, daily limits, monthly budget reservations, cancellation, provider schema validation and no automatic retry. A summary response is a draft, not a persisted message. On the first completed chat turn, the same response may also provide a short `conversation_title`; the server applies it only to a provisional title, without another model call. `PUT /api/conversations/{id}/summary` saves a reviewed summary only when chat retention is enabled; otherwise the UI keeps the reviewed text in memory until the session ends. No model call is made by saving, editing, archiving, linking or merging memory.

The prompt requests grounded progress (specific details, explained connections, unresolved questions) instead of generic reassurance. Mock tests validate routing and contracts; they do not establish live-model quality. Paid quality evaluation requires separate authorization.

## Retention and memory

Conversation metadata persists, including titles and exploration membership. On the first completed chat turn, the same chat response may include a very short conversation name; it is applied only while the title is still provisional (the API default, the legacy label, or the first-message excerpt). A title the user has chosen is never overwritten, and no separate title request or transcript is created. Full transcript retention remains off by default. Only successful completed chat turns and their structured suggestion/insight payloads are retained when enabled. Drafts are not written to device storage.

Turning retention off deletes message rows and all conversation summaries and cancels pending work. The frontend clears these retained artifacts too. Enabling retention applies to future turns, not historical in-memory messages. Long-term memories and decision cards are independently user-confirmed records and remain until explicitly removed or the account is deleted.

Memories have content, category (fact/preference/constraint), scope (global or exploration), enabled state, source conversation reference and optimistic version. There are at most forty memories per user. Memory use is a separate switch, off by default. Editing, disabling, deleting or merging a memory invalidates pending generations so a late response does not silently use superseded context. Merging is atomic, requires current versions, and replaces selected records only after the user reviews the new text and scope. It uses no additional model call.

Deleting a memory removes it from the memory context; it does not redact the same words from old chat messages or externally processed requests. All content access stays behind account ownership checks. Database tables have RLS enabled and direct Supabase API roles revoked, consistent with the existing FastAPI-owned data model.

## API and migration

- `/api/conversations`: create and list (active/archived, exploration filter, offset/limit).
- `/api/conversations/{id}`: get, versioned update (rename, response mode, links, archive/restore), and versioned deletion.
- `/api/conversations/{id}/messages`: stable `(created_at,id)` cursor pagination and structured response artifacts.
- `/api/conversations/{id}/summary`: versioned user-reviewed summary or explicit removal.
- `/api/memories`: owned list and explicitly confirmed creation.
- `/api/memories/{id}`: versioned edit/disable/delete.
- `/api/memories/merge`: atomic reviewed replacement of 2–10 owned records.
- `/api/requests/{request_id}`: ownership-checked status without another model call. Only retained completed chat is recoverable from messages. No response-body cache is created when retention is off.
- `/api/issues/{id}/resume`: resume an ended exploration.

`20261018010000_conversations_and_memories.sql` must be applied to a deployment before its new API is started. SQLite development startup performs the corresponding upgrade. Old messages receive a stable conversation whose ID matches their exploration, without inventing thread boundaries. Backfill runs only when adding the legacy message conversation column, so later startups cannot resurrect deleted conversations. The one-active-exploration index is removed intentionally; accounts, cards, feedback and cost ledgers are preserved. Existing issue-scoped chat endpoints remain compatible while their original conversation exists and is active; otherwise they return 409 before calling the provider and require opening/creating a conversation.

No hosted migration or private local application migration is performed by the verification workflow. Deployment backups and migration execution remain deployment work.

## Verification

Chat generation failures return HTTP 502 with `detail: {code: ...}`. The client maps
only allowlisted codes to local copy; arbitrary upstream error text is never shown.
Codes distinguish provider authentication/balance/rate limits, request rejection,
network/timeout, truncated/empty/invalid output, invalid usage and internal errors.
Logs retain `generation_failed kind=... status=...` and add `code` plus schema field
names from a fixed allowlist, without response text, credentials or user context.
Check `finish_reason` before JSON validation so a length cutoff is reported as
`output_truncated`. Partial output is never saved or automatically repaired/retried.

A failed second turn does not lock a conversation. `test_ai_failures.py` verifies a
successful first turn, an empty/truncated second turn and a successful next explicit send,
with retention both on and off. Status lookup does not call the provider and cannot
recover a failed generation. Existing failures predate these diagnostic codes and
cannot be retroactively classified from the usage ledger alone.

DeepSeek documents occasional empty responses in [JSON Output mode](https://api-docs.deepseek.com/guides/json_mode/).
To mitigate conflicting format examples in later turns, display-only assistant history
is JSON-encoded as `{reply: <original text>, suggestion: null}` when assembling the
prompt. User messages and stored history are unchanged. Historical text is never
parsed into trusted model fields. A final system instruction reinforces a nonempty,
complete minimal JSON response. Mock tests verify the contract, failure isolation and absence of automatic retries,
not the provider's probability of returning empty output.

An explicitly authorized live check on 2026-10-19 used a disposable database and
synthetic user with the configured `deepseek-flash` model and 768-token cap. Both
consecutive turns returned HTTP 200 with nonempty valid replies and `finish_reason=stop`
(1.35 s and 0.93 s); the second turn included the two previous messages. No retries
were performed. Local estimated total cost was CNY 0.00248; this is not a provider
invoice. The local receipt is `output/ai-diagnostics/live-20261019T111139Z.json`.
This verifies a real two-turn exchange after the mitigation, not the absence of
all future intermittent provider failures.

### Follow-up: empty chat output on 2026-10-20

The user reported another `output_empty` after the earlier prompt-only mitigation.
That two-turn success did not establish a durable fix. A fresh six-turn baseline
also succeeded, so the real-provider failure was intermittent during investigation.
Controlled calls with identical history confirmed that text mode can return a
complete conversational reply without JSON; simply switching modes while retaining
the old JSON-only parser would introduce a different failure.

Chat now uses the provider's `text` response mode while the prompt still requests
structured output. Complete JSON (including a single JSON code fence) is validated
against the unchanged strict output schema. Complete ordinary text can become only
a bounded `reply`, with no suggestion, insight or memory-change artifact. Malformed
JSON-looking output, invalid structured fields, empty content, and truncated output
are rejected; they are never salvaged as chat. Summary tasks still require their
structured schema and JSON mode. There is one provider request per explicit action,
with no automatic retry or model-based repair. Memory confirmation boundaries and
the existing thinking setting are unchanged.

Verification after this change:

- Seven consecutive real `deepseek-flash` calls at the existing 768-token cap, with
  thinking enabled: greetings, social disappointment, stopping analysis, changing
  topic, casual follow-ups, and an explicit career-card request. All returned 200;
  the last turn included a validated suggestion. Receipt:
  `output/ai-diagnostics/live-20261020T004453Z.json` (estimated CNY 0.008148).
- Isolated WeChat simulator at 390x844: structured first reply, plain-text second
  reply, simulated empty response preserving the draft, and a successful next send
  clearing the error. Four Mock calls, zero paid calls. Evidence:
  `output/ai-diagnostics/native-result.json` and `native-after-recovery.png`.
- Backend: 138 passed, 1 optional PostgreSQL test skipped; frontend: 76 passed;
  type checking, Ruff and WXML/WXSS build checks passed. Two stale test expectations
  were corrected: a malformed success fixture and irrelevant career context in
  greeting-only turns.

This removes chat's dependency on JSON-mode decoding; it is not a guarantee against
all upstream empty responses, network failures, or output-length limits.

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
