# @blocknote/preset

统一可复用的编辑器 UI。此包提供源码（TSX/CSS/Less），适用于 Vite 等支持源码依赖的构建器，不依赖 lianshu 或 AFFiNE 运行时。

```tsx
import { EditorView } from "@blocknote/preset";
import "@blocknote/preset/style.css";
// editor 由 useCreateBlockNote 创建，可传业务 schema/uploadFile。
<EditorView editor={editor} theme="light" onChange={saveDocument} />;
```

`EditorView` 自动安装菜单、工具栏、Lucide 图标、侧边按钮定位、勾选动画和禁止新建折叠块策略；原有折叠块仍可展示、编辑和撤销恢复。children 用于文档引用菜单等业务扩展。

媒体卡片选中边框通过 `selectionColor` 传入，默认亮蓝色 `#38bdf8`；宿主可传 `selectionColor="var(--color-primary)"` 复用自身主题色，不影响正文文字高亮。

需要完整文档页面时，引用 `@blocknote/preset/page.module.less` 的页面类，并在外层加 `bn-preset-page` 和 `data-theme="light"` / `"dark"`。标题使用 `lianshu-blocknote-title` 类。名称保留是为了迁移时不改变现有 DOM。所有宽度、对齐与主题样式都在本仓库维护。

安装本 fork 同版本的 core/react/mantine/preset，以及 React、ReactDOM、Mantine 8/9 和 Less。工作区开发可将四包统一 alias 到源码；发布用 pnpm pack（workspace 依赖会转换版本），将四包一起发布到自己的 registry，固定版本。不要仅安装 npm 上游同名包。

主题继承宿主通用颜色变量，同时提供独立浅色/深色默认值。消费者不应写编辑器 CSS 覆盖。勾选动画来自 BlockSuite MPL-2.0，来源保留在 checkAnimation.ts。

`createDocumentSchema()` 包含主题自适应的代码块、语言选择和复制按钮，并通过 `@blocknote/code-block` 按需加载 Shiki 高亮。代码块保留原生 schema、快捷键和 HTML 导出；未知语言仍可展示，纯文本可手动选择语言启用高亮。源码接入时，将 `@blocknote/code-block` 一并 alias 到本 fork 的 `packages/code-block/src/index.ts`。独立消费时先构建此依赖包。

代码块底色统一读取 `--bn-preset-bg-secondary`，宿主通过全局 `--color-bg-secondary` 提供中性灰；不在代码块组件维护独立色值。右上角工具栏依次为语言、复制、自动换行。默认自动换行，关闭后保持原始行并允许横向滚动；换行选择仅为当前编辑器会话的显示偏好，不写入正文或撤销历史。

代码块交互回归：在仓库根目录运行 `vp test --config packages/preset/tests/vite.config.ts --run`。

## 本地准备

```sh
corepack pnpm@11.8.0 install
corepack pnpm@11.8.0 exec vp run --filter @blocknote/core --filter @blocknote/react --filter @blocknote/mantine build
```

基础包构建生成声明文件。消费项目的 TypeScript 和 Vite 都应解析同一个 fork，不能分别使用 npm 类型与 fork 运行时。源码包本身不需要额外编译；由消费项目打包。此变更未发布 registry。

## 统一提示

菜单、工具栏和页面图标统一使用导出的 `EditorTooltip`。传 `label` 与一个可接收 ref 的子元素；页面外使用时可传 `colorScheme="light"` / `"dark"`。编辑器浮层内可通过 `portalProps.target` 指向 `usePortalElement()` 返回的主题容器。不要直接使用 Mantine Tooltip、原生 title 或 CSS 伪元素另画一层提示。背景、字体、留白统一由 Mantine 皮肤的 tooltip 规则维护。

## 卡片视图

`CardEditorView` 接收 `editor`、`theme`、`mode: "readonly" | "editable"` 和可选 `maxHeight`（默认 320px）和 `scrollable`（默认 true）。卡片始终只有正文，不含标题、保存、Git 或业务动作。只读模式关闭编辑及菜单；可编辑模式复用精简编辑 UI。宿主负责创建独立 editor view 并绑定共享文档、加载/卸载及可选历史追踪。完整页面继续使用 `EditorView`。

炼书的 `DocumentCard` 是原生文档适配器：交付使用只读裁剪预览并由业务外壳显示标题；闪念使用不带标题的只读/可编辑模式。

卡片仅在实际溢出的方向显示渐隐，滚到底部后底部渐隐消失。`scrollable={false}` 固定为顶部预览，保留溢出渐隐提示；标题和打开完整文档的行为仍由宿主提供。

### Media card slots

`mediaRuntime.renderMediaToolbar(context)` and `renderMediaPanel(context)` provide host-owned content. The preset owns the themed floating containers, their positioning, dismissal, and the card surface. The lower slot appears only with AI enabled. Context exposes `values`, `update`, `upload`, `remove`, `close`, `busy`, and `resolvedUrl`. Model services and generation are supplied by the host; the editor does not load model catalogs. Use `notifyError` for transient host notifications. No task errors are rendered or replayed in the card.

### 图片尺寸与并排

- `aiImage` / `aiVideo` 有素材时使用素材实际比例；空卡片使用生成比例。
- `previewWidth: 0` 表示铺满可用宽度；单张卡片两侧手柄修改这个宽度，高度始终随素材比例变化。
- 拖动图片本身，到另一图片中部的左/右半边可组成 `mediaRow`；顶部/底部为上下插入。蓝色插入线表示落点。
- `mediaRow` 只保存原图片块的 `children` 顺序。CSS 根据加载的图片宽高比分配 flex 权重，扣除 12px 间距后铺满整行，无裁剪。行内忽略单图手动宽度，拖出后恢复。
- 移动、成行、拆行通过公开 block API 在同一事务中完成，保留图片 ID 与任务绑定。宿主的 headless schema 需要注册 `mediaRow` 和 `previewWidth`。
- 这一布局限定为图片行，不引入通用分栏依赖；外部 Markdown/HTML 的默认有损导出仍以独立图片输出。

### 文档素材面板

文档素材弹窗样式由 `@blocknote/preset/document-materials.module.css` 提供。素材按原图比例展示，并按最短列分配为自适应瀑布流；宿主负责素材引用、上传与公共图片预览。
