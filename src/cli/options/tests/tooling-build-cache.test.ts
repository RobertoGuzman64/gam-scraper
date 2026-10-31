import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const buildScript = join(root, "scripts/run-build.mjs");
const terminalScript = join(root, "scripts/terminal.mjs");

const invoke = (directory: string, args: readonly string[] = []): void => {
  const result = spawnSync(process.execPath, ["scripts/run-build.mjs", "--quiet", ...args], {
    cwd: directory, encoding: "utf8", windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};

const compilationCount = (directory: string): number =>
  Number(readFileSync(join(directory, "count.txt"), "utf8"));

test("el tooling reutiliza un build íntegro e invalida la caché ante cambios", () => {
  const directory = mkdtempSync(join(tmpdir(), "equipzilla-build-cache-"));
  try {
    mkdirSync(join(directory, "scripts"));
    mkdirSync(join(directory, "src", "cli"), { recursive: true });
    mkdirSync(join(directory, "node_modules", "typescript", "bin"), { recursive: true });
    copyFileSync(buildScript, join(directory, "scripts/run-build.mjs"));
    copyFileSync(terminalScript, join(directory, "scripts/terminal.mjs"));
    writeFileSync(join(directory, "package.json"), '{"type":"module"}');
    writeFileSync(join(directory, "package-lock.json"), '{}');
    writeFileSync(join(directory, "tsconfig.json"), '{"compilerOptions":{"outDir":"dist"}}');
    writeFileSync(join(directory, "node_modules/typescript/package.json"), '{"version":"5.8.3"}');
    writeFileSync(join(directory, "src/cli/program.ts"), 'export const value = 1;\n');
    writeFileSync(join(directory, "node_modules/typescript/bin/tsc"), `
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const count = existsSync("count.txt") ? Number(readFileSync("count.txt", "utf8")) : 0;
mkdirSync("dist/cli", { recursive: true });
writeFileSync("dist/cli/program.js", "export const value = 1;\\n");
writeFileSync("count.txt", String(count + 1));
`);
    invoke(directory, ["--if-needed"]);
    assert.equal(compilationCount(directory), 1);
    invoke(directory, ["--if-needed"]);
    assert.equal(compilationCount(directory), 1);
    writeFileSync(join(directory, "src/cli/program.ts"), 'export const value = 2;\n');
    invoke(directory, ["--if-needed"]);
    assert.equal(compilationCount(directory), 2);
    writeFileSync(join(directory, "tsconfig.json"), '{"compilerOptions":{"outDir":"dist","strict":true}}');
    invoke(directory, ["--if-needed"]);
    assert.equal(compilationCount(directory), 3);
    rmSync(join(directory, "dist/cli/program.js"));
    invoke(directory, ["--if-needed"]);
    assert.equal(compilationCount(directory), 4);
    invoke(directory);
    assert.equal(compilationCount(directory), 5);
    assert.ok(existsSync(join(directory, "dist/.tooling-build.json")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
