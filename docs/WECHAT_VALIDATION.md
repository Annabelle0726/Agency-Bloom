# WeChat Mini Program acceptance record

Date: 2026-10-17, Windows, WeChat Developer Tools 2.02.2608080, base library configured locally as 3.17.4

**Status: the native stylesheet syntax failure is fixed and the bundled WXML/WXSS compilers pass. Simulator UI acceptance is pending local tool authorization. H5 results are not counted as simulator evidence.**

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

After rebuilding, the same installed wcsc.exe accepts app.wxss. The new checker also compiles all six WXSS and all seven WXML artifacts in both development and release output.

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

The component's actual computed variables and styles still need to be read in a simulator session after authorization.

### 4. Assets exist in both compiled outputs

The generated common/assets.js points to /static/mountain-lake.jpg and /static/morning-light.jpg. Both files exist and are nonempty. Component and page JSON references resolve to generated JS, WXML and JSON files. This confirms packaging; actual image decoding and rendered bounds remain simulator checks.

## Commands and results

| Check | Result |
|---|---|
| npm run typecheck | Passed |
| npm run test:ui | 9 passed |
| npm run test:tools | 2 passed on Windows |
| npm run dev:mp | Initial and incremental compilation observed |
| npm run build:mp | Passed, including bundled native compiler checks |
| npm run check:mp | 6 WXSS and 7 WXML passed; references and assets checked |
| npm run check:mp:dev | 6 WXSS and 7 WXML passed; references and assets checked |
| Actual simulator Console / UI | Pending tool authorization |
| Physical device | Not run |
| H5 / Playwright as primary evidence | Not used for this repair |

The helper tests reproduce a second tooling defect: the installed CLI reports a disabled service port while exiting with code zero. The helper now treats that output as a failed open operation. Tests also cover invalid output-mode rejection.

Compiler evidence is generated under output/wechat/{dev,build}/artifacts.json and ignored by Git. simulatorVerified is deliberately false in these compiler-only reports.

## Tool access limitations observed

- Windows window discovery found the AgencyOS Developer Tools window.
- Window screenshot capture failed with FrameArrived timed out and window capture timed out. Accessibility exposed only generic panes.
- The traditional cli.bat open command reported IDE service port disabled. It was not enabled by any script.
- The installed wechatide integration initiated Codex client authorization and returned Waiting for user authorization. A pending authorization is not a successful connection.
- No simulator Console log was obtained. Do not interpret this as zero Console errors.

## Required simulator acceptance

Use the developer-tools project whose actual root is dist/dev/mp-weixin. Run the local API separately. Importing the output directly uses its own private settings; check localhost request-domain configuration there. The source-root wrapper retains its own private settings.

| Scenario | iPhone 12/13, 390 × 844 | Narrow viewport, 320 × 640 |
|---|---|---|
| Welcome: mountain/lake image, title, start action | Pending | Pending |
| Concern multi-select and deselect | Pending | Pending |
| Focus, optional background, support and reflection | Pending | Pending |
| Back preserves choices, fast double tap does not skip | Pending | Pending |
| Primary footer visible; status bar/capsule clear | Pending | Pending |
| Self-description keyboard does not hide needed controls | Pending | Pending |
| Consent initially unchecked; loading/disabled states | Pending | Pending |
| Local demo login and home layout | Pending | Pending |
| Default theme; no anonymous theme switch | Pending | Pending |
| Authenticated theme switching and refresh | Pending | Pending |
| Console runtime, WXSS and asset errors | Pending | Pending |

For a controlled run, use synthetic answers and a disposable local demo account. Do not delete an existing user's records to reset the flow.

After each native run, record the loaded project directory, simulator model, base-library version, exact Console errors or absence of errors, screenshots and failed steps. A successful command or compiler result alone must not mark these rows as passed.

Physical preview additionally needs an accessible API endpoint and a person operating the phone. Do not use the phone's own 127.0.0.1 for the PC backend.

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
