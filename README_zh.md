# Agency Bloom

<p align="center">
  <img src="./assets/readme/hero.png" width="100%" alt="Agency Bloom —— 帮你理清处境、比较选择、选一个可承受的小尝试的微信小程序；决策卡始终由你确认。">
</p>

<p align="center">
  <a href="README.md">English</a>&nbsp;&nbsp;·&nbsp;&nbsp;
  <em>Your Life. Your Direction. Your Agency.</em>
</p>

**Agency Bloom** 是一个面向成年人的微信小程序：理清此刻的处境，比较可能的选择，然后选一个代价可承受的小尝试。Alpha 一次只跟进一个当前问题，所有 AI 建议都只是草稿，经你确认才会写入卡片。

## 它不一样在哪

- **决策权在你手里。** 模型只负责建议；确认信息、推测、待核实项在卡片上明确分区，只有你确认的内容才会保存。
- **有依据才出现。** 可选的 Insight 必须逐字引用至少两条你自己的原话作为依据，后端找不到依据就直接丢弃。
- **默认克制，记忆自选。** 完整聊天保存是可选项；长期记忆由你逐条确认、区分范围（全局或单个探索），是否用于回复是独立开关，默认关闭。
- **上下文有边界。** 每段会话只携带自己的最近消息、已审阅总结和明确关联的探索，绝不悄悄合并其他会话的记录。
- **预算有账本。** 每次模型调用先按峰值价格预留额度，成功后按 token 回执结算；不自动重试，失败也不伪装成演示回复。

## 工作原理

<p align="center">
  <img src="./assets/readme/workflow.png" width="100%" alt="三段流程：Vue 3 小程序连接 FastAPI 后端；后端把确认的卡片与记忆存入 SQLite 或 PostgreSQL；DeepSeek 模型只返回需要用户确认的草稿。">
</p>

## 快速开始

需要 Node.js 22+、npm、uv 和微信开发者工具。在仓库根目录的 PowerShell 中执行：

```powershell
npm ci
npm --prefix apps/miniprogram ci
uv sync --directory apps/api --frozen
# 仅在文件不存在时创建，不覆盖已有凭证
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
```

保持两个终端：

```powershell
# 终端 1 —— 后端 API，地址 http://127.0.0.1:8000
npm run dev:api

# 终端 2 —— 小程序监听编译 + 打开开发者工具
npm run dev:wechat
```

`dev:mp` 只编译不打开工具；`npm run dev` 提供辅助 H5 预览（`http://127.0.0.1:5173`）。**微信开发者工具是真实 UI 的主要验收环境**——H5 通过不能证明 WXSS、胶囊、键盘和安全区正确。

新拉取仓库的 AI 默认是 `demo` 模式（无付费调用）。要启用真实 DeepSeek 对话，在被 Git 忽略的 `apps/api/.env` 中配置后重启 `dev:api`：

```ini
AGENCY_AI_MODE=deepseek
AGENCY_DEEPSEEK_MODEL=deepseek-flash
AGENCY_DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENCY_DEEPSEEK_API_KEY=YOUR_KEY
AGENCY_MAX_OUTPUT_TOKENS=768
```

密钥只放这个后端文件，绝不放进前端 `VITE_` 变量。后端关闭思考与流式输出、强制 JSON 协议，调用失败不会回退成演示回复。2026-10-17 已验证过一次真实付费请求（680 输入 / 60 输出 tokens，约 ¥0.000920），证据与 `--live-once` 防护见 [DeepSeek 验证记录](docs/DEEPSEEK_VALIDATION.md)。

## 主题

<p align="center">
  <img src="./assets/readme/themes.png" width="100%" alt="六套主题：晨雾（默认）、深夜（黑色星空）、晨曦、森林、薰衣草、极简。">
</p>

登录前的空间默认使用晨雾；登录后在「我的 → 外观设置」可切换深夜（黑底淡星）、晨曦、森林、薰衣草与极简。

## Alpha 已有功能

- 匿名引导含五条意图分支；本机草稿保留 7 天，登录前不上传任何内容
- 一张决策卡区分确认信息、推测、待核实项与你选择的下一步
- AI 单独授权；Insight 需逐字依据，无依据即丢弃
- 每个探索有独立会话工作区——归档、恢复、带版本删除；草稿与进行中的回复按会话隔离
- 你确认的长期记忆支持范围、启停、合并、删除；每条回复附带「本次传给模型的背景」披露
- 可选完整聊天保存、停止生成中的回复、反馈历史、账号删除与用量限制

## 检查命令

```powershell
npm run typecheck
npm run test:ui
npm run test:tools
npm run build:mp
npm run check:mp:dev
npm run test:api
npm run lint:api
```

可选 PostgreSQL 测试需要一次性本地数据库，不连接远程 Supabase 项目，详见[验收记录](docs/VALIDATION.md)。

## 代码结构

```text
apps/miniprogram/       Vue 3 + TypeScript + uni-app
  src/components/      引导、卡片、抽屉、头像与图标
  src/pages/index/     当前问题、对话、设置与登录
  src/onboarding.ts    草稿恢复与固定整理规则
  src/static/          随包主题图与图标
apps/api/              FastAPI、持久化、身份验证、DeepSeek 适配与费用账本
supabase/migrations/   PostgreSQL 表结构、RLS 与权限（仅增量的迁移）
tools/                 本地开发与验收辅助脚本
docs/                  产品、设计、接入与验收记录
```

环境文件、数据库、编译产物和私有开发者工具配置均被 Git 忽略。模型密钥、微信 AppSecret、Supabase secret 与数据库密码仅存放后端。

## 说明与限制

- 真实微信登录需要配置后端 AppID/AppSecret（[接入说明](docs/SETUP.md)）；真机软键盘遮挡与真实头像选择面板仍需手动验收
- 远程 Supabase 迁移已准备但未应用；不要重置已有数据库或额度账本
- 真实手机的 `127.0.0.1` 指向手机自身；发布需 HTTPS 与微信合法域名

其他说明：[产品约定](docs/PRODUCT.md) · [设计说明](docs/DESIGN.md) · [接入说明](docs/SETUP.md) · [微信原生验收证据](docs/WECHAT_VALIDATION.md)
