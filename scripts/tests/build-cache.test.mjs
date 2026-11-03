import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildInputs, fingerprint, isCurrentBuild, loadStamp, outputPaths, saveStamp, snapshot, sourcePaths } from "../build-cache.mjs";

const withBuild = (action) => {
  const root = mkdtempSync(join(tmpdir(), "equipzilla-build-inputs-"));
  try {
    mkdirSync(join(root, "src", "catalog"), { recursive: true });
    mkdirSync(join(root, "dist", "catalog"), { recursive: true });
    mkdirSync(join(root, "node_modules", "typescript"), { recursive: true });
    mkdirSync(join(root, "scripts"));
    const entries = {
      "src/catalog/example.ts": "export const value = 1;\n",
      "dist/catalog/example.js": "export const value = 1;\n",
      "tsconfig.json": "{}",
      "package.json": '{"type":"module"}',
      "package-lock.json": "{}",
      "node_modules/typescript/package.json": '{"version":"5.8.3"}',
      "scripts/run-build.mjs": "export {};\n",
      "scripts/build-cache.mjs": "export {};\n"
    };
    for (const [name, content] of Object.entries(entries)) writeFileSync(join(root, name), content);
    const sources = sourcePaths(root);
    const inputs = buildInputs(root, sources);
    saveStamp(root, fingerprint(root, inputs), snapshot(root, inputs), fingerprint(root, outputPaths(root, sources)));
    action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("reutiliza compilaciones por contenido después de copiar o tocar archivos", () => {
  withBuild((root) => {
    assert.equal(isCurrentBuild(root), true);
    const original = loadStamp(root);
    const file = join(root, "src/catalog/example.ts");
    const date = new Date(statSync(file).mtimeMs + 4000);
    utimesSync(file, date, date);
    assert.equal(isCurrentBuild(root), true);
    assert.notDeepEqual(loadStamp(root).snapshot, original.snapshot);
    assert.equal(loadStamp(root).fingerprint, original.fingerprint);
    assert.equal(isCurrentBuild(root), true);
  });
});

test("invalida cambios efectivos de fuentes, configuración y salidas compiladas", () => {
  withBuild((root) => {
    const source = join(root, "src/catalog/example.ts");
    writeFileSync(source, "export const value = 2;\n");
    assert.equal(isCurrentBuild(root), false);
    writeFileSync(source, "export const value = 1;\n");
    assert.equal(isCurrentBuild(root), true);
    writeFileSync(join(root, "dist/catalog/example.js"), "export const value = 2;\n");
    assert.equal(isCurrentBuild(root), false);
    writeFileSync(join(root, "dist/catalog/example.js"), "export const value = 1;\n");
    assert.equal(isCurrentBuild(root), true);
    writeFileSync(join(root, "tsconfig.json"), '{"strict":true}');
    assert.equal(isCurrentBuild(root), false);
  });
});

test("invalida salidas desaparecidas, fuentes nuevas y sellos corruptos", () => {
  withBuild((root) => {
    writeFileSync(join(root, "src/catalog/added.ts"), "export const added = true;\n");
    assert.equal(isCurrentBuild(root), false);
    rmSync(join(root, "src/catalog/added.ts"));
    rmSync(join(root, "dist/catalog/example.js"));
    assert.equal(isCurrentBuild(root), false);
    writeFileSync(join(root, "dist/catalog/example.js"), "export const value = 1;\n");
    writeFileSync(join(root, "dist/.tooling-build.json"), "{}\n");
    assert.equal(isCurrentBuild(root), false);
  });
});
