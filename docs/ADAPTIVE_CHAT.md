# Adaptive chat and responsive composer

Updated 2026-10-24. Policy version: adaptive-v1.

## Why ordinary replies were slow

The previous chat path enabled provider thinking on every turn. Casual turns
requested low effort, which still required thinking before visible answer text.
The configured local model was Pro. Streaming already existed, but could not
display an answer before the provider started producing visible content.
This is a code/configuration finding, not a paid latency benchmark. Network,
provider queueing, prompt size and requested output can still affect latency.

Official API contracts checked on 2026-10-24:

- [Models and CNY rates](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)
- [Thinking toggle and effort](https://api-docs.deepseek.com/guides/thinking_mode/)

Model and thinking must be selected before dispatch. There is no documented
mid-response switch from Flash to Pro. A classifier model call would add another
request and another wait, so this version uses a deterministic local policy.

## Routing contract

`AGENCY_AI_ROUTING=adaptive` is the chat default:

- Ordinary conversation, listening, simple explanations and brief answers use
  `deepseek-flash` with `thinking.type=disabled` and no reasoning-effort field.
- Explicit analysis, comparisons, tradeoffs, consequential resignation questions
  and explicit crisis signals use `deepseek-v4-pro` with thinking enabled.
- Short reference followups such as `继续` inherit the last substantive user
  request from at most eight supplied same-conversation history messages.
  Greetings, acknowledgments and a new concrete question do not inherit it.
- A request for a brief answer takes priority except for explicit crisis signals.
  Length alone does not label a person or decide that a message needs Pro.
- This heuristic can misclassify paraphrases. It is reviewable and replaceable;
  it does not claim semantic model judgment or guaranteed response times.
- Summary and other explicit generation tasks retain the configured model.
  Frozen evaluation runs bypass adaptive routing and keep their reviewed payload.

`AGENCY_AI_ROUTING=fixed` keeps `AGENCY_DEEPSEEK_MODEL` and `AGENCY_AI_THINKING`
behavior. `AGENCY_AI_THINKING=false` also disables depth in adaptive chat.

The selected model, thinking flag and rate card live in a private request copy.
Selection happens before budget reservation. Dispatch, token validation and
settlement use that same copy. The global CNY 100 AI cap, daily limit, timeout,
4096-token ceiling, retained spend and uncertain reservations are unchanged.
There are no classifier calls, automatic escalation, fallback requests or retries.

Receipts and safe timing logs identify the requested model, thinking mode,
time to visible reply when streaming, and total generation time. Raw reasoning
is never accumulated, disclosed, saved or logged. The UI only says it is thinking
after receiving the corresponding provider signal.

## Composer and scroll behavior

The native textarea remains mounted while generating, with a short placeholder
and a disabled input. Only the pending bubble displays the submitted text. The
send key becomes a stop key in the same position, with the same 19px icon size
as the web toggle. A compact status line shows elapsed time and a slow-response
note after 15 seconds. Stop/failure restores the original draft; completion
clears only the submitted draft. Duplicate submissions remain blocked.

The composer reports its rendered height, including inline errors, quotations,
speech disclosure and multiline text. The transcript spacer uses that height
plus the current keyboard offset instead of fixed per-notice guesses. The
return-to-latest button uses the same measured boundary. The previous 104px
chat-content clearance and the shell's extra safe-area padding are removed;
the final message has no trailing row margin and keeps only 16px of reading
space above the measured dock. Resize follows new
content only while following is enabled. Upward movement is cumulative, so slow
scrolling can pause following; the explicit return action resumes it.

The visual direction remains quiet and theme-aware. Existing press feedback and
reduced-motion-aware waiting dots are reused; no new entrance animation or large
status card is introduced. Exceptions retain the composer-adjacent behavior and
are cleared only after verified recovery.

## Verification and remaining limits

MockTransport tests cover one-call routing, selected-model reservations and
settlement, short followups, topic changes, explicit brevity, the fixed override,
thinking-off switch, summaries, exhausted budgets, streaming privacy and failure
recovery. Vue custom-renderer tests exercise the actual composer, stop handler,
preserved textarea and measured height. No test uses a paid provider or private
database.

Native acceptance uses the existing isolated Mock API (8018), copied tourist
project and automation port 9438. The installed Developer Tools currently
returns no SDKVersion from Tool.getInfo. A Windows screenshot recovery also
timed out. Native compiler acceptance is separate from simulator interaction;
keyboard, safe-area behavior and physical-device interaction remain unverified.
Auxiliary H5 captures at 390x844 cover light/dark overflowing replies and the
pending composer. The large trailing gap is removed, the textarea remains
visible, and submitted text appears once while waiting. Screenshot checks found
no console errors, horizontal overflow or failed images. These captures are
auxiliary evidence only. Task-local reports live under ignored
`output/adaptive-chat/`.

Final checks: 294 backend tests passed with one skipped, 214 frontend tests
passed (two workers to avoid filesystem-test contention), five tooling tests
passed, TypeScript and Ruff passed, and the WeChat build passed the bundled
23-WXSS/50-WXML compiler and asset-reference checks. Sass emitted existing
legacy-JS-API deprecation warnings. No paid model/TTS request was made.
