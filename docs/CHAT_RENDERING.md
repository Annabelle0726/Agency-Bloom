# First welcome and chat Markdown

Updated 2026-10-26.

## Welcome

The first empty Chat entry uses one continuous welcome sentence. It reuses the
ordinary assistant message component, avatar, Copy and Read Aloud controls; the
opening phrase alone is emphasized with the current theme. No extra large bubble
or start button is added. The existing inspiration card and starter buttons stay.

The context-aware version refers to the user's voluntarily supplied initial
clues. Direct entry without those clues uses a version that does not claim any
previous discussion. Welcome text stays local and outside transcript arrays,
model history, conversation summaries, cards and memories. Reading it never
creates an empty conversation or calls an LLM.

After a successful first reply, an account-scoped local boolean suppresses the
first introduction on later empty entries on that device. This flag stores no
conversation text. Existing conversations with messages do not show the welcome;
separately opened draft shells retain their existing short introduction.

## Markdown

Final replies and streaming text share a small native renderer. Supported forms
are paragraphs, headings, bullet/numbered lists, quotes, bold, italic, inline code,
fenced code and link labels. `==text==` is the supported theme-highlight extension.
Bold and highlight use theme colors rather than model-supplied color values.
Code remains literal, unmatched streaming markers remain readable, HTML is text,
and Markdown images show their alt text without fetching a remote image.

Copy and text selection operate on visible text rather than formatting markers.
Assistant text is still retained in its original form for authorized history and
proof verification. Read Aloud verifies that original source first, then removes
supported formatting before synthesis. Source hashes and ephemeral proofs remain
bound to the original reply, so formatting removal cannot authorize client text.
The ordinary warm reply prompt permits restrained Markdown in `reply` only;
the outer JSON contract and frozen evaluation prompt remain unchanged.

## Welcome speech

`POST /api/speech/welcome` accepts only the fixed variants `first-context-v1` and
`first-open-v1`. No arbitrary client text is accepted. It uses the existing speech
consent, hard paid-enable guard, MP3 provider, character/request quotas, explicit
retry boundary, expiration and per-account authorization. Cache hits do not bill
another synthesis. Pending/uncertain results do not automatically retry. Revoking
speech consent removes both welcome and reply audio caches.

Welcome audio uses `welcome_speech_audio`, an account-owned expiring cache without
a conversation dependency. Apply `20261026030000_welcome_speech.sql` before
deploying the API to PostgreSQL; it enables RLS and revokes direct client access.
Development SQLite creates the new table at startup without rewriting existing
messages or conversation tables. No private database was used for acceptance.

## Acceptance

TypeScript and all 388 frontend tests passed. The full API run passed 354 tests
with the optional PostgreSQL case skipped; the isolated PostgreSQL integration
case separately passed. After adding the welcome character-limit regression,
all 15 speech/welcome tests passed. Ruff and all five tool tests passed. The
formal build passed the bundled WeChat compilers (41 WXSS, 64 WXML), retaining
the existing 183,372-byte media package below its 204,800-byte limit.

The separate tourist project `Welcome Markdown Isolated QA` uses a disposable
SQLite API on port 8053, MockTransport and automation port 9485. Its native receipt
is `output/welcome-markdown-20261026/native-result.json`. The simulator is iPhone
12/13 (Pro), 390 by 844, WeChat SDK 3.17.4. Seven flows cover one-paragraph welcome,
no automatic calls/history, copying visible text, inline speech consent and native
MP3 play/pause/resume/rate/stop, ordinary Markdown rendering/copying/reading,
restart without a repeated introduction, and speaking before any conversation
exists after skipping onboarding. Clipboard capture uses a mock and leaves the
operating system clipboard unchanged. Native screenshots were visually checked.

Mock playback is the labelled local test tone, not synthesized Chinese speech.
Tencent formatting tests use MockTransport only. Paid service activation and
physical-device keyboard, audio output and gesture acceptance remain separate.
