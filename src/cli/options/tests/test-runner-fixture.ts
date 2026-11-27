import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export const spawnRunner = (root: string, args: readonly string[], overrides: NodeJS.ProcessEnv = {}) => {
  const env: NodeJS.ProcessEnv = { ...process.env, CI: "false", NODE_OPTIONS: "", ...overrides };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [join(root, "scripts", "testing", "run-tests.mjs"), ...args],
    { cwd: root, encoding: "utf8", env });
};

export const withRunner = (action: (root: string) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "equipzilla-runner-"));
  try {
    mkdirSync(join(root, "scripts", "inspection", "tests"), { recursive: true });
    mkdirSync(join(root, "scripts", "testing"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "dist"));
    copyFileSync(join(projectRoot, "scripts", "testing", "run-tests.mjs"), join(root, "scripts", "testing", "run-tests.mjs"));
    copyFileSync(join(projectRoot, "scripts", "terminal.mjs"), join(root, "scripts", "terminal.mjs"));
    copyFileSync(join(projectRoot, "scripts", "testing", "test-performance.mjs"), join(root, "scripts", "testing", "test-performance.mjs"));
    copyFileSync(join(projectRoot, "scripts", "testing", "test-runner-observability.mjs"), join(root, "scripts", "testing", "test-runner-observability.mjs"));
    copyFileSync(join(projectRoot, "scripts", "testing", "test-runner-execution.mjs"), join(root, "scripts", "testing", "test-runner-execution.mjs"));
    copyFileSync(join(projectRoot, "scripts", "testing", "test-runner-completion.mjs"), join(root, "scripts", "testing", "test-runner-completion.mjs"));
    copyFileSync(join(projectRoot, "scripts", "testing", "test-runner-worker.mjs"), join(root, "scripts", "testing", "test-runner-worker.mjs"));
    copyFileSync(join(projectRoot, "scripts", "testing", "test-runner-ui.mjs"), join(root, "scripts", "testing", "test-runner-ui.mjs"));
    copyFileSync(join(projectRoot, "scripts", "testing", "test-result-cache.mjs"), join(root, "scripts", "testing", "test-result-cache.mjs"));
    const compilerDirectory = join(root, "node_modules", "typescript");
    mkdirSync(compilerDirectory, { recursive: true });
    copyFileSync(createRequire(import.meta.url).resolve("typescript"), join(compilerDirectory, "index.js"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "src", "prueba.test.ts"), "export {};\n");
    writeFileSync(join(root, "dist", "prueba.test.js"),
      'import test from "node:test"; test("prueba TypeScript", () => {});\n');
    writeFileSync(join(root, "scripts", "inspection", "tests", "prueba.test.mjs"),
      'import test from "node:test"; test("prueba MJS", () => {});\n');
    action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};
