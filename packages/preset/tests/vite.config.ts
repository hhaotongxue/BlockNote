import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL("../../../", import.meta.url)),
  resolve: {
    alias: {
      "@blocknote/math-block": fileURLToPath(
        new URL("../../math-block/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: [
      "packages/preset/tests/code-block.test.ts",
      "packages/preset/tests/document-content.test.ts",
      "packages/preset/tests/media-card.test.tsx",
      "packages/preset/tests/media-layout.test.tsx",
      "packages/preset/tests/document-outline.test.tsx",
    ],
  },
});
