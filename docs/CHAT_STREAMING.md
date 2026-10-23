# Progressive replies and selected-text questions

Normal chat accepts `Accept: text/event-stream` on the existing POST endpoint.
Admission, consent, ownership, daily limits, monthly reservation, cancellation,
edit version checks and final persistence continue through the existing runner.
Summary requests and older JSON clients retain their existing response contract.
There is one provider request, with no automatic retry or repair request.

## Delay and observability

Previously the provider payload set `stream: false`: the entire reasoning,
structured answer, grounding and usage checks completed before any reply reached
the user. Thinking mode also precedes answer generation. Streaming improves the
time at which text becomes visible; it does not promise faster model computation.
No thinking effort, token allowance, budget or production deadline is reduced.

The provider now streams for opted-in chat and requests final usage. The API
emits fixed `phase` events, cumulative public `reply` previews, then `done` with
the existing complete response or an allowlisted `error`. Reasoning-channel
presence can select the thinking phase; its contents are never accumulated,
returned, stored or logged. The existing grounded response explanations remain
separate from private model reasoning. A keepalive has no model cost.

Only the first top-level JSON `reply` string is previewed. Gateways returning
complete JSON despite the streaming option, plain text replies, and other field
orders can finish normally without incremental previews. Complete output,
grounding, finish reason and usage are still checked before a transcript or
artifact is saved. A failed, stopped or disconnected preview is discarded;
the original question and selected quote remain editable. A completed request
whose final delivery is lost can use the existing explicit status recovery.

`generation_timing` records numeric time to reasoning presence, first visible
reply and completion, with no user content or identifiers. These are per-request
measurements, not a real-provider latency benchmark. The isolated Mock timings
do not establish actual DeepSeek performance.

## Interaction

The Mini Program decodes UTF-8 across native chunk boundaries, including emoji.
Text follows the real provider stream, without an artificial typewriter delay.
Public phases use existing SVG icons and avatar states. A small waiting dock
retains elapsed time and the stop action.

The page scroll hook is registered in `index.vue` so the Mini Program compiler
enables lifecycle dispatch. A page-level bottom marker replaces selectors that
cross message-component boundaries. Reader movement toward older messages pauses
following; reaching the bottom or tapping **回到最新** resumes it. Native geometry
callbacks use a revision guard so an older result cannot override newer scroll
intent. Loading earlier history does not target a message index that has shifted.

Assistant replies retain an explicit **复制** action. Long-press opens an inline
selection, with draggable range handles and **复制 / 聊聊这段** actions. The
selected range, rather than the entire reply, becomes a removable chip above the
composer. The user writes a question before sending; selecting, copying or the selected-text action alone never calls the model. Selection does not read the system clipboard.
The native composer stays mounted and visible while selecting. Focusing it closes
the selection, and the contextual toolbar stays above the composer hit area.

The response style `warm-v1` asks for specific acknowledgment, respect for rest
and uncertainty, and zero to two suitable emoji. Serious distress and crisis
responses avoid cheerful decoration. Referencing AI text does not confirm it as
a user fact or decision. Existing frozen Mock evaluations deliberately retain
their reviewed prompt version and non-streaming wire contract; their guard,
ledger and pinned hashes are unchanged. They do not evaluate the new style.

## Verification

Unit and integration coverage includes split UTF-8/emoji, incomplete streams,
safe provider errors, provisional text without transcript mutation, cancellation,
retention on/off, final truncation, private-channel isolation, selection range
geometry, and selected-text questions waiting for a user-authored question.

Run `tools/verify-chat-stream-native.cjs` against the separate tourist project
and disposable Mock service on port 8018 / automation port 9438. The Mock fixture
uses explicit step gates so screenshots and assertions cannot race completion.
Native evidence is written under `output/chat-stream/`. The helper checks actual
element positions: the current Developer Tools SDK can report page scrollTop as
zero even when the Mini Program viewport has visibly scrolled.

No private application database, paid provider, clipboard contents or external
service is used by this acceptance workflow. Real-device handle dragging and
clipboard writes remain separate physical-device checks.

Acceptance on 2026-10-22: the final interaction passed three complete native
runs at 390 x 844, including two consecutive reruns in
`output/chat-stream/repeat.log`. Each run used two Mock generations and zero
paid requests. Assertions cover the visible composer during selection, an
on-screen contextual toolbar, selected-excerpt agreement, progressive rendering,
reading-position control, cancellation and transcript agreement. Screenshots:
`ask-selection.png`, `completed.png`, `streaming.png`, `reading-older.png`.

Type checking and all 139 frontend tests passed. The full backend run passed
236 tests with one optional test skipped. A later concurrent verification hit
the existing process-spawn test's 20-second start limit; its isolated rerun
passed without changing the guard or its test. Ruff passed. The restored normal
Mini Program build passed 18 WXSS and 45 WXML checks; existing Sass legacy API
warnings remain.

## Exception handling

Normal thinking/role chunks with `content: null` and reply prefixes containing
only whitespace used to trigger `output_invalid`. Both cases are now accepted
without weakening final schema, completion, private-channel or usage checks.
Regression tests reproduce the same public error before the fix. A screenshot
alone does not establish which upstream chunk caused a particular historic
failure; no private provider output was collected for this investigation.

Chat exceptions now live in the fixed composer dock, above the input and above
the keyboard. The transcript no longer repeats the same exception at its top.
Input and quotes survive failures. A separate in-memory `errorRequestId` keeps
the failed request associated with its notice while another attempt is running.
Only a completed response or a fully fetched, verified recovery clears it;
editing or starting another attempt does not. Conversation sessions own these
references independently. Reading failed request status never regenerates text.
The placement and recovery rules are recorded in `AGENT.md`.

The native helper `tools/verify-chat-error-native.cjs` exercises an overflowing
transcript, a genuine invalid-output fixture, the notice's position above the
input, draft preservation, failed status recovery without a provider call and a
successful subsequent reply. Evidence is under `output/chat-error/`. Backend
verification passed 238 tests with one optional skip; frontend verification
passed 141 tests and type checking. No paid provider calls were used.
The final exception workflow passed three native runs at 390 x 844, including
two consecutive reruns recorded in `output/chat-error/repeat.log`. The normal
Mini Program build was restored and passed 18 WXSS / 45 WXML checks.
