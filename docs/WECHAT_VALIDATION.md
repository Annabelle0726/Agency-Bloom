# WeChat Mini Program acceptance record

Date: 2026-10-17, Windows, WeChat Developer Tools 2.02.2608080, base library configured locally as 3.17.4

**Status: the native stylesheet syntax failure is fixed. Actual WeChat simulator rendering and interaction were verified on iPhone 12/13 (Pro), 390 × 844, and iPhone 6/7/8, 375 × 667, using base library 3.17.4. Soft-keyboard occlusion and physical-device behavior remain unverified. H5 results are not counted as simulator evidence.**

## Confirmed findings and evidence

### 1. A WXSS syntax failure was missed by the uni-app build

The original npm run build:mp completed successfully. Running the installed WeChat stylesheet compiler against that exact generated app.wxss failed:

```text
wcsc.exe -lc -o output/wechat/before-app-compiled.css app.wxss
ERR: app.wxss(1:35442): unexpected token `*`
error file count: 0
exit code: 1
```

The offending reduced-motion rule was:

```css
.app-shell *, .app-shell *::before, .app-shell *::after {
  animation: none !important;
  transition: none !important;
  scroll-behavior: auto !important;
}
```

It was emitted into the native global stylesheet. A rejected app.wxss explains the missing global positioning, dimensions and typography described by the user. The before/after compiler result proves the syntax defect; it does not by itself prove every rendered screen is now correct.

Fix: replace universal selectors with explicit classes for the elements that animate. Preserve reduced-motion behavior and the existing design. No component isolation setting was changed.

After rebuilding, the same installed wcsc.exe accepts app.wxss. The final release contains six WXSS and seven WXML artifacts. The watched development directory also retains the formerly used EmptyState artifacts, so its compiler check covers seven WXSS and eight WXML. All references resolve; the unused development artifacts are absent from the clean release build.

### 2. Daily development and the opened project used different output trees

The tool's saved project metadata showed:

```text
projectpath:     C:\Projects\AgencyOS
miniprogramRoot: apps/miniprogram/dist/build/mp-weixin/
simulatorType:   wechat
```

The development watcher writes dist/dev/mp-weixin. Consequently, changes built only by dev:mp could not reach the release output selected by the existing project wrapper.

Fix: repository project.config.json now points to dist/dev/mp-weixin. Release opening uses dist/build/mp-weixin directly. The development watcher was run and an SCSS save caused an incremental compile successfully.

### 3. Component isolation was investigated, not globally disabled

OnboardingFlow has no local style block, so it does not generate a separate OnboardingFlow.wxss. Its layout classes are in app.wxss. ActionButton, SelectionCard, ProgressIndicator, EmptyState and SvgIcon have their own component WXSS.

The installed uni-app runtime's parseComponent defaults include addGlobalClass: true. This matches [uni-app's documented component options](https://uniapp.dcloud.net.cn/tutorial/vue3-api.html#其他配置). There is no confirmed evidence that changing every component to shared isolation is needed. No such global workaround was applied.

The authorized simulator now renders the component's global layout, typography, selection colors and backgrounds correctly. Native screenshots of the welcome, concern, focus, background, support, reflection and login screens confirm that app.wxss applies inside OnboardingFlow. No isolation change was necessary.

### 4. Assets exist in both compiled outputs

The generated common/assets.js points to /static/mountain-lake.jpg and /static/morning-light.jpg. Both files exist and are nonempty. Component and page JSON references resolve to generated JS, WXML and JSON files. Actual simulator screenshots additionally confirm the decoded mountain/lake welcome background and warm login/home background.

### 5. Native theme and header follow-up

The dark-theme simulator screenshot exposed black system-status text over the dark page. index.vue now synchronizes the native navigation/status foreground on page ready and theme changes using uni.setNavigationBarColor. The follow-up native screenshot shows white time, signal and battery text. Reference: [uni-app navigation-bar API](https://uniapp.dcloud.net.cn/api/ui/navigationbar.html#setnavigationbarcolor).

At the user's request, the Mini Program topbar margin was reduced from 44px to 32px, moving the navigation up 12px. A further spacing review reduced the bar height from 76px to 64px, workspace top padding from 27px to 12px, and title top margin from 8px to 0. The heading moves up another 35px without shrinking the 44px icon targets. These spacing changes are inside the MP-WEIXIN conditional block and do not alter H5 spacing.

Those measurements describe the intermediate compact header. The final dark home additionally uses the actual capsule bottom from uni.getMenuButtonBoundingClientRect to place its 44px navigation targets below the capsule, rather than assuming a fixed offset. Reference: [uni-app menu-button bounds](https://uniapp.dcloud.io/api/ui/menuButton.html).

## Commands and results

| Check | Result |
|---|---|
| npm run typecheck | Passed |
| npm run test:ui | 9 passed |
| npm run test:tools | 2 passed on Windows |
| npm run dev:mp | Initial and incremental compilation observed |
| npm run build:mp | Passed, including bundled native compiler checks |
| npm run check:mp | 6 WXSS and 7 WXML passed; references and assets checked |
| npm run check:mp:dev | 7 WXSS and 8 WXML passed; references and assets checked |
| npm run check:mp:watch | Passed; external SCSS edit and restoration both reached native app.wxss |
| Actual simulator Console / UI | Verified through installed WeChat integration and official miniprogram-automator SDK; see acceptance below |
| Physical device | Not run |
| H5 / Playwright as primary evidence | Not used for this repair |

The helper tests reproduce a second tooling defect: the installed CLI reports a disabled service port while exiting with code zero. The helper now treats that output as a failed open operation. Tests also cover invalid output-mode rejection.

Compiler evidence is generated under output/wechat/{dev,build}/artifacts.json and ignored by Git. simulatorVerified is deliberately false in these compiler-only reports.

## Actual simulator acceptance

The user manually enabled the service port and approved Codex access. The installed integration then reported loginExpired=false and matching skill version 0.3.11. The project was C:\Projects\AgencyOS with miniprogramRoot apps/miniprogram/dist/dev/mp-weixin/; actual base library was 3.17.4.

Windows window capture still timed out and accessibility exposed only generic panes. This did not prevent native simulator screenshots through simulator_screenshot or the official miniprogram-automator 0.13.0 SDK. Device selection was performed by the user. The official SDK was installed only under ignored output/native-sdk for this run; no application dependency was added.

The atomic selector tool did not traverse uni-app custom components. With the official SDK, query the escaped normalized component name, for example page.$('components\\/OnboardingFlow'), then query its ActionButton or SelectionCard host and the real button inside. Tests tapped those buttons rather than modifying Vue step data. Reconnect after a recompilation or device switch to avoid stale native element handles.

| Scenario | iPhone 12/13 (Pro), 390 × 844 | iPhone 6/7/8, 375 × 667 |
|---|---|---|
| Welcome: decoded mountain/lake background, title, start action | Passed | Passed |
| Concern multi-select and deselect | Passed | Passed; asserted stored choices after each toggle |
| Focus, optional background, support and fixed reflection | Passed | Passed |
| Back retains choices; three rapid taps do not skip focus | Passed | Full forward flow passed; rapid-tap case not repeated |
| Primary footer visible; status bar and capsule clear | Passed | Passed; login bottom reached by native page scrolling |
| Textarea accepts text | Not repeated | Passed |
| Soft keyboard leaves needed actions reachable | Not verified | Not verified; simulator reported keyboard height 0 after focus/input |
| Consent initially unchecked; disabled until consent | Passed | Passed |
| Login request loading animation under slow connection | Not timed | Not timed |
| Local demo login and home layout | Passed | Passed |
| Light default; anonymous onboarding has no theme control | Passed | Passed |
| Authenticated dark theme and session refresh | Passed | Theme setting exercised; final compact layout captured |
| Console error/warning scan | No matching lines | No matching lines |

The installed integration's get_simulator_console with grep -i error and grep -i warn returned empty strings after the run. Its compile_wxss tool also accepted app.wxss inside the IDE (two compiled outputs, total code length 81980 at that point). These observations are distinct from the earlier standalone compiler checks. Empty filtered logs do not establish correctness of every untested path.

The final Console error scan still returned no matching lines. The final warning scan contained the wx.getSystemInfoSync deprecation warning. The official automator SDK's systemInfo method calls that deprecated API; application source uses getWindowInfo/getMenuButtonBoundingClientRect instead. This warning is recorded rather than described as a clean warning log.

Screenshots are local ignored artifacts under output/wechat:

- 01-welcome-iphone.png through 10-dark-home-iphone.png: initial 390 × 844 flow and themes
- 11-dark-statusbar-fixed.png: white native status text after the fix
- narrow-01-welcome.png through narrow-09-home-up.png: asserted 375 × 667 flow, including scrolled login bottom
- native-textarea-input-375.png: native textarea input, without an onscreen soft keyboard
- home-compact-native.png: final compact home header

Some exploratory screenshots named 320 were taken while the user switched devices; their filenames are not used as viewport evidence. The accepted narrow run asserted 375px systemInfo before starting.

The test used synthetic answers and disposable local demo accounts. Original local draft/session values were backed up before the controlled run. No real WeChat authentication, DeepSeek call or Supabase connection was exercised. Real WeChat login, physical keyboard/press feel, and physical-device preview remain manual acceptance items. Physical preview needs an API reachable by the phone; the phone's own 127.0.0.1 cannot reach the PC backend.

## Quiet Night home redesign

The final design preserves the existing issue, decision card, feedback, chat and settings actions. Only presentation changes: separate greeting typography, a subdued night-blue/ink-teal atmosphere, warmer jade-white highlights, refined entry rows, and a floating native tabbar.

The user rejected a centered star that occupied its own row. The final NightCompass is a small jade ring/needle accessory, absolutely positioned at the upper right of the workspace. It has pointer-events:none, is hidden from accessibility, and consumes no document-flow height. The current issue is left aligned below the greeting. Three entry actions keep their existing handlers. Light onboarding and light home do not use the dark artwork.

Artwork is kept as editable SVG plus native raster assets: jade-compass.png is about 29 KB and night-water.jpg about 14 KB. Blur is baked into these images. Runtime animation uses only opacity and transform: a 280–360ms entry fade/6px rise, a six-second low-amplitude halo, and immediate native hover feedback. Reduced-motion rules disable the entry and halo animations. No backdrop-filter or animated blur is used.

375 × 667 native acceptance, final accessory/corner/icon layout:

- Screenshot and measurements: output/wechat/night-home-verified-375.png and .json
- Actual model: iPhone 6/7/8, base library 3.17.4
- Main card: top 324.69, height 237.74, bottom 562.43; native corner radius 8px
- Floating tabbar: top 596, height 59.33, bottom 655.33
- All three main actions are visible, with about 34px between the card bottom and tabbar top
- Native tabbar corner radius: 8px; icon frame 44 × 27, image 21 × 21. Frame offset (60.33, 604.77), image offset (71.83, 607.77): exactly 11.5px horizontal and 3px vertical inset
- First entry opens conversation; second opens the feedback sheet; third retains the existing exploration route when there is no selected next step
- Tab navigation back to home passes; native Console error and warning scans return no matching lines

The user switched the main simulator back to iPhone 12/13 (Pro), 390 × 844, with a 34px bottom safe area. Native inspection also returned 8px main-card/tabbar corner radii, 20 × 20 entry images and 21 × 21 tab images. Its first tab frame was at (62.77, 747.44), with the image at (74.27, 750.44), confirming the same centered insets. The user continued navigating and changing themes during captures; the stable final home screenshot above is from the controlled 375px SDK session. Do not reuse an older 390px screenshot as a final static design comparison. Subjective phone animation smoothness remains a physical-device check.

The final footer is recorded in output/wechat/night-home-bottom-375.png. The former stacked workspace/tabbar padding was reduced; the empty feedback state is now one compact 64px row. The end action remains above the navigation and reachable when scrolled to the bottom.

### Follow-up native rendering regression and repair

During this visual iteration, the SCSS source specified 8px corners and fixed image sizes, but incremental app.wxss still contained 24px corners and lacked home-entry-glyph/tab-glyph. New WXML images consequently used native default image dimensions, producing the large icons and narrow text reported by the user. This was an actual regression, not an accepted design state.

App.vue now references each global SCSS file directly through a style src block. The new verify-wechat-watch.mjs integration check proved both insertion and removal of an unused style rule reach app.wxss while the watcher stays running. It removes only its own probe if another editor changes the source during the check.

Native component hot reload also temporarily rendered the page template inside NightCompass, with undefined page style variables. After reopening the project, inspection showed the correct night-compass root and jade image. compileHotReLoad is now false in the repository project settings, manifest-generated settings and existing local private settings. No storage or component style-isolation setting was cleared. Normal watched compilation and reload are retained.

Entry arrows now have their own wrapper, so the former broad last-child transform cannot shift leading icons. Tab highlights are backgrounds on the icon's own centered frame, replacing the separately positioned moving highlight.

## Workflow

```powershell
# Terminal 1
npm run dev:api

# Terminal 2: keep the compiler watching
npm run dev:mp

# Once compiled, open development output through the installed CLI
npm run wechat:open

# Or combine the watch and first open
npm run dev:wechat

# One-time release build with native stylesheet/template checks when available
npm run build:mp
npm run wechat:open:build

# Require the native compiler gate explicitly
npm run check:mp
npm run check:mp:dev
```

See [English README](../README.md) and [中文说明](../README_zh.md) for installation, paths, refresh behavior and troubleshooting.
