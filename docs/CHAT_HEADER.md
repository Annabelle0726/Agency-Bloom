# Current conversation actions

The conversation title and chevron open a compact menu for that conversation.
The left navigation button still opens the conversation list. The redundant
ellipsis entry is removed. Existing response preference, reviewed-summary and
linked-exploration controls remain alongside rename, archive and delete.

Rename, archive and delete reuse the existing owned, versioned conversation
endpoints. No schema, AI call or background request was added. A separate
confirmation sheet captures the conversation identity and version; switching
windows cannot retarget a submitted operation. Blank names are rejected,
duplicate submissions are blocked, and failed requests retain the name input.
Deletion is applied locally only after the server succeeds, using the existing
window/draft cleanup and next-conversation selection.

The header follows `DESIGN.md`: a transparent resting title, a theme-colored
pressed/open state, 8px button corners and 10px menu corners. It has no filled
default button background or persistent animation. Chevron rotation and press
feedback take 130ms and honor reduced motion. Home and chat use the same 44px
navigation controls, horizontal inset and capsule-relative top edge.

## Verification

`tests/conversation-action.test.ts` covers versioned requests, duplicate-submit
protection, invalid names, conflict preservation and action routing.

`tools/verify-chat-header-native.cjs` uses only the disposable Mock API and copied
tourist project on port 9438. It measures the home/chat navigation geometry in
light and dark themes and exercises the title menu, outside dismissal, rename
and restart, cancel deletion, archive and confirmed deletion. It checks that
another conversation and the exploration survive, and that model calls stay at
zero. Screenshots and the measured report are saved under `output/header-actions/`.

Acceptance on 2026-10-20: the 390x844 simulator flow passed three consecutive
runs in light and dark themes. Both navigation buttons measured 44x44 at
left=18, top=90 in each theme. No provider calls were made. The working-tree
frontend suite passed 88 tests, type checking passed, and the normal WeChat
build passed 13 WXSS and 40 WXML compiler checks. Visual self-review used
`light-home.png`, `light-menu.png` and `dark-menu.png`; no independent visual
review was performed. Device-specific font scaling and touch feel remain
real-device checks.

Build with `VITE_API_BASE_URL=http://127.0.0.1:8018/api`, run the helper with
`--prepare`, open that copied project with the Developer Tools automation CLI,
then run the helper without arguments. Restore the normal Mini Program build
after verification. These tests never use the private application database.
