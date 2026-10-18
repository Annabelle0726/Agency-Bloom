# Agency Bloom 品牌视觉

品牌系统分两级：

- **品牌识别**：应用顶栏使用 19px 的双叶芽苗符号及 `AGENCY BLOOM` 字标。芽苗强调成长与方向，深浅主题各有一套 PNG。
- **AI 角色**：对话区继续使用已确定的薄荷绿机器人 `CompanionAvatar`。品牌 Logo 不代替对话形象。
- **微信小程序官方头像（待人工设置）**：已准备 `apps/miniprogram/src/static/brand-app-icon.png`（512×512）。在微信公众平台小程序基本信息中人工上传；仅生成本地素材不会修改微信平台资料。

素材源码：
- `brand-sprout.svg` / `brand-sprout-night.svg`
- `brand-app-icon.svg`

小程序使用的打包位图：
- `brand-sprout.png` / `brand-sprout-night.png`
- `brand-app-icon.png`

修改矢量源后，在仓库根目录运行 `node tools/render-brand-assets.mjs` 重新生成 PNG。客户端图片应优先引用 PNG，以免依赖小程序内嵌 SVG 渲染差异。

Header 布局位于 `apps/miniprogram/src/pages/index/index.vue`，样式位于 `apps/miniprogram/src/brand.scss`。保持中间图文组合为纯展示元素，不增加无意义点击区域；左右按钮及微信原生胶囊维持现有位置。

验收条件：微信开发者工具浅色与深色主题均显示正确；320px 窄屏不撞到左右按钮；状态栏与胶囊不被覆盖；主页、对话、我的三处 Header 外观一致。浏览器预览不能代替小程序模拟器与真机检查。
