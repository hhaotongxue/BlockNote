# 可复用编辑器边界（2026-10-10 更新）

用户已明确要求：所有编辑器定制归 BlockNote，消费项目不得保留编辑器样式适配。

- `packages/preset` 统一维护菜单、Lucide 图标、工具栏、标题和页面样式、提示框、任务动画、侧栏定位、禁止新建折叠块的策略及测试。允许通过公开 API 编写 TS/TSX。
- Core/React/Mantine 原有视觉定制仍在各自 CSS 原规则维护；不修改编辑引擎、文档 schema、命令、选区、拖拽、序列化、协作实现。
- lianshu 仅连接文档、保存、附件、文档引用和业务页面事件；不得新增编辑器 CSS、选择器覆盖、内联视觉补丁或复制 preset 组件。
- 页面外壳样式也归 preset 的 `page.module.less`，消费方只引用样式类。主题颜色可以读取宿主已有通用变量，但编辑器提供独立明暗默认值，不要求宿主写 CSS。
- 不新增 `!important`。迁移保留既有页面规则，后续清理单独评估。
- 本地统一从此仓库读取 Core/React/Mantine/preset；跨项目用相同版本的四个包。不得混入 npm 上游版本。
- 检查构建和策略测试；视觉由用户本地验收，未经允许不打开浏览器。

见 `packages/preset/README.md` 获取接入方式。

## 统一提示组件

按用户要求，允许 `packages/mantine/src/tooltip/EditorTooltip.tsx` 和工具栏、Badge 的提示接入进行 UI 组件调整。所有提示外观由 `blocknoteStyles.css` 的统一外层规则维护；preset 导出 `EditorTooltip` 供消费页面引用，不在消费方实现提示样式。此例外不涉及编辑引擎逻辑。

## 媒体卡片插槽（2026-10-12）

用户授权媒体卡片采用宿主插槽：preset 只维护卡片、浮层定位和显隐；上下栏内容由宿主通过 `renderMediaToolbar` / `renderMediaPanel` 提供。共享媒体面板位于 `@lianshu/ui`，允许拥有自身样式，但不覆盖编辑器选择器。模型数据、上传服务、生成任务仍由宿主连接。Loomart 本次不修改。
