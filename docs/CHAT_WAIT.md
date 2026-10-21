# Chat request waiting state

The submitted text is shown once, in the conversation. While a generation is
pending, a compact bottom status surface replaces the native textarea and its
web/send controls. The draft remains in that conversation's in-memory session;
stopping or failing restores the editable original, while success clears it
through the existing send flow. Nothing is automatically retried or persisted.

The status surface shows elapsed wall time (not a completion percentage) and an
explicit Stop button. After 15 seconds it acknowledges the longer wait without
claiming that the provider is progressing. The timestamp belongs to the request
session, so switching conversations does not restart the clock. Component timers
are cleaned up on stop/unmount. The summary action has its own status label.

The quiet theme surface uses existing paper, line, ink and muted colors, a 10px
container and an 8px button. Three small opacity dots are the only new animation;
reduced-motion users receive static dots. The duplicated transcript thinking row
and unrelated footer copy are omitted during the wait. New conversations hide
starter suggestions once sending begins. Sending dismisses the keyboard and
brings the pending message into view without animated scrolling.

This is a local UI state fix. The provider still returns one validated complete
response (stream=false); no model settings, API contracts, extra requests or
billing behavior were changed. Actual provider latency is not measured by Mock
acceptance and is not claimed to have improved.

## Verification

Use the disposable API in `tools/mock-conversations-api.py`, build with
`VITE_API_BASE_URL=http://127.0.0.1:8018/api`, and prepare/open the copied tourist
project as described in `tools/verify-conversations-native.cjs`. Then run
`node tools/verify-chat-wait-native.cjs` (or add `--light`). The script refuses
other API/project targets. A controlled 20-second response exercises the long
wait; cancellation, empty-output failure, a subsequent successful send, and
retained database message counts are also checked. Screenshots and reports are
written to `output/chat-wait/`. Restore the normal Mini Program build afterward.

Acceptance on 2026-10-21: type checking and all 104 frontend tests passed. The
normal WeChat build passed 14 WXSS and 40 WXML checks (existing Sass legacy API
warnings remain). Native simulator acceptance at 390x844 passed three consecutive
runs across dark/light themes; the waiting surface measured 358x69.3px. Each run
made four isolated Mock calls and zero paid provider calls. Local screenshot
self-review confirmed the compact wait surface and removal of duplicate input;
no independent visual review was performed. Real-device keyboard behavior and
large accessibility font sizes remain unverified.
