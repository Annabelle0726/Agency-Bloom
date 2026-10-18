# Agency Bloom

[English](README.md)

Agency Bloom — Your Life. Your Direction. Your Agency.

给自己一点空间，理清此刻的处境，找到愿意尝试的下一步

微信小程序 Alpha 使用 Vue 3、TypeScript、uni-app 与 Python/FastAPI，一次跟进一个当前问题，由用户确认决策卡内容。**微信开发者工具是真实 UI 的主要验收环境，H5 仅作本地辅助测试**

## 安装与后端

需要 Node.js 22+、npm、uv，以及微信开发者工具。在 PowerShell 中执行：

```powershell
cd C:\Projects\Agency-Bloom
npm ci
npm --prefix apps/miniprogram ci
uv sync --directory apps/api --frozen
# 仅在文件不存在时创建，不覆盖已有凭证
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
```

单独启动后端：

```powershell
npm run dev:api
```

默认后端为 http://127.0.0.1:8000，接口文档位于 /docs。本地开发登录与 AI 模式相互独立，SQLite 和开发登录也能使用真实 DeepSeek；新拉取仓库的安全默认值仍是 demo，需要主动配置。真实微信登录需要配置后端 AppID/AppSecret，详见[接入说明](docs/SETUP.md)

日常开发请保留两个终端：第一个运行 `npm run dev:api`，第二个运行 `npm run dev:wechat`。`dev:mp`、`dev:wechat` 与 `build:mp` 只编译前端，不会启动后端；`dev:wechat` 现在会在监听之前检查本地服务并提示启动方式。首次连接失败后，进入登录页或重新回到小程序会重新检查，失败时仍可重试且不丢失本机草稿。微信登录缺少凭据会明确显示“待接入”，与网络失败分开；开启开发登录的环境仍可使用明确标注的开发入口。协议默认不勾选，并放在登录按钮之前。

## 真实 DeepSeek 对话

在被 Git 忽略的 apps/api/.env 中配置，保留已有数据库地址和预算。密钥仅放后端环境文件，不能放入前端 VITE_ 变量：

```ini
AGENCY_AI_MODE=deepseek
AGENCY_DEEPSEEK_MODEL=deepseek-flash
AGENCY_DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENCY_DEEPSEEK_API_KEY=YOUR_KEY
AGENCY_MAX_OUTPUT_TOKENS=768
```

修改环境后重启 dev:api，访问 http://127.0.0.1:8000/api/config，确认 ai_mode=deepseek。后端明确关闭思考和流式输出，采用 JSON 协议；调用失败不会回退为演示回复。输出 tokens 是上限，不要求写满，日常交流保持简短，职业比较可适当展开

本机已经切换到真实模型，2026-10-17 唯一一次付费验证成功，使用 680 输入、60 输出 tokens，按官方人民币费率估算 ¥0.000920，详见[证据与限制](docs/DEEPSEEK_VALIDATION.md)。可执行仅查询凭证、模型与人民币账户状态的检查：

```powershell
uv run --directory apps/api python ../../tools/verify-deepseek.py
```

工具的 --live-once 选项会在发起一次真实生成前写入持久标记。本工作区已经执行过，不要删除标记或再次进行付费验证；自动化测试全部使用 MockTransport

普通交流允许 suggestion=null；有价值的职业建议才出现草稿，用户审阅确认后才更新卡片。上下文只包含当前卡片/问题、支持偏好、最多五条最近反馈与八条最近消息，完整聊天默认不永久保存。额度按高峰未缓存价格预留，成功后依据回执结算；费用不确定的失败保留预留，历史已用量不重置

对话加入原创的小芽形象与用户默认头像。「我的」中可主动选择微信头像或恢复默认；所选头像按账号保存在当前设备，不发送给模型。保留 SVG 源文件，小程序使用随包 PNG 保证显示稳定。真实微信头像选择面板和真机软键盘仍需手动验收

## 微信小程序日常开发

```powershell
npm run dev:mp
```

该命令持续监听代码，将变更写入：

```text
C:\Projects\Agency-Bloom\apps\miniprogram\dist\dev\mp-weixin
```

第一次在微信开发者工具导入该目录即可，目录中有编译器生成的 project.config.json。也可以导入仓库根目录 C:\Projects\AgencyOS，根配置的 miniprogramRoot 同样指向开发产物；在「详情」中核对实际小程序根目录

之后修改 apps/miniprogram/src 下的源码并保存，保持监听终端运行，产物中的 WXML、WXSS、JS 和资源会自动更新。开发者工具通常会自动重新编译；未更新时点击一次「编译」。不要手动修改产物，也不需要复制文件或重复导入

希望首次编译完成后自动打开开发者工具，可以改用：

```powershell
npm run dev:wechat
```

默认 CLI 路径为 C:\Software\Tencent\微信web开发者工具\cli.bat。安装位置不同时设置：

```powershell
$env:WECHAT_DEVTOOLS_CLI = 'D:\Apps\WeChatDevTools\cli.bat'
npm run dev:wechat
```

CLI 集成需要开发者工具服务端口。如果选择使用，请自己在「设置 → 安全设置 → 服务端口」开启；辅助脚本不会开启这个设置。服务端口关闭时，源码监听继续运行，可以手动导入上面的产物目录

单独打开已经生成的开发产物：

```powershell
npm run wechat:open
```

## 正式构建

```powershell
npm run build:mp
npm run wechat:open:build
```

正式产物位于 C:\Projects\Agency-Bloom\apps\miniprogram\dist\build\mp-weixin，也可以手动导入该目录。正式构建执行一次就结束，不监听代码；建议作为独立项目打开，与日常开发区分

本机存在微信 WXML/WXSS 编译器时，build:mp 会继续检查生成产物，捕获 uni-app 构建可能漏掉的原生样式语法错误。没有安装开发者工具的机器会明确跳过这一步；npm run check:mp 强制检查正式产物，npm run check:mp:dev 检查开发产物。工具安装目录不同时设置 WECHAT_DEVTOOLS_HOME。编译器检查仍不能替代模拟器验收

| 目录 | 含义 |
|---|---|
| C:\Projects\Agency-Bloom | 源码仓库，也可作为开发项目入口 |
| apps/miniprogram/dist/dev/mp-weixin | 监听模式输出 |
| apps/miniprogram/dist/build/mp-weixin | 正式构建输出 |
| C:\Software\Tencent\微信web开发者工具 | 工具安装目录与 CLI，不能作为应用产物目录 |

直接导入产物目录时，使用该目录自己的私有配置，不会继承仓库根目录的 project.private.config.json。连接本机 API 时，检查当前项目的 request 域名校验设置；私有配置不提交 Git。真实手机的 127.0.0.1 指向手机自己，需要配置可访问的 API 地址；发布时需要 HTTPS 与微信合法域名

## H5 辅助预览

```powershell
npm run dev
```

打开 http://127.0.0.1:5173。H5 可快速检查逻辑，但 H5 或 Playwright 通过不能证明微信组件样式、WXSS、胶囊、键盘和安全区域正确

## 原生验收与异常排查

1. 核对开发者工具当前项目及 miniprogramRoot，与刚编译的 dev/build 目录保持一致，不能把安装目录或 src 当作编译产物
2. 查看 Console 的 JS、WXSS、组件、图片和请求错误，uni-app 编译成功不等于模拟器运行成功
3. 检查组件 JSON/JS 的隔离选项和组件 WXSS，不凭 H5 或全局 app.wxss 推断原生样式边界，不批量关闭组件隔离
4. 检查欢迎图片的实际 src、加载状态和尺寸，图片打包路径为 /static/mountain-lake.jpg；分别检查文件、父容器高度、定位和样式
5. 检查组件内部的计算尺寸和 CSS 变量，特别留意选择器限制、跨组件变量继承及自定义组件宿主节点
6. 至少使用 iPhone 12/13 尺寸及一个较窄屏幕，走完欢迎、五步引导、整理、登录、首页、主题切换，检查状态栏/胶囊、底部按钮、键盘和快速连点
7. 修改未生效时先检查监听进程与 dist/dev 目录，再点击一次编译，不要反复清空用户数据

参见[微信原生验收证据](docs/WECHAT_VALIDATION.md)，记录会区分模拟器实测、静态产物检查、H5 辅助测试和未验证的真机表现

App.vue 直接引用各个全局 SCSS 样式源，避免原先嵌套 @use 导致增量编译继续输出旧 WXSS。保持 dev:mp 运行后，可用 npm run check:mp:watch 自动验证外部样式修改能进入原生产物；该检查会添加一条未被界面使用的临时规则，验证后恢复源文件并确认规则移除。已关闭组件热重载 compileHotReLoad，代码监听、正常编译与模拟器重新加载仍保留，避免结构变化后原生组件继续使用旧模板

2026-10-17 的修复已在真实微信模拟器 iPhone 12/13（390 × 844）与 iPhone 6/7/8（375 × 667）中验证引导、本地演示登录、首页与主题。真机软键盘遮挡和真实微信登录仍需手动验收。切换机型或重新编译后，自动化需重新连接，以免使用失效的组件句柄

深夜首页使用保留 SVG 源文件的本地图片、绝对定位的玉环配件、6–8px 界面圆角、轻淡入与光晕呼吸动效，以及悬浮底部导航，主要样式位于 night-home.scss 与 NightCompass.vue。不同尺寸的新版验收结果单独记录，旧版截图不能视为新版设计已通过验证

## 检查命令

探索版本将初始化、登录、已登录数据和 AI 错误分开，匿名引导只在本机运行，后端断开仍能完成。方向、已有经历的新用途、选择比较、谨慎改变、新可能分别对应可测试的固定问题分支；多选后只选一条当前主线，其他关注点保留为可编辑背景。问题标题允许为空，探索意图、用户问题、分支回答和可选标题分别保存，七天有效的 v2 草稿兼容迁移为 v3

当前帮助偏好为 Listen、Discover、Compare、Experiment，旧 clarify 映射到 discover、act 映射到 experiment，不改写旧账户。对话中和「我的」中都可切换。可选 Insight 需要至少两条不同的用户原话作为依据，后端找不到依据时只保留普通回复。该检查验证引用来源，不等于证明职业适配性或推理一定正确

Insight 三个操作各有真实行为：有意思会带入可编辑的追问；不太像我会略过，并仅在当前会话携带有限的拒绝反馈；让我试一下会打开小实验审阅。实验包含行动、验证问题、投入上限和停止条件，明确确认后才更新既有卡片的下一步，不自动追加模型调用。Insight 草稿和反应不会作为长期事实恢复

本轮**没有新增付费模型请求**。Mock 测试、微信模拟器证据与待手动项目见[探索版本验收记录](docs/EXPLORATION_VALIDATION.md)。新增探索字段迁移尚未应用至远程 Supabase，不要重置已有数据库或额度账本

```powershell
npm run typecheck
npm run test:ui
npm run test:tools
npm run build:mp
npm run check:mp:dev
npm run test:api
npm run lint:api
```

可选 PostgreSQL 测试需要一次性本地数据库，不连接用户的 Supabase 项目，详见[验收记录](docs/VALIDATION.md)

## Alpha 已有功能

- 匿名多选困扰、确认重点、可跳过的生活背景、支持偏好与固定规则初步整理
- 本机草稿保留 7 天，登录后保存到后端
- 一次跟进一个问题，决策卡区分确认信息、推测、待核实项与用户选择的下一步
- AI 单独授权，建议经用户确认后才进入卡片
- 可选完整聊天保存、停止回复、反馈、历史记录、账号删除与用量限制
- 默认 Morning Mist，登录后在「我的 → 外观设置」切换 Quiet Night

真实 DeepSeek 生成与微信原生聊天显示已验证。Supabase PostgreSQL 迁移已准备，包含新增的用量回执列；远程迁移与真实微信登录仍需分别接入验收

## 代码结构

```text
apps/miniprogram/       Vue 3 + TypeScript + uni-app
  src/components/      引导、按钮、选项卡、进度与图标
  src/pages/index/     当前问题、对话、设置和登录
  src/onboarding.ts    草稿恢复与固定整理规则
  src/static/          随包图片与图标
apps/api/              FastAPI、持久化、身份验证与模型适配
supabase/migrations/   PostgreSQL 表结构、RLS 与权限
tools/                 本地开发与验收辅助脚本
docs/                  产品、设计、接入和验收记录
```

环境文件、数据库、依赖、编译产物、私有开发者工具配置和截图均被 Git 忽略。模型密钥、微信 AppSecret、Supabase secret 与数据库密码仅存放后端。根目录原有的 Lib/、Scripts/ 虚拟环境文件保留并忽略

其他说明：[产品约定](docs/PRODUCT.md)、[设计说明](docs/DESIGN.md)、[接入说明](docs/SETUP.md)
