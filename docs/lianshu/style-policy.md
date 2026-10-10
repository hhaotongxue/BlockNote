# lianshu 的 BlockNote 样式定制约定

## 源码来源与范围

唯一开发源码：`/Volumes/lianshu/code/lianshu-family/BlockNote`。
远程仓库：`https://github.com/hhaotongxue/BlockNote.git`。
基线提交：`5ef97ba46`，包版本 `0.55.0`（不等同于 npm 发布标签对应源码）。
消费项目：`/Volumes/lianshu/code/open-source/lianshu`。

本 fork 只定制视觉样式，不修改任何业务或编辑行为。应用侧的数据迁移、保存兼容、AI 接入属于 lianshu 的独立工作，不能借样式定制之名修改 BlockNote 逻辑。

## 允许修改的文件

| 文件                                       | 职责与允许调整                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `packages/core/src/editor/Block.css`       | 段落、标题、列表、引用、代码块、表格的视觉排版；字号、字重、行高、字距、颜色和经过验证的间距 |
| `packages/core/src/editor/editor.css`      | 编辑器基础字体、默认正文字号和链接等基础表现；保留光标、选区、拖拽和定位相关规则             |
| `packages/react/src/editor/styles.css`     | `--bn-*` 主题变量、明暗色、字体和视觉状态；不修改滚动行为、表单语义及无障碍规则              |
| `packages/mantine/src/blocknoteStyles.css` | 当前使用的 Mantine 皮肤：工具栏、菜单、弹层、按钮的视觉表现                                  |

当前正文还原优先处理前两个文件；只有涉及主题或工具栏时才改后两个。
允许在上述文件中把重复视觉值整理为 CSS 变量，并在原规则处引用，不在文件尾反复叠加覆盖。

入口链路：Mantine `src/style.css` → `blocknoteStyles.css` → React `style.css`（生产构建产物）→ React `editor/styles.css` → Core `style.css` → `editor/Block.css` 与 `editor/editor.css`。
注意 React `src/style.css` 是官方开发占位文件，不能把主题写进去；开发源码接入必须加载真实 `editor/styles.css`。

## 不修改的内容

- 所有运行时代码 `.ts` / `.tsx` / `.js`：包括夹带在组件里的 className、内联 style、render 和 DOM 层级。需要调整时先提出范围变化，不能自行突破本约定。
- `packages/core/src/editor/BlockNoteEditor.ts`、`api/`、`extensions/`、`pm-nodes/`、`schema/`、`yjs/`、`y/` 及块实现文件。
- React hooks、事件、菜单控制器、拖拽算法、键盘处理、输入法、选区、撤销、剪贴板、序列化和协作逻辑。
- `packages/mantine/src/BlockNoteTheme.ts` 与各皮肤 `BlockNoteView.tsx`。
- 不修改其他未使用皮肤，不修改 `mantineStyles.css` 的第三方样式引入集合，不编辑 `dist/`、`types/`、`node_modules/` 或为通过测试重写快照。
- 依赖、构建配置、本地接入规则和文档可作为单独的基础设施变更；与样式提交分开，不升级编辑引擎依赖来实现视觉调整。

## CSS 中的行为边界

只改 CSS 不代表可以保证行为百分百不变；字体和间距会改变测量结果，仍需回归。
保留 `.bn-block` / `.bn-block-content` 的布局骨架、列表标记 `height: 0; overflow: visible`、空文字最小宽度、white-space、选区定位、拖拽命中区域、pointer-events、滚动行为、隐藏辅助表单及无障碍规则。
不机械删除上游已有的 `!important`，其中可能包含光标兼容修复；定制样式不新增 `!important`。
编辑器侧边保留拖拽操作空间，当前源码默认 `padding-inline: 54px`；没有适用于所有场景的固定“最佳 48px”。
字号和行高按正文、标题、代码等类型分别定义，避免统一设置 `.bn-inline-content` 后覆盖标题、代码字体和用户文字颜色。
间距不限定为只能改 margin；遵循现有布局，避免 margin 与标题原有 padding 重复叠加。`:has()` 必须约束到当前块的直接层级，不能误匹配嵌套子标题。

## 修改与验收流程

1. 用相同文档、窗口宽度、缩放和字体环境测量旧版字体、字重、行高、正文宽度、缩进与间距。
2. 在原 CSS 规则处修改，集中变量；先正文与标题，再列表与链接，再工具栏。
3. 每次提交检查 diff：仅目标 CSS 与必要文档，不能混入逻辑修改。
4. 验证中文输入法、空段落、换行、多级列表、任务列表、代码、表格、长链接、图片、跨块选区、拖拽、菜单定位、撤销重做及明暗主题。
5. 官方浏览器测试遵循仓库 AGENTS.md，在 Docker 中运行，不生成本机平台基准快照。
6. 上游更新单独提交，审查 DOM、CSS 和定位代码变更；样式修改单独提交。保留上游许可证与版权声明。

## 本地消费

lianshu 的 Vite 配置通过 `BLOCKNOTE_SOURCE_DIR` 指定源码，默认解析本目录；Core、React、Mantine 必须一起走同一份源码，开发与生产构建一致，不混用 npm 的逻辑和 fork 的样式。
先在本仓库按 packageManager 安装依赖，再在 lianshu 启动开发服务器。源码别名不会替代依赖安装。
禁止在找不到 fork 或其依赖时静默退回 npm。发布到其他机器前，应将 fork 构建成有独立版本标识的包并固定来源，不依赖个人绝对路径。
