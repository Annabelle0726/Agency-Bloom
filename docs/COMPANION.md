# Agency Bloom 对话机器人头像

当前使用薄荷绿、奶白色的温和机器人形象，替代此前的火焰火种。
资源来自用户明确选定的已生成头像，裁切为适合微信小程序显示的轻量圆形 PNG。

- 源码组件：`apps/miniprogram/src/components/CompanionAvatar.vue`
- 当前资源：`apps/miniprogram/src/static/companion-bot.png`
- 页面间距：`apps/miniprogram/src/companion-chat.scss`

在聊天欢迎态和 AI 消息列表均使用该组件；等待回复时使用 thinking 状态。用户头像仍保持原来的独立逻辑。

交互状态：
- rest：历史回复静止，避免长对话的动画和性能开销。
- idle：当前头像低幅度浮动。
- thinking：等待模型响应时，轻微的薄荷绿光圈。
- speaking：新回复出现时短暂弹动，约 740ms。
- greeting：点击头像会短暂侧倾回应，约 590ms，不触发网络请求。

减弱动态效果模式下禁用动画。保留原本的聊天请求、记忆、隐私和预算功能。
微信小程序应以模拟器和真机复核小尺寸头像可读性；浏览器预览不能代替真实小程序验收。
