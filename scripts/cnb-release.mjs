import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { release, readJson, run, files } from "./cnb-pack.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = [
  "core",
  "react",
  "mantine",
  "code-block",
  "math-block",
  "preset",
];
const packageName = "@lianshu/blocknote";
let vendorSource;
function preparePatchedYBinding() {
  const installed = path.join(
    root,
    "packages/core/node_modules/@y/prosemirror",
  );
  const manifest = readJson(path.join(installed, "package.json"));
  if (
    manifest.version !== "2.0.0-6" ||
    !fs
      .readFileSync(path.join(installed, "src/index.js"), "utf8")
      .includes("deltaAttributionToFormat")
  ) {
    throw new Error(
      "Install the locked, patched @y/prosemirror dependency before packing.",
    );
  }
  vendorSource = fs.mkdtempSync(path.join(os.tmpdir(), "lianshu-y-binding-"));
  fs.cpSync(path.join(installed, "src"), vendorSource, { recursive: true });
  for (const declaration of files(path.join(installed, "dist/src")).filter(
    (file) => file.endsWith(".d.ts"),
  )) {
    const output = path.join(
      vendorSource,
      path.relative(path.join(installed, "dist/src"), declaration),
    );
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      output,
      fs
        .readFileSync(declaration, "utf8")
        .replace(/^\/\/# sourceMappingURL=.*$/gm, ""),
    );
  }
  fs.copyFileSync(
    path.join(installed, "LICENSE"),
    path.join(vendorSource, "LICENSE"),
  );
  return {
    name: "patched-y-prosemirror",
    source: vendorSource,
    prefix: "vendor/y-prosemirror/",
    rename,
    exports: { "./vendor/y-prosemirror": "./index.js" },
  };
}
function rename(specifier) {
  if (specifier === "@y/prosemirror") {
    return `${packageName}/vendor/y-prosemirror`;
  }
  if (!specifier.startsWith("@blocknote/")) {
    return specifier;
  }
  const module = specifier.split("/")[1];
  if (!modules.includes(module)) {
    throw new Error(`Unpackaged BlockNote dependency ${specifier}`);
  }
  return `${packageName}/${specifier.slice("@blocknote/".length)}`;
}
function packages() {
  const manifests = modules.map((name) =>
    readJson(path.join(root, "packages", name, "package.json")),
  );
  const dependencies = {};
  const peerDependencies = {};
  const peerDependenciesMeta = {};
  for (const manifest of manifests) {
    for (const [name, value] of Object.entries(manifest.dependencies ?? {})) {
      if (!name.startsWith("@blocknote/")) dependencies[name] ??= value;
    }
    for (const [name, value] of Object.entries(
      manifest.optionalDependencies ?? {},
    )) {
      if (!name.startsWith("@blocknote/")) dependencies[name] ??= value;
    }
    for (const [name, value] of Object.entries(
      manifest.peerDependencies ?? {},
    )) {
      if (
        name === "@y/prosemirror" ||
        name.startsWith("@blocknote/") ||
        (manifest.name === "@blocknote/math-block" &&
          !["react", "react-dom"].includes(name))
      ) {
        continue;
      }
      peerDependencies[name] ??= value;
      if (manifest.peerDependenciesMeta?.[name]) {
        peerDependenciesMeta[name] = manifest.peerDependenciesMeta[name];
      }
    }
  }
  // Upstream lists icons as a development dependency although runtime components import them.
  dependencies["react-icons"] = manifests.find(
    (item) => item.name === "@blocknote/react",
  ).devDependencies["react-icons"];
  // Keep the same ProseMirror model identity used by this fork's workspace override.
  dependencies["prosemirror-model"] = "1.25.12";
  const entries = {
    core: {
      "./core": "./index.ts",
      "./core/comments": "./comments/index.ts",
      "./core/blocks": "./blocks/index.ts",
      "./core/locales": "./i18n/index.ts",
      "./core/extensions": "./extensions/index.ts",
      "./core/yjs": "./yjs/index.ts",
      "./core/y": "./y/index.ts",
      "./core/style.css": "./style.css",
      "./core/fonts/inter.css": "./fonts/inter.css",
    },
    react: {
      "./react": "./index.ts",
      "./react/style.css": "./editor/styles.css",
    },
    mantine: {
      "./mantine": "./index.tsx",
      "./mantine/style.css": "./style.css",
      "./mantine/blocknoteStyles.css": "./blocknoteStyles.css",
    },
    "code-block": { "./code-block": "./index.ts" },
    "math-block": { "./math-block": "./index.ts" },
    preset: {
      ".": "./index.ts",
      "./preset": "./index.ts",
      "./preset/document": "./document.ts",
      "./preset/document-content": "./documentContent.ts",
      "./preset/style.css": "./style.css",
      "./preset/page.module.less": "./page.module.less",
      "./preset/document-materials.module.css":
        "./document-materials.module.css",
    },
  };
  return [
    {
      manifest: {
        name: packageName,
        description:
          "Lianshu customized BlockNote editor, UI and document preset",
        license: "MPL-2.0",
        dependencies,
        peerDependencies,
        peerDependenciesMeta,
      },
      units: [
        ...modules.map((name) => ({
          name,
          source: path.join(root, "packages", name, "src"),
          prefix: `${name}/`,
          rename,
          exports: entries[name],
          exclude:
            name === "math-block"
              ? [
                  "docx-exporter/",
                  "odt-exporter/",
                  "email-exporter/",
                  "typst-exporter/",
                  "exporterHelpers/",
                ]
              : [],
        })),
        preparePatchedYBinding(),
      ],
      assets: [
        { source: path.join(root, "LICENSE.txt"), target: "LICENSE" },
        {
          source: path.join(root, "docs/lianshu/npm-release.md"),
          target: "README.md",
        },
      ],
    },
  ];
}
try {
  await release({
    root,
    compiler: "typescript-packaging",
    version: "0.55.1",
    packages,
    check() {
      const tests = fs
        .readdirSync(path.join(root, "packages/preset/tests"))
        .filter((name) => name.endsWith(".test.mjs"))
        .map((name) => `packages/preset/tests/${name}`);
      run(
        process.execPath,
        ["--experimental-strip-types", "--test", ...tests],
        root,
      );
    },
  });
} finally {
  if (vendorSource) {
    fs.rmSync(vendorSource, { recursive: true, force: true });
  }
}
