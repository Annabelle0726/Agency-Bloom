# Mini Program index page

`index.vue` is the page entry. It imports the presentation components below and calls
`useIndexPage()` for page state and actions; feature markup lives in separate SFCs.

- `useIndexPage.ts` — page controller: session, workspace, theme, navigation, and action wiring
- `views/` — top bar, tab bar, home, plan, discover, settings, empty dashboard, and entry status
- `ChatView.vue` and `chat/` — chat header, welcome, mode picker, messages, pending state, cards, and composer
- `modals/` — shared `ModalShell` and each dialog
- `data.ts` — presentation constants shared by the page and its components

`ChatComposer` stays a sibling of `ChatView` in `index.vue` so the fixed composer layout and the
original `v-if` / `v-else-if` chain remain unchanged.

Page-local components declare `styleIsolation: 'apply-shared'` so the global theme SCSS in
`App.vue` continues to style them.
