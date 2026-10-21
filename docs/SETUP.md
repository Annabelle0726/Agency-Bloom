# 接入与部署

## 当前配置

当前使用本机 SQLite 和固定示例回复。`apps/api/.env` 是后端唯一默认加载的环境文件，前端使用 `apps/miniprogram/.env`。从仓库根目录运行 npm 脚本会自动使用正确的工作目录。

Supabase 项目 ref 为 `ycombbpglsmbvjlrjtgc`。本地 `.env` 中保留项目 URL、publishable key 和 JWKS URL 作为接入资料；当前应用不消费这些变量。`SUPABASE_SECRET_KEY` 留空，应用不需要这个 secret 才能运行。

本项目采用「小程序 → FastAPI → PostgreSQL」结构：微信身份由后端换取并验证 openid，应用签发随机不透明会话，数据库只存会话的 SHA-256 摘要。没有使用 Supabase Auth，因此不能把本应用会话当作 Supabase JWT；也不需要在小程序安装 Supabase JS SDK。

## Supabase（迁回云端时）

Windows 使用 Supabase 官方 CLI 二进制，不再通过 npm 安装 CLI。先确认终端中 `supabase --version` 可用；若没有，从 [Supabase CLI releases](https://github.com/supabase/cli/releases) 下载 `supabase_windows_amd64.zip`，解压后将 `supabase.exe` 所在目录加入 `PATH`。

连接云端时，在自己的终端登录。`supabase login` 使用个人访问令牌，不能使用 publishable key 或 secret API key 代替：

```powershell
supabase login
npm run db:link
supabase db push --dry-run
# 确认目标项目和迁移内容后才执行：
supabase db push
```

`npm run db:link` 会链接 `.env` 中的项目 ref，并可能要求输入数据库密码。数据库连接密码也不是 API key；通过 CLI 安全输入凭据，不要把它们贴在聊天中。

如果 `db push` 直连 `db.PROJECT_REF.supabase.co` 报 `ECONNRESET`，改用 Supabase Connect 面板的 Session pooler 连接串，并通过 `--db-url` 推送：

```powershell
$url = "postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@YOUR_SESSION_POOLER_HOST:5432/postgres?sslmode=require"
supabase db push --dry-run --db-url $url
supabase db push --db-url $url
supabase migration list --db-url $url
```

从 Supabase Connect 面板复制适合部署环境的数据库连接信息，配置后端：

```dotenv
AGENCY_DATABASE_URL=postgresql+psycopg://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@YOUR_SESSION_POOLER_HOST:5432/postgres?sslmode=require
```

上面是模板，host 必须取自实际项目，密码中的特殊字符需要 URL 编码。一般长期运行的 Python 服务可以使用 direct 或 session pooler；direct 地址的网络支持情况须按部署环境确认。详见 [Supabase 连接文档](https://supabase.com/docs/guides/database/connecting-to-postgres)。

PostgreSQL 始终通过版本化 SQL 迁移建表，应用启动不自动建表。SQLite 开发模式则自动建表。迁移启用所有业务表 RLS，同时撤销 PUBLIC、anon、authenticated、service_role 的直接表权限。客户端仅访问 FastAPI；后端通过可信数据库角色访问，并对每个资源执行用户归属校验。不要把数据库连接串或后端数据库角色下发给前端。RLS 细节见 [官方说明](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 微信与 DeepSeek

```dotenv
AGENCY_WECHAT_APP_ID=你的微信小程序AppID
AGENCY_WECHAT_APP_SECRET=仅保存在后端的AppSecret
AGENCY_AI_MODE=deepseek
AGENCY_DEEPSEEK_API_KEY=重新生成的有效密钥
AGENCY_DEEPSEEK_MODEL=deepseek-flash
```

前端 `apps/miniprogram/src/manifest.json` 的 `mp-weixin.appid` 已与本机新增的微信开发者工具项目配置同步。后端 AppID 与 AppSecret 仍需在启用真实登录时配置。应用调用 `uni.login`，后端调用微信 `jscode2session`；不收集手机号。当前真实登录协议只完成模拟上游测试，需在开发者工具与真机完成联调。

DeepSeek requests run only on the backend. The approved total running budget is CNY 500/month, including CNY 100/month for AI. Flash and Pro rates are selected by model; stale manual rate overrides fail validation. Existing spend is preserved. Provider thinking is private; the UI only displays optional grounded response explanations. See [RESPONSE_REASONING.md](RESPONSE_REASONING.md) for configuration, pricing and QA. This application budget does not control other applications using the same key.

每次调用在数据库事务中先预留费用，成功后按返回 token 用量和所选模型的费率卡结算。网络中断、取消或结果不确定时保留预留额度，不自动重试；这可能高估应用用量，但不会因重复重试反复发送同一请求。每天每个账号默认最多 30 次。卡片编辑与反馈不受 AI 额度影响。

## 上线前的具体未完成项

1. 获取微信 AppID/AppSecret、验证小程序类目与实际发布要求，完成真机交互验收。
2. 部署 Python 服务，配置 HTTPS 和微信 request 合法域名；真机不能访问开发电脑的 `127.0.0.1`。
3. 连接 Supabase 并应用迁移，核实实际数据区域和备份/留存设置。
4. 使用替换后的 DeepSeek 密钥做少量真实案例评估，核对费用参数。
5. 补齐运营主体、联系方式与实际第三方数据说明，再邀请朋友试用。
6. 处理 `docs/VALIDATION.md` 记录的编译依赖安全告警；开发服务器只绑定本机，不可直接作为公网服务。

生产模式设置 `AGENCY_ENVIRONMENT=production`、`AGENCY_ALLOW_DEV_AUTH=false`。启动检查会拒绝本地登录、SQLite、固定示例 AI 或缺失微信/模型凭据的生产配置。生产 API 文档关闭；反向代理还应限制请求体大小、连接数和认证端点频率。
