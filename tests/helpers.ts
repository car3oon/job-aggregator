import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));

type SourceOptions = {
  process?: { env: Record<string, string | undefined>; exitCode?: NodeJS.Process["exitCode"] };
  console?: Pick<Console, "log" | "error">;
  globals?: Record<string, unknown>;
};

// Execute the real TypeScript source with explicit boundary mocks, without a database or browser.
function loadSource<T = Record<string, unknown>>(
  relativePath: string,
  mocks: Record<string, unknown> = {},
  options: SourceOptions = {},
): T {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const runtimeModule: { exports: Record<string, unknown> } = { exports: {} };
  vm.runInNewContext(code, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require: (id: string) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith("node:")) return nativeRequire(id);
      throw new Error(`Unexpected dependency: ${id}`);
    },
    process: options.process ?? { env: {} },
    console: options.console ?? { log() {}, error() {} },
    Buffer,
    URL,
    Date,
    setTimeout,
    clearTimeout,
    ...options.globals,
  }, { filename: relativePath });
  return runtimeModule.exports as T;
}

export { loadSource, root };
