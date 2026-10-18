import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { builtinModules, createRequire } from "node:module";
import { spawnSync } from "node:child_process";

export const REGISTRY =
  "https://npm.cnb.cool/lianshu-family/npm-private/-/packages/";
const SCRIPT = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const DECLARATION = /\.d\.[cm]?ts$/;
const IGNORED =
  /(^|\/)(?:node_modules|tests?|__tests__|__snapshots__|__mocks__|fixtures)(\/|$)|\.(?:test|spec|stories|snap)\.|(?:^|\/)(?:setupTestEnv|vitestSetup|vite-env)\.[cm]?[jt]sx?$/;
const SECTIONS = ["dependencies", "peerDependencies", "optionalDependencies"];
const builtins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
export function files(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Package input cannot contain symlinks: ${name}`);
    }
    return entry.isDirectory() ? files(name) : [name];
  });
}
function execute(command, args, cwd, stdio = "inherit") {
  if (process.platform === "win32" && command === "corepack") {
    const candidate = path.join(
      path.dirname(process.execPath),
      "node_modules/corepack/dist/corepack.js",
    );
    if (!fs.existsSync(candidate)) {
      throw new Error(
        "Install Corepack alongside Node.js before publishing on Windows.",
      );
    }
    args = [candidate, ...args];
    command = process.execPath;
  }
  return spawnSync(command, args, {
    cwd,
    stdio,
    encoding: "utf8",
    env: { ...process.env, COREPACK_DEFAULT_TO_LATEST: "0" },
    shell: false,
  });
}
export function run(command, args, cwd) {
  const result = execute(command, args, cwd);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
  }
}
export function pnpm(args, cwd) {
  run("corepack", ["pnpm", ...args], cwd);
}
function slash(value) {
  return value.split(path.sep).join("/");
}
function packageName(specifier) {
  return specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];
}
function isWithin(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
function specifierNodes(ts, source) {
  const result = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      result.push(node.argument.literal);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      result.push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
function moduleSource(ts, filename, text, transform, onImport) {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const replacements = [];
  for (const node of specifierNodes(ts, source)) {
    const next = transform(node.text);
    onImport?.(next);
    if (next !== node.text) {
      replacements.push([node.getStart(source) + 1, node.getEnd() - 1, next]);
    }
  }
  for (const [start, end, value] of replacements.sort((a, b) => b[0] - a[0])) {
    text = text.slice(0, start) + value + text.slice(end);
  }
  return text;
}
function resolveSource(sourceRoot, importer, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const target = path.resolve(path.dirname(importer), specifier);
  if (!isWithin(sourceRoot, target)) {
    throw new Error(
      `Sibling source import is not publishable: ${importer}: ${specifier}`,
    );
  }
  const base = target.replace(/\.[cm]?jsx?$/, "");
  const candidates = [
    target,
    `${base}.ts`,
    `${base}.tsx`,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.js`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
    `${target}/index.js`,
    `${base}.d.ts`,
  ];
  return candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
}
function runtimePath(file) {
  return file.replace(/\.(?:tsx?|jsx?)$/, ".js");
}
function transformSpecifier(unit, importer, specifier) {
  let transformed = unit.rename ? unit.rename(specifier) : specifier;
  if (transformed !== specifier || !specifier.startsWith(".")) {
    return transformed;
  }
  const resolved = resolveSource(unit.source, importer, specifier);
  if (!resolved) {
    throw new Error(`Unresolved package import: ${importer}: ${specifier}`);
  }
  transformed = slash(
    path.relative(path.dirname(importer), runtimePath(resolved)),
  );
  return transformed.startsWith(".") ? transformed : `./${transformed}`;
}
function targetFor(unit, relative) {
  const file = resolveSource(
    unit.source,
    path.join(unit.source, "__entry.ts"),
    relative.startsWith(".") ? relative : `./${relative}`,
  );
  if (!file) {
    throw new Error(`Missing export ${unit.name}: ${relative}`);
  }
  const local = slash(path.relative(unit.source, file));
  const target = `./dist/${unit.prefix}${runtimePath(local)}`;
  return SCRIPT.test(file)
    ? {
        types: `./types/${unit.prefix}${local.replace(/\.[cm]?[jt]sx?$/, ".d.ts")}`,
        import: target,
        default: target,
      }
    : target;
}
function buildUnit(ts, unit, dest, manifest) {
  const inputs = files(unit.source).filter((file) => {
    const relative = slash(path.relative(unit.source, file));
    return (
      !IGNORED.test(relative) &&
      !unit.exclude?.some((part) => relative.startsWith(part))
    );
  });
  const allowed = new Set(inputs);
  const imports = new Set();
  const outDir = path.join(dest, "dist", unit.prefix);
  const typesDir = path.join(dest, "types", unit.prefix);
  for (const file of inputs) {
    const relative = path.relative(unit.source, file);
    if (DECLARATION.test(file)) {
      continue;
    }
    const output = path.join(outDir, runtimePath(relative));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    if (!SCRIPT.test(file)) {
      let content = fs.readFileSync(file);
      if (/\.(css|less)$/.test(file) && unit.rename) {
        content = Buffer.from(
          content
            .toString()
            .replace(/@blocknote\/[\w-]+(?:\/[\w./-]+)?/g, unit.rename),
        );
      }
      if (unit.transformAsset) {
        content = unit.transformAsset(slash(relative), content);
      }
      fs.writeFileSync(output, content);
      const typeAsset = path.join(typesDir, relative);
      fs.mkdirSync(path.dirname(typeAsset), { recursive: true });
      fs.writeFileSync(typeAsset, content);
      continue;
    }
    const text = moduleSource(
      ts,
      file,
      fs.readFileSync(file, "utf8"),
      (specifier) => {
        const resolved = resolveSource(unit.source, file, specifier);
        if (resolved && !allowed.has(resolved)) {
          throw new Error(
            `Runtime import points to excluded file: ${file}: ${specifier}`,
          );
        }
        return transformSpecifier(unit, file, specifier);
      },
      (specifier) => imports.add(specifier),
    );
    const result = ts.transpileModule(text, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        verbatimModuleSyntax: false,
        isolatedModules: true,
      },
      reportDiagnostics: true,
    });
    const errors =
      result.diagnostics?.filter(
        (item) => item.category === ts.DiagnosticCategory.Error,
      ) ?? [];
    if (errors.length) {
      throw new Error(
        ts.formatDiagnosticsWithColorAndContext(errors, {
          getCurrentDirectory: () => unit.source,
          getCanonicalFileName: (value) => value,
          getNewLine: () => "\n",
        }),
      );
    }
    fs.writeFileSync(output, result.outputText);
  }
  const rootNames = inputs.filter((file) => /\.[cm]?tsx?$/.test(file));
  const program = ts.createProgram(rootNames, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    declaration: true,
    emitDeclarationOnly: true,
    noCheck: true,
    skipLibCheck: true,
    rootDir: unit.source,
    outDir: typesDir,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    esModuleInterop: true,
    types: [],
  });
  const emit = program.emit(undefined, (output, content) => {
    if (!isWithin(typesDir, output)) {
      throw new Error(`Declaration escaped package: ${output}`);
    }
    const sourceRelative = path
      .relative(typesDir, output)
      .replace(/\.d\.ts$/, ".ts");
    const importer = path.join(unit.source, sourceRelative);
    content = moduleSource(ts, output, content, (specifier) =>
      transformSpecifier(unit, importer, specifier),
    );
    if (
      content.includes("/node_modules/.pnpm/") ||
      content.includes("/Volumes/") ||
      content.includes("/Users/")
    ) {
      throw new Error(`Non-portable declaration: ${output}`);
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, content);
  });
  if (
    emit.diagnostics.some(
      (item) => item.category === ts.DiagnosticCategory.Error,
    )
  ) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(emit.diagnostics, {
        getCurrentDirectory: () => unit.source,
        getCanonicalFileName: (value) => value,
        getNewLine: () => "\n",
      }),
    );
  }
  for (const file of rootNames.filter((file) => !DECLARATION.test(file))) {
    const declaration = path.join(
      typesDir,
      path.relative(unit.source, file).replace(/\.[cm]?tsx?$/, ".d.ts"),
    );
    if (!fs.existsSync(declaration)) {
      throw new Error(`Declaration was not emitted: ${file}`);
    }
  }
  for (const file of inputs.filter((file) => DECLARATION.test(file))) {
    const output = path.join(typesDir, path.relative(unit.source, file));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      output,
      moduleSource(ts, file, fs.readFileSync(file, "utf8"), (specifier) =>
        transformSpecifier(unit, file, specifier),
      ),
    );
  }
  for (const [key, value] of Object.entries(unit.exports)) {
    manifest.exports[key] = targetFor(unit, value);
  }
  if (unit.exposeFiles) {
    for (const file of inputs) {
      const local = slash(path.relative(unit.source, file));
      if (DECLARATION.test(file)) continue;
      const extensionless = local.replace(/\.[cm]?[jt]sx?$/, "");
      const target = targetFor(unit, `./${local}`);
      manifest.exports[`./${extensionless}`] ??= target;
      if (extensionless.endsWith("/index"))
        manifest.exports[`./${extensionless.slice(0, -6)}`] ??= target;
    }
  }
  for (const specifier of imports) {
    if (
      specifier.startsWith(".") ||
      specifier.startsWith("node:") ||
      specifier.startsWith("bun:") ||
      builtins.has(specifier) ||
      packageName(specifier) === manifest.name
    ) {
      continue;
    }
    const name = packageName(specifier);
    if (!SECTIONS.some((section) => manifest[section]?.[name])) {
      throw new Error(
        `${manifest.name} imports undeclared ${name} (${specifier})`,
      );
    }
  }
}
function validatePackage(ts, dir, manifest) {
  for (const section of SECTIONS) {
    for (const [name, version] of Object.entries(manifest[section] ?? {}))
      if (/^(?:workspace:|file:|link:|catalog:)/.test(version))
        throw new Error(`Unresolved ${section}: ${name} ${version}`);
  }
  function validateTarget(target) {
    if (typeof target === "object") {
      return Object.values(target).forEach(validateTarget);
    }
    if (target.includes("*")) {
      return;
    }
    if (!target.startsWith("./") || !fs.existsSync(path.join(dir, target))) {
      throw new Error(`Missing packed export ${target}`);
    }
  }
  Object.values(manifest.exports).forEach(validateTarget);
  const dependencies = new Set(
    SECTIONS.flatMap((section) => Object.keys(manifest[section] ?? {})),
  );
  for (const file of files(path.join(dir, "dist")).filter((file) =>
    /\.(css|less)$/.test(file),
  )) {
    const css = fs.readFileSync(file, "utf8");
    for (const match of css.matchAll(
      /(?:@import\s+(?:url\()?|url\()\s*["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      if (/^(?:data:|https?:|#)/.test(specifier)) {
        continue;
      }
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier);
        if (!isWithin(dir, target) || !fs.existsSync(target)) {
          throw new Error(`Missing packed style asset: ${file}: ${specifier}`);
        }
      } else if (packageName(specifier) === manifest.name) {
        if (!manifest.exports[`.${specifier.slice(manifest.name.length)}`]) {
          throw new Error(`Missing packed style export: ${specifier}`);
        }
      } else if (!dependencies.has(packageName(specifier))) {
        throw new Error(`Undeclared style dependency: ${specifier}`);
      }
    }
    for (const match of css.matchAll(/@source\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      // Sources crossing the package boundary must address an installed dependency,
      // never the source repository's node_modules directory.
      if (
        specifier.includes("node_modules") ||
        (specifier.startsWith("../../../../") &&
          !dependencies.has(packageName(specifier.slice(12))))
      ) {
        throw new Error(`Non-portable Tailwind source: ${specifier}`);
      }
    }
  }
  for (const file of files(dir).filter((file) =>
    /\.(?:js|mjs|d\.ts)$/.test(file),
  )) {
    moduleSource(ts, file, fs.readFileSync(file, "utf8"), (specifier) => {
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier);
        if (!isWithin(dir, target)) {
          throw new Error(
            `Packed import escapes package: ${file}: ${specifier}`,
          );
        }
        const candidates = [target, target.replace(/\.js$/, ".d.ts")];
        if (!candidates.some((candidate) => fs.existsSync(candidate))) {
          throw new Error(`Packed import is missing: ${file}: ${specifier}`);
        }
      } else if (packageName(specifier) === manifest.name) {
        const subpath =
          specifier === manifest.name
            ? "."
            : `.${specifier.slice(manifest.name.length)}`;
        if (!manifest.exports[subpath]) {
          throw new Error(`Missing self export ${specifier}`);
        }
      } else if (
        !(
          specifier.startsWith("node:") ||
          specifier.startsWith("bun:") ||
          builtins.has(specifier) ||
          dependencies.has(packageName(specifier))
        )
      ) {
        throw new Error(`Undeclared packed dependency ${specifier}`);
      }
      return specifier;
    });
  }
}
export async function release(config) {
  const [command, ...args] = process.argv.slice(2);
  if (!["check", "prepare"].includes(command)) {
    throw new Error(
      "Usage: node scripts/cnb-release.mjs check | prepare --version X.Y.Z --out ABS_DIR",
    );
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      !["--version", "--out"].includes(args[index]) ||
      !args[index + 1] ||
      options[args[index]]
    ) {
      throw new Error(`Invalid argument ${args[index]}`);
    }
    options[args[index]] = args[index + 1];
  }
  const version = options["--version"] ?? config.version;
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(
      version,
    )
  ) {
    throw new Error(`Invalid release version: ${version}`);
  }
  if (
    command === "prepare" &&
    (!options["--version"] ||
      !options["--out"] ||
      !path.isAbsolute(options["--out"]))
  ) {
    throw new Error("prepare requires explicit --version and absolute --out");
  }
  const out =
    command === "check"
      ? fs.mkdtempSync(path.join(os.tmpdir(), "lianshu-cnb-check-"))
      : path.resolve(options["--out"]);
  if (fs.existsSync(path.join(out, "release-manifest.json"))) {
    throw new Error(
      `Output already contains a release; use an empty directory: ${out}`,
    );
  }
  fs.mkdirSync(out, { recursive: true });
  const req = createRequire(path.join(config.root, "package.json"));
  const ts = req(config.compiler ?? "typescript");
  await config.check?.();
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "lianshu-cnb-stage-"));
  const result = [];
  try {
    for (const pkg of config.packages(version)) {
      const dir = path.join(
        stage,
        pkg.manifest.name.replaceAll("/", "-").replace("@", ""),
      );
      const manifest = {
        ...pkg.manifest,
        version,
        packageManager: readJson(path.join(config.root, "package.json"))
          .packageManager,
        private: false,
        type: "module",
        files: ["dist", "types", "native", "scripts", "LICENSE", "README.md"],
        sideEffects: ["**/*.css", "**/*.less"],
        publishConfig: { registry: REGISTRY, access: "restricted" },
        exports: { "./package.json": "./package.json" },
      };
      delete manifest.devDependencies;
      delete manifest.scripts;
      delete manifest.source;
      delete manifest.gitHead;
      fs.mkdirSync(dir, { recursive: true });
      for (const unit of pkg.units) {
        buildUnit(ts, unit, dir, manifest);
      }
      if (manifest.exports["."]) {
        const rootExport = manifest.exports["."];
        manifest.main =
          typeof rootExport === "string" ? rootExport : rootExport.import;
        manifest.module = manifest.main;
        manifest.types =
          typeof rootExport === "string" ? undefined : rootExport.types;
      }
      for (const asset of pkg.assets ?? []) {
        const target = path.join(dir, asset.target);
        fs.cpSync(asset.source, target, { recursive: true });
        if (asset.transform) {
          for (const file of files(target))
            if (file.endsWith(".rs"))
              fs.writeFileSync(
                file,
                asset.transform(fs.readFileSync(file, "utf8")),
              );
        }
        if (asset.export) {
          manifest.exports[asset.export] =
            `./${slash(asset.target)}${asset.export.endsWith("/*") ? "/*" : ""}`;
        }
      }
      writeJson(path.join(dir, "package.json"), manifest);
      validatePackage(ts, dir, manifest);
      const before = new Set(fs.readdirSync(out));
      const packed = execute(
        "corepack",
        ["pnpm", "pack", "--pack-destination", out],
        dir,
        "pipe",
      );
      if (packed.error || packed.status !== 0) {
        throw new Error(
          `Failed to pack ${manifest.name}: ${packed.error?.message ?? packed.stderr ?? packed.stdout}`,
        );
      }
      const tarballs = fs
        .readdirSync(out)
        .filter((name) => name.endsWith(".tgz") && !before.has(name));
      if (tarballs.length !== 1) {
        throw new Error(`Expected one tarball for ${manifest.name}`);
      }
      result.push({ name: manifest.name, version, tarball: tarballs[0] });
    }
    writeJson(path.join(out, "release-manifest.json"), {
      version,
      registry: REGISTRY,
      packages: result,
    });
    console.log(`Prepared ${result.length} private package(s): ${out}`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
  return out;
}
