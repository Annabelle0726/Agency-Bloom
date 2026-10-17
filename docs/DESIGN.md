# 视觉与交互实现

以用户提供的 ChatGPT 八屏引导图为参考：山湖暮色启动页、宋体风格标题、深蓝文字、细进度条、描边选项、圆角主按钮、暖色自然光影的登录与首页。业务流程采用用户最新 Alpha 说明：先完成匿名整理，再决定是否登录；主题入口移到登录后的「我的」。

## 设计令牌与组件

`apps/miniprogram/src/tokens.scss` 定义 Morning Mist 和 Quiet Night 的色彩、字体、圆角与动效。主色为 #29374B，背景 #F7F6F3，次级文字 #667180，按钮底色 #33465D。正文使用系统中文无衬线字体，标题使用 Songti SC / STSong / Noto Serif CJK SC / SimSun 回退，不下载字体。

`ActionButton` 共用主、次、轻量及微信按钮行为；`SelectionCard` 支持多选、单选与说明；`ProgressIndicator`、`LoadingState`、`EmptyState` 提供统一状态。`OnboardingFlow` 保留步骤与输入，固定规则位于 `onboarding.ts`。

主按钮高 58px，选项至少 57px；按压反馈 130ms，引导内容过渡 180ms，支持 `prefers-reduced-motion`。引导页保留进度条与底部操作区，仅中间内容滚动和过渡，短暂的导航锁防止连点跳步；选中标记预留宽度，不挤动文字。底部导航有连续移动的选中底色，弹层使用 200ms 的短距离过渡。微信构建监听键盘高度并调整聊天输入区，读取状态栏高度、保留底部安全区域。实际原生表现仍需真机验收。API 行为参照 [uni-app 键盘文档](https://uniapp.dcloud.net.cn/api/key.html)。

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

`tools/prepare-icons.mjs` 定义 24 × 24 图标、1.45px 线宽、圆角端点与统一配色，同时生成可编辑 SVG 文件与 `icons.ts`。箭头、返回、发送、关闭、选中标记和导航均使用 `SvgIcon`。根据 [uni-app image 文档](https://uniapp.dcloud.io/component/image.html)，小程序不直接引用本地 SVG 文件，因此通过 image 的 Base64 数据源渲染，应用运行时无需下载。真机显示仍需验收。

```powershell
node tools/prepare-icons.mjs
```

没有使用运行时外链图片。背景和图标随小程序一起打包。

## 2026-10-17 交互与文案整理

页面文案移除句号，以短句和换行组织信息，用户自行输入的文本保持原样。草稿说明和清除操作放到右上角菜单，底部只保留主要动作与简短说明。登录页保留未预勾选的协议确认，首页、对话与深色主题使用同一套图标。

切换页签后立即复位滚动位置，设置数据请求不阻塞页面切换。包含固定聊天输入框的容器只做透明度过渡，避免 transform 改变固定定位参照而导致跳动。主背景、卡片和正文不做持续运动。
