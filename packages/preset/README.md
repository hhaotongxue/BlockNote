# @blocknote/preset

统一可复用的编辑器 UI。此包提供源码（TSX/CSS/Less），适用于 Vite 等支持源码依赖的构建器，不依赖 lianshu 或 AFFiNE 运行时。

```tsx
import { EditorView } from "@blocknote/preset";
import "@blocknote/preset/style.css";
// editor 由 useCreateBlockNote 创建，可传业务 schema/uploadFile。
<EditorView editor={editor} theme="light" onChange={saveDocument} />;
```

`EditorView` 自动安装菜单、工具栏、Lucide 图标、侧边按钮定位、勾选动画和禁止新建折叠块策略；原有折叠块仍可展示、编辑和撤销恢复。children 用于文档引用菜单等业务扩展。

需要完整文档页面时，引用 `@blocknote/preset/page.module.less` 的页面类，并在外层加 `bn-preset-page` 和 `data-theme="light"` / `"dark"`。标题使用 `lianshu-blocknote-title` 类。名称保留是为了迁移时不改变现有 DOM。所有宽度、对齐与主题样式都在本仓库维护。

安装本 fork 同版本的 core/react/mantine/preset，以及 React、ReactDOM、Mantine 8/9 和 Less。工作区开发可将四包统一 alias 到源码；发布用 pnpm pack（workspace 依赖会转换版本），将四包一起发布到自己的 registry，固定版本。不要仅安装 npm 上游同名包。

主题继承宿主通用颜色变量，同时提供独立浅色/深色默认值。消费者不应写编辑器 CSS 覆盖。勾选动画来自 BlockSuite MPL-2.0，来源保留在 checkAnimation.ts。

## 本地准备

```sh
corepack pnpm@11.8.0 install
corepack pnpm@11.8.0 exec vp run --filter @blocknote/core --filter @blocknote/react --filter @blocknote/mantine build
```

基础包构建生成声明文件。消费项目的 TypeScript 和 Vite 都应解析同一个 fork，不能分别使用 npm 类型与 fork 运行时。源码包本身不需要额外编译；由消费项目打包。此变更未发布 registry。

## 统一提示

菜单、工具栏和页面图标统一使用导出的 `EditorTooltip`。传 `label` 与一个可接收 ref 的子元素；页面外使用时可传 `colorScheme="light"` / `"dark"`。编辑器浮层内可通过 `portalProps.target` 指向 `usePortalElement()` 返回的主题容器。不要直接使用 Mantine Tooltip、原生 title 或 CSS 伪元素另画一层提示。背景、字体、留白统一由 Mantine 皮肤的 tooltip 规则维护。
