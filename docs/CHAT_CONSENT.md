# AI consent and composer interaction

The AI consent sheet removes the underlying native composer while any modal is
open, preserving its draft in the existing conversation session. Opening AI
consent also dismisses the keyboard. Native textareas must not remain in the
hit-test area underneath modal actions. Consent actions now use ModalShell's
footer slot, outside its scrolling disclosure. Saving shows a loading label and
disables both choices until completion. The existing version of the consent
API, separate explicit authorization, error display and continuation are kept.

Baseline investigation: an isolated synthetic account could save consent and
continue sending through a directly triggered button event. The baseline still
kept a native textarea mounted under the modal. The regression helper fails on
that overlapping native control. The user's original physical tap failure has
not been reproduced on a real phone; the fix removes that interaction hazard
and moves the action out of the scroll gesture area.

Both composer SVGs use 19px dimensions. Explicit zero font size and line height
on the icon-only buttons remove the native custom-component host's baseline
space. Before this change the web icon center measured about 1.4px below the
button center. Afterward both axes align within one simulator pixel in short
and multiline layouts and after a response completes. Button sizes retain the
existing separate web/send styles.

## Verification

Run `tools/verify-chat-consent-native.cjs` with the isolated Mock API on port
8018 and the tourist project on automation port 9438. The script verifies draft
preservation after declining, an injected consent-save failure, explicit retry,
exactly one generation after consent, persisted consent after relaunch, another
send, and both SVG sizes/centers. It never uses the application's private DB.
The failure fixture exists only in the disposable Mock service.

Type checking and 104 frontend tests passed. WeChat compilation passed 14 WXSS
and 40 WXML checks; the existing Sass legacy-API warnings remain. Simulator
screenshots/reports are under `output/chat-consent/`. Real-device keyboard and
physical hit testing remain to be checked.

At a 390 x 844 simulator viewport, the full native acceptance flow passed
three verified runs, including two
consecutive repeat runs captured in `output/chat-consent/repeat-check.log`.
Each run made two Mock generations and zero paid requests. The normal
application build was restored after isolated QA.
