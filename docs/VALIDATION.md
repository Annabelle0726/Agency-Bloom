# 本地验收记录

微信小程序修复与原生编译器检查见 [WeChat acceptance record](WECHAT_VALIDATION.md)。下文的浏览器检查仅为 H5 辅助验收，不代表微信模拟器或真机通过。

## 2026-10-17 UI 与交互复查

这次调整了引导、登录、首页、对话、设置与弹层的排版，导航和状态图标全部使用内嵌 SVG，移除界面句号，保留用户输入的标点。

- `vue-tsc`、9 项前端测试、Ruff、微信小程序和 H5 预览编译通过。
- 本地后端 18 项测试通过；PostgreSQL 集成测试本轮未启动容器，1 项跳过。后端只调整了返回给界面的提示文案。
- `tools/verify-interactions.playwright.js` 先复现「每步重建进度条」，修复后通过：进度节点保留、按钮纵向位置固定、连续双击不跳步、320 × 640 主按钮始终可见、滚动后切换步骤复位。
- `tools/verify-onboarding.playwright.js` 通过：草稿恢复、匿名浏览、协议未预勾选、直接进入登录、窄屏、大字号，以及登录前没有 POST 上传。
- `tools/verify-polish.playwright.js` 使用临时本地体验账号，通过完整引导、登录、首页、聊天输入区位置、主题切换、390 × 844 与 320 × 640、SVG 加载与减少动态效果检查；执行后删除测试账号。独立上下文未发现 JavaScript 异常。

本轮截图在被 Git 忽略的 `output/playwright/polish-*.png`，已检查启动、选项、登录、首页、对话、深色主题和主题面板。浏览器是同一套 uni-app 源码的本地验收入口，不是另行开发的网页产品。微信真机触感、键盘与 SVG 渲染仍需实际手机验收。

```powershell
npx --offline --yes --package @playwright/cli playwright-cli -s=polish open http://127.0.0.1:5173/
npx --offline --yes --package @playwright/cli playwright-cli -s=polish run-code --filename=tools/verify-interactions.playwright.js
npx --offline --yes --package @playwright/cli playwright-cli -s=polish run-code --filename=tools/verify-onboarding.playwright.js
npx --offline --yes --package @playwright/cli playwright-cli -s=polish run-code --filename=tools/verify-polish.playwright.js
```

## 2026-10-16 Alpha 初次验收

2026-10-16，Windows，Node.js 24、Python 3.13。实际检查的提交以本文件所在工作树为准。

## 自动检查

| 检查 | 结果 |
|---|---|
| 后端 API / 隐私 / 取消 / 模型适配 / 引导 / 同意记录测试 | 18 通过 |
| PostgreSQL 16 临时容器集成测试 | 1 通过，测试后容器已删除 |
| 前端领域逻辑 / 匿名草稿恢复 / 请求取消 / 错误处理 | 9 通过 |
| TypeScript `vue-tsc` | 通过 |
| Python Ruff | 通过 |
| 微信小程序 release 编译 | 通过 |
| H5 本地预览 release 编译 | 通过 |

默认 `npm run test:api` 不创建数据库容器，因此显示 18 通过、1 跳过。开启临时 PostgreSQL 时 19 项全部通过，包括按顺序应用两份迁移与同意记录权限检查。PostgreSQL 用例通过 `AGENCY_TEST_POSTGRES_URL` 显式启用，只接受本机且名为 `agency_verify` 的一次性数据库，不能指向用户的 Supabase 项目。CI 已配置临时 PostgreSQL 服务，但远程 CI 尚未运行。

测试覆盖：跨用户资源访问拒绝、单个当前问题、版本冲突、AI 单独同意、AI 草稿不改写确认卡片、可选聊天保留/清除、删除账号级联清理、微信身份复用（模拟上游）、预算阻断、重复请求、失败预留、取消/撤回/结束/删除时丢弃在途回复。PostgreSQL 实测业务表启用 RLS，并拒绝三个 Data API 角色的直接表权限。

## 浏览器人工验收

使用 Playwright CLI，390 × 844 手机尺寸，调用本地真实 FastAPI 和 SQLite。按参考图重做后已操作：困扰多选、说不清互斥、自述输入、确定重点、生活背景多选与跳过、支持方式、固定整理、匿名浏览、未勾选协议时禁用登录、同意后创建体验账号。

实际刷新验证了草稿步骤、两项生活背景与自述文字恢复。登录后测试记录想法、AI 单独授权、固定示例对话、编辑确认建议、刷新恢复下一步、主题切换与刷新恢复、修改支持偏好和退出。320 × 740 的首页与自述引导均无横向溢出。API 重启时产生过一次预期连接失败，重连后流程通过；未发现 JavaScript 运行异常。

已修复引导步骤动态数字 key 与 Vue 自动分支 key 冲突的问题，避免直接从初步整理进入登录时复用旧页面。`tools/verify-onboarding.playwright.js` 使用独立浏览器上下文，覆盖直接登录、匿名预览后登录、草稿恢复、未预勾选同意、窄屏与放大文字，并断言登录前不产生 POST 上传。运行时先启动本地前后端，再执行：

```powershell
npx --yes --package @playwright/cli playwright-cli -s=verify open http://127.0.0.1:5173/
npx --yes --package @playwright/cli playwright-cli -s=verify run-code --filename=tools/verify-onboarding.playwright.js
```

深色主题已实际切换并检查截图。当前截图为被 Git 忽略的 `output/playwright/alpha-*.png`；无 alpha 前缀的截图来自已替换的早期设计。这里的浏览器验收不是微信真机验收。真实微信登录、真实 DeepSeek 调用、远程 Supabase 连接均尚未验证。

## 编译依赖与发布限制

uni-app 使用官方稳定系列 `3.0.0-5020620260917001`，其 Vite peer 固定为 `5.2.8`、Vue 生态部分依赖固定在旧版本。当前 `npm audit` 结果：0 critical、25 high、16 moderate、3 low。主要来自 Vite 开发服务、旧的 i18n / SSR、压缩和图像处理等编译链传递依赖；风险仍需逐项处理，不能把全部告警当作无关问题。

已升级 Vitest 至 4.1.11，移除原测试链中的 critical 告警，并覆盖修复 Babel、PostCSS、source-map-js、ws。没有使用 `npm audit fix --force` 强行替换 uni-app 编译器。原始审计报告在 `output/dependency-audit.json`，可以执行 `npm --prefix apps/miniprogram audit` 更新。

当前开发服务只监听 127.0.0.1。正式公开发布前，需要升级到经过兼容性验证的修复依赖组合；不要直接把 Vite 开发服务部署到公网，也不要用当前编译链处理不可信压缩包、图片或模板。

构建仍提示 Sass legacy API 弃用。前端 AppID 已从本机新增的微信开发者工具项目配置同步，没有开启 uniStatistics。根目录入口指向编译产物；仅本机私有配置关闭域名校验，供 localhost 调试。已添加微信键盘高度处理和状态栏、安全区域间距，但真实登录、合法域名、真机键盘、系统大字号和安全区域表现需在微信开发者工具与手机上继续验收。
