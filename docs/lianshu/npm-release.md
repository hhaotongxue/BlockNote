# 炼书私有编辑器包

本仓库为产品发布一个私有包 `@lianshu/blocknote`。Core、React、Mantine、preset、code-block 和 math-block 一起打包，内部导入全部使用该包自己的子入口，不依赖官方 `@blocknote/*` 包或本地兄弟目录。编辑器引擎和 CSS 不作行为改动。

```sh
corepack pnpm install --frozen-lockfile
node scripts/cnb-release.mjs check
node scripts/cnb-release.mjs prepare --version 0.55.1 --out /absolute/output/path
```

Windows 也支持该命令；`--out` 使用本机绝对路径，例如 `D:\releases\blocknote-0.55.1`。prepare 执行 preset 策略测试，编译 ESM 和类型声明，校验导入、导出和依赖，生成 `.tgz` 与 `release-manifest.json`。临时构建不会修改源代码版本。每次发布使用新的明确版本，不能覆盖已有版本。

lianshu-ship 调用 prepare 后向 CNB 上传 tarball。发布凭证仅存在发布台环境 `CNB_TOKEN` 中，不能写入源码或包文件。包限定发布地址 `https://npm.cnb.cool/lianshu-family/npm-private/-/packages/`，访问级别为 restricted。源码仓库仍为 private，禁止直接发布根目录。

消费入口：`@lianshu/blocknote/core`、`/react`、`/mantine`、`/code-block`、`/math-block`、`/preset`；保留 `/core/locales`、`/core/extensions`、`/core/yjs`、`/preset/document`、`/preset/document-content` 以及原 CSS/Less 子入口。ESM 保留 CSS Modules 与 Less，由产品的 Vite/Next 构建器处理。数学编辑功能包含在包内；本次不发布未被产品使用的高级文档导出器。

发布构建生成类型声明，同时消费项目仍须运行自身的类型检查和构建。Windows 安装、DEV 和实际安装包升级必须在 Windows 环境验收。

## 协作功能依赖

React/ReactDOM 和 Mantine 是宿主 peer，所有产品使用各自的一份实例。`/core/yjs` 为 Yjs 13 协作入口，使用它的产品需显式安装 `yjs@^13.6.27`、`y-prosemirror@^1.3.7` 和 `y-protocols@^1.0.6`；不使用协作的只读渲染器无需安装。`/core/y` 是可选 Yjs 14 入口，需要 `@y/y@14.0.0-rc.23` 与 `@y/protocols@^1.0.6-rc.1`。fork 对 `@y/prosemirror@2.0.0-6` 的运行时修补随单包 vendor 目录分发，不要求消费者再次应用 pnpm patch，也不会退回未修补的上游实现。vendor 中保留其 MIT 许可证。
