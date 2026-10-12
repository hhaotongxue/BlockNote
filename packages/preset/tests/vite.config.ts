import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL("../../../", import.meta.url)),
  test: {
    include: [
      "packages/preset/tests/code-block.test.ts",
      "packages/preset/tests/media-card.test.tsx",
      "packages/preset/tests/media-layout.test.tsx",
    ],
  },
});
