# 视觉与交互实现

## Current optional onboarding contract — 2026-10-24

The five questions are an optional exploration starting point after login, not
registration requirements. [ONBOARDING.md](ONBOARDING.md) supersedes earlier
onboarding flow descriptions below: specific multi-select concerns drive concrete
multi-select follow-ups and a further question for each chosen blocker. Relationship
and daily-life concerns have first-class paths alongside career concerns. Each topic preserves its own answers, basic life context
and constraints remain optional, and the last page reviews only supplied content.
Skipping or leaving every question unanswered still permits a direct conversation.
Keep the existing Morning Mist visual system and the non-flashing transitions.
Q1 places its distinct icon beside the label, then a separate description row.
Continue follows the answers inside the scroll view; it is not pinned to the viewport.

## 圆角规范（硬性约束）

所有卡片与容器类组件的 `border-radius` 必须控制在 **6px–10px**，不得使用更大的圆角。此后任何新增或修改的卡片、面板、输入框、按钮、弹层都不得把圆角做到 11px 以上；发现即视为回归，需改回此区间。

当前约定的映射：

| 组件类型 | 圆角 |
|---|---|
| 设计令牌 `--radius-card` / `--radius-button`（[tokens.scss](../apps/miniprogram/src/tokens.scss)） | 8px |
| 主卡片（paper-card、next-card、usage-card、theme-card、glass-card 等） | 8–10px |
| 选项/按钮/输入（quick-answer、primary、text-area、prompt-button 等） | 6–8px |
| 底部弹层与抽屉面板（modal-sheet、intro-panel、composer） | 10px（顶部两角） |
| 圆形元素（头像、单选圈、开关、气泡装饰） | `50%`，不受此限制 |

例外仅限刻意的形状设计（如 `.arch` 拱门、`.plant` 植物剪影等装饰画），它们不是卡片类容器。

引导流程 Step 1–4 的选项卡片是经用户明确要求的例外：卡片 16–18px，图标底座 12–13px。该例外只适用于 onboarding 选择页，首页、设置、弹层等其他卡片仍保持 6–10px。

以用户提供的 ChatGPT 八屏引导图为参考：山湖暮色启动页、宋体风格标题、深蓝文字、细进度条、描边选项、圆角主按钮、暖色自然光影的登录与首页。业务流程采用用户最新 Alpha 说明：先完成匿名整理，再决定是否登录；主题入口移到登录后的「我的」。

## 设计令牌与组件

`apps/miniprogram/src/tokens.scss` 定义 Morning Mist 和 Quiet Night 的色彩、字体、圆角与动效。正文为 #29374B，背景 #F7F6F3，次级文字 #667180，低饱和绿强调色 #58725F、按钮底色 #425E4C。正文使用系统中文无衬线字体，标题使用 Songti SC / STSong / Noto Serif CJK SC / SimSun 回退，不下载字体。卡片与容器圆角统一为 6–10px（见顶部圆角规范）。

`ActionButton` 共用主、次、轻量及微信按钮行为；`SelectionCard` 支持多选、单选与说明；`ProgressIndicator`、`LoadingState`、`EmptyState` 提供统一状态。`OnboardingFlow` 保留步骤与输入，固定规则位于 `onboarding.ts`。

主按钮高 58px，选项至少 57px；引导选项采用 130ms 底色与边框按压反馈，支持 `prefers-reduced-motion`。五步引导不再移动整张长列表，避免滚动内容持续处于变换层；短暂的导航锁仍防止连点跳步。选中标记常驻并预留宽度，不挤动文字，也不在勾选时重新加载图标。底部操作区随答案在同一滚动容器中自然排列。底部导航有连续移动的选中底色，弹层使用 200ms 的短距离过渡。微信构建监听键盘高度并调整聊天输入区，读取状态栏高度、保留底部安全区域。实际原生表现仍需真机验收。API 行为参照 [uni-app 键盘文档](https://uniapp.dcloud.net.cn/api/key.html)。

## 已保存的本地资产

使用内置 `image_gen` 工具生成两张背景，应用运行时无需调用图像服务。以下为最终生成要求的整理记录，不是截图或界面代码：

- **山湖**：竖幅、安静自然的山与湖，柔和的桃色和淡紫暮光，深蓝远山集中在画面下方，平静的湖水；上方约六成保留柔和天空，适合深色中文文字。摄影质感、克制、无人物、无文字、无标志、无 UI。
- **自然光影**：竖幅暖象牙色墙面，柔和日光、窗框与植物叶片投影，左侧和中心干净、可承载深色文字，阴影主要在右侧与下方。安静自然、低对比度、无文字、无家具主体、无 UI。

生成后的图片只进行 JPEG 编码压缩，不改变构图和原尺寸：

| 项目内路径 | 大小 | 用途 |
|---|---:|---|
| `apps/miniprogram/src/static/mountain-lake.jpg` | 100,508 bytes | 启动页、主题缩略图 |
| `apps/miniprogram/src/static/morning-light.jpg` | 71,141 bytes | 登录、匿名空间、首页 |
| `apps/miniprogram/src/static/icons/*.svg` | 每个小于 1KB | 可编辑的 SVG 图标与白色变体 |
| `apps/miniprogram/src/icons.ts` | 由脚本生成 | 内嵌 SVG 数据，供统一的 SvgIcon 组件使用 |

`tools/prepare-icons.mjs` 使用 Lucide Icons v1.60.0 的 24 × 24 几何，统一为 1.8px 线宽、圆角端点，并由当前主题调色板注入颜色，同时生成可编辑 SVG 文件与 `icons.ts`。箭头、返回、发送、关闭、选中标记和引导页选项均使用 `SvgIcon`。根据 [uni-app image 文档](https://uniapp.dcloud.io/component/image.html)，小程序不直接引用本地 SVG 文件，因此通过 image 的 Base64 数据源渲染，应用运行时无需下载。图标规范、许可、语义映射与验证记录见 [ICON_SYSTEM.md](ICON_SYSTEM.md)。真机显示仍需验收。

```powershell
node tools/prepare-icons.mjs
```

没有使用运行时外链图片。背景和图标随小程序一起打包。

## 2026-10-17 交互与文案整理

页面文案移除句号，以短句和换行组织信息，用户自行输入的文本保持原样。草稿说明和清除操作放到右上角菜单，底部只保留主要动作与简短说明。登录页保留未预勾选的协议确认，首页、对话与深色主题使用同一套图标。

切换页签后立即复位滚动位置，设置数据请求不阻塞页面切换。包含固定聊天输入框的容器只做透明度过渡，避免 transform 改变固定定位参照而导致跳动。主背景、卡片和正文不做持续运动。

## 探索版本的内容与交互层次

第一题用明确的探索意图替代反复整理问题的标签；说明与标题分层，多选仍有即时缩放与选中反馈。第二步由类型安全的本地规则改变问题，多选时先定当前主线，不用随机生成问卷。问答区域滚动，底部主操作固定，保留状态栏、胶囊和安全区

初步整理把标题、用户原话、背景和帮助偏好分开，明确标注固定问题整理。标题只出现一次，正文不再同义重复「没有方向」。匿名浏览页减少上部空白，以胶囊底部加 18px 定位起始内容，卡片呈现一条真实线索和下一种可选帮助，不反复解释用户的状态

初步整理先呈现用户实际提供的记录，再单独展示探索方式说明。空标题只表示未命名，不推断没有方向；已有问题、已有其他线索、明确 unsure 且无具体线索采用不同承接。Listen/Discover/Compare/Experiment 分别说明倾听、探索连接、比较代价、限制投入的小尝试，避免用同一段泛化文字覆盖所有选择

Insight 与普通气泡区分：8px 圆角、细绿侧线、观察小字、新角度正文与不确定性说明。三个按钮至少 44px 高，可换行，不使用持续动效。兴趣操作准备追问；拒绝直接略过；小实验进入可编辑审阅弹层，保留明确确认按钮和暂不保存出口

聊天顶部横向滚动的帮助方式可以随时切换，发送中禁止切换；收到新回复后定位到最新消息，聊天内容底部为输入框和导航留出空间。实验弹层依据键盘高度调整可滚动区域；软键盘真实弹出与不同字体倍率仍需真机验收

错误分别显示在所属范围：本地草稿仅报告本机写入问题，初始化断开只在注册承接中提示可继续浏览，登录错误不跟随返回步骤，数据与 AI 错误各自管理。失败和取消不清空用户输入，日志不记录原话、密钥或令牌


## 2026-10-17 生活意愿开场

首次进入为五页手动 slideshow：向前的意义、自己的意愿、休息的余地、小小的选择、愿意亲自度过的生活。每页使用独立本地意象背景：晨曦、湖面、窗边、林间小径、原野。点击正文及其留白进入下一页，支持指示点与「继续读」，不自动翻页、不循环、不逐字等待；「跳过开场」始终可用。每页文字可独立纵向滚动，底部操作不随正文滚走。已开始探索的本机用户恢复草稿或进入问题；仍可主动返回开场。

登录并成功保存探索后，在首页前插入 FirstArrival 独立理念页，承接「我还想按自己的意愿活一活」，正文可滚动，固定「进入我的空间」和顶部「直接进入」都可结束阅读。首次状态按账号保存在本机：pending 支持中断恢复，seen 避免重复；已有当前探索的用户正常恢复时直接进入首页。此标记不跨设备同步，存储失败不阻塞阅读或进入。删除账号时清除对应标记。匿名与 AI 单独同意说明保留在原介绍面板。

开场与理念页不调用模型。H5 根据减少动效偏好关闭文字与背景动画；微信真机的触摸、字体放大和小屏适配仍应验收。测试见 tests/arrival.test.ts；原生模拟器验收使用 tools/verify-opening-native.cjs，拦截 wx.request 使用固定测试数据，并在结束时恢复原会话和草稿。


### 五幕开场动效与资产

整行淡入，间隔 140–160ms，末句约 1.7s 完全出现；正文轻点翻到下一页，末页轻点开始探索；400ms 连点保护，纵向滚动不触发翻页，回看不重播，不阻塞翻页。重点句采用每幕独立深色，并加字重；背景交叉淡入 650ms，图片加载后才显示，失败保留暖色底。H5 与支持媒体查询的环境尊重减少动效。所有背景本地打包，无运行时图像请求；短屏正文滚动、底部固定、指示点 44px 点击区域。

内置 image_gen 生成五张原图，等比缩至 750px 宽并编码 JPEG；构图不改变。最终提示词完整记录在 docs/opening-image-prompts.json。资产位于 apps/miniprogram/src/static/opening-{dawn,water,rest,path,meadow}.jpg，总计 452370 bytes。

本轮验证：vue-tsc 通过，微信 WXML/WXSS 编译与图片引用检查通过；构建目录约 1.0 MB。原生模拟器自动化在连接握手时响应超时，尚未完成五幕截图及交互验收，不将编译成功视为视觉验收。


## 轻量首次问答

开场之后的第一题询问最近让人焦虑、害怕或不安的事情，以方向不明、AI 与行业变化、选择取舍、收入与稳定、其他牵挂为入口，同时允许好奇探索和暂时不细说。选项对应既有探索方向，不据此推断心理状态或诊断。只选一项时，下一页不再重复要求选择主线；多选时由用户决定先聊哪条。

后续分支提供短答案供主动点选，不预选、不自动生成用户原话，点选内容存入原有 focus_response。用户可以不选、不写直接继续。自述、命名、经历、现实条件默认折叠，已有文字草稿自动展开，收起不清空。生活背景仍可跳过，帮助偏好通过选项完成。首次整理显示选中的探索方向，避免没有填写文字时误称用户什么都没留下。注册前可全程零文字输入；具体经历留到后续对话再逐步了解。

## 2026-10-20 安静引导页与 Lucide 图标

第一题改为更安静的卡片节奏：17px 圆角、近白主题底色、1px 淡边框、极轻阴影，左侧 42px 图标底座与 12–13px 内圆角，右侧保留固定的勾选或单选位置。选中态只用主题淡染、柔和的强调色边框、略深的图标底色，多选使用圆角方形勾选，单选使用圆形点，不使用大块高饱和填充。未选中与选中状态的文字对比度均按六套主题测试。

标题从楷体改为 `var(--font-heading)` 的宋体回退，五步统一 24px、窄屏 22px、行高 1.5，减少装饰性；卡片间距 12px，说明文字 12–13px。主按钮使用主题派生的纯色 `--cta-fill`，选中后明确激活，未选中时保持低对比的禁用态，不使用宝石渐变或持续光效。

五个步骤统一使用同一套语义图标：方向、变化、取舍、稳健改变、其他牵挂、新的可能、暂时说不清分别对应 compass、orbit、split、shield-check、message-heart、door-open、message-more；帮助偏好对应 ear、sparkles、scale、flask-conical。图标为 Lucide v1.60.0 几何、24 × 24、1.75px 线宽、圆角端点，颜色由 `activeTheme.palette` 注入，不用固定绿色。微信端继续通过 `<image>` + Base64 SVG 数据源渲染，不依赖内联 Vue SVG。

未引入 Lottie 或 SVG 动画库。图标只做 120–160ms 的底色、边框、勾选缩放和按压缩放反馈，并遵守减少动效偏好。引导页按产品规则保持晨雾主题；六套主题的图标与卡片令牌由 `tests/themes.test.ts` 覆盖。技术细节和后续新增图标的流程见 [ICON_SYSTEM.md](ICON_SYSTEM.md)。

## 2026-10-20 文案与标题

- 一句话在界面中只占一行时，结尾不加句号；多句连写、需要停顿或分成多行说明时才使用句号。
- 页面标题不在文案里写死换行；除非内容本身需要分行，标题由容器自然排布，并在目标宽度保持单行。


## 2026-10-24 Time-based theme controls

The Settings switch “随时间自动切换” defaults on and reuses existing theme-aware toggle styling. Manual choices last until the next 05/10/16/19 local boundary; auto-off preserves manual choices long-term. Appearance shows the next boundary explicitly. Automatic repainting waits for keyboard dismissal; background resume refreshes the clock. The six palettes and frozen reference art remain unchanged. Implementation and acceptance limits: [THEME-SWITCHING.md](THEME-SWITCHING.md).

## 2026-10-24 Shared type, readable controls, and first paint

Typography follows semantic roles across opening, registration, onboarding, workspace, drawers, and journey pages: Songti heading fallbacks at 24px (22px at 350px and below), section headings at 18px, and the shared system sans stack for card titles at 16px, body and button labels at 14px, subtitles at 13px, and captions at 12px. Body weight is at least 400. Opening emphasis is 600; the final line uses 500. The five opening slides retain their art and transitions and expose an explicit next action. Duplicate English eyebrows and the registration signature are removed.

Text-bearing primary controls use the existing CTA palette with dark enough gradient stops. The tabbar center retains its gem treatment. Plan actions use a stronger theme-derived text color; disabled controls use explicit background and text tokens at full element opacity, including the memory merge action. A selected-count hint explains when merge becomes available. Summary confirmation stays beside its action and resets when the user edits the draft. Conversation actions, error recovery, memory filters, and privacy links have 44px touch targets.

Chat uses faint local SVG water contours, distinct from Discover's botanical forms. Discover's inherited stroke opacity is reduced; subordinate paths multiply that opacity rather than replacing it. Registration fades into an opaque action area at the content boundary, including narrow or short screens. These decorations do not depend on animation, inline SVG support, a network request, or backdrop-filter.

Startup restores a small session-scoped paint hint synchronously while account data is loading. The hint contains a non-authenticating session tag, palette ID, automatic-mode flag, and temporary override expiry; it never contains another copy of the credential. Automatic hints resolve against the current local time slot, and logout clears them. H5 injects an early head script from the same palette definitions and selection functions, then keeps the document canvas aligned with the active theme. Mini Program views use the same synchronous selection and update the native navigation and page backgrounds. Onboarding and registration continue to use Morning Mist. Evidence and isolated regression captures are in `output/ui-ux-polish-20261024/`; native compiler checks do not imply simulator acceptance.

## 2026-10-24 Discover botanical motion

Discover's botanical decoration follows native page scrolling along two cubic Bezier paths. This user-selected direction supersedes the automatic sway prototype. The page retains natural scrolling, without gesture interception, scroll locking or extra decorative scroll space. Text and cards follow their normal document flow.

- The page entry reuses `onPageScroll` to pass scroll position to Discover while preserving the chat scroll handler. Tab changes reset the decoration's position. Each absolute scroll position maps to the same pose, so reversing direction retraces the path without a jump.
- Both layers follow mirrored S paths close to their viewport-edge anchors. Upper petals first sweep left and then right; lower leaves first sweep right and then left, crossing the center at about 180px of scroll. Horizontal excursions are bounded to approximately 35px and 41px. Upper petals drift downward by at most 36px and lower leaves upward by at most 48px, keeping the forms visible at the page bottom instead of translating the full canvas out of view. Scroll rotation is bounded by 1.2 and 1.5 degrees. Exponential distance normalization avoids a hard endpoint on long pages.
- Artwork remains at 76% of its original size. Scroll transforms apply to outer wrappers; inner images retain a very quiet breath at rest. The 16-second petal and 20-second leaf cycles vary scale only from .76 to .762 and opacity from .96 to 1, with offset phases. Breathing adds no translation or rotation. This replaces the earlier .775 scale peak, 3px drift and .7-degree rotation that amplified the perceived shaking. Layer separation prevents keyframes from overwriting scroll transforms.
- A 140ms `cubic-bezier(.16, 1, .3, 1)` transform transition interpolates between scroll events and settles after scrolling stops, while the inner artwork keeps breathing. Per the user's preference there is no pause button. Product motion uses CSS transforms and opacity without JavaScript frame loops or timers. The fixed decoration clips overflow and ignores pointer input.
- Outline opacity increases by seven percentage points: petals use 13.5% in light palettes and 15.5% in Quiet Night; leaves use 13.5%. Existing theme colors and gradient fills are preserved.
- The reduced-motion media query disables both scroll interpolation and breathing, leaving the artwork at its smaller static size. Native accessibility behavior and device scroll feel still require hardware validation.

Current evidence is in `output/discover-stable-20261024/`; earlier iterations remain available separately. Diagnosis reproduces the previous page-bottom translations of about -248px / -304px with 7.4 / -9.3 degrees rotation. Seven focused tests cover local SVG safety, composition, color strength, S continuity, bounds, reversibility and edge anchoring on short and long pages. Three browser rounds per viewport verify leaf reference points remain within the visible screen, breathing has no translation or rotation, foreground geometry stays fixed at rest, and reduced motion remains static. Forest at 390 x 844 and Quiet Night at 320 x 740 use actual components with synthetic content. Native development and WXML/WXSS compilation were rerun. Simulator and hardware acceptance remain unverified. Local visual self-review only; no product-copy changes.

## 2026-10-24 Static climbing vines in Settings

The personal Settings page uses a separate local SVG guided by the user's climbing-vine reference: flexible intertwined stems, attached heart-shaped leaves with fine veins, and two small subordinate tendrils. Leaf sizes and angles vary along short petioles, making the continuous growth recognizable rather than using bare branches or isolated repeating coils. The drawing occupies the upper-right and lower-left edges, using theme accent/gold at low opacity and faint leaf fill; the middle stays clear for account settings. It does not reuse Discover's large petal contours. The original reference is visual guidance, not a runtime image asset.

The SVG is delivered through the existing Base64 image mechanism. Its fixed background layer is excluded from accessibility and pointer targeting; settings content remains in front. It has no scroll input, transform animation, breathing cycle, timer, dependency or media request. Theme changes recompute the cached local artwork without changing account preferences. Existing text, spacing and control behavior remain intact.

Evidence is in `output/settings-vine-20261024/`, with the reference-guided revision in `reference-vine/` and `reference-vine-dark/`. Focused tests cover six palettes, local/static SVG content, cache/fallback behavior and distinct geometry. Local SVG definitions are reused only through fragment references; there are no external images or fonts. Visual captures use 390 x 844 and 320 x 740 H5 viewports. Earlier functional checks verify the unchanged fixed background layer and unobstructed appearance/toggle actions. TypeScript and native development/WXML/WXSS checks are repeated for the revised SVG; simulator and hardware acceptance remain unverified. Local visual self-review only. Existing labels, layout and controls remain unchanged.

## 2026-10-24 Compact bottom spacing on secondary tabs

Discover, Settings and Plan use a dedicated shell class that reserves 72px for the fixed navigation plus the existing bottom safe-area inset, replacing the previous 90px reservation. Discover and Plan retain 12px of internal bottom padding (previously 32px and 28px). Settings retains 28px (previously 24px), so its centered final caption clears the raised conversation button while the total reservation still shrinks by 14px. Discover and Plan lose 38px and 34px of redundant bottom space respectively. Other tabs keep their current spacing.

Validation uses actual Vue components with synthetic content at 390 x 844 and 320 x 740. Existing uppercase brand labels remain unchanged. TypeScript and eight focused botanical tests pass. H5 captures are supporting evidence only; native simulator and hardware acceptance remain unverified.

## 2026-10-24 Static drawer accents and control alignment

The conversation drawer has two sparse climbing-vine SVG studies at its upper-right and lower-left edges. They are separate from the Settings composition, use the injected active icon palette, and remain stationary while the conversation list scrolls. Local Base64 images are non-interactive and hidden from accessibility. The drawer retains its opaque paper surface, while inner scroll layers are transparent. No new ambient or scroll animation is added.

Drawer search now uses its own border wrapper and an unpadded, vertically centered input rather than the shared padded `text-input` class. Filter controls retain 44px touch targets, center their labels, and have zero vertical padding. Drawer scroll content has zero bottom padding, removing the previous 12px plus safe-area reservation. These rules do not alter page navigation spacing.

Evidence and local self-review are in `output/drawer-atmosphere-20261024/`. Final H5 captures cover 390 x 844 and 320 x 740; TypeScript, focused drawer tests, native development compilation and bundled WeChat WXML/WXSS checks pass. Native simulator and hardware rendering of the final alignment corrections remain unverified.
