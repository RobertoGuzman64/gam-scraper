import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { inspectRepositoryGovernance } from "./tests-repository-governance-guard.mjs";

const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), "eq-governance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, contents) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  write("docs/QUALITY.md", "Reglas vigentes\n");
  write("scripts/run.mjs", "export const run = true;\n");
  write("package.json", JSON.stringify({ scripts: { test: "node scripts/run.mjs" } }));
  const policy = {
    version: 2,
    maxCounts: { markdown: 1, scripts: 1 },
    npmScripts: { test: "node scripts/run.mjs" },
    npmBin: null
  };
  return { root, write, policy };
};

const findings = (fixtureValue) => inspectRepositoryGovernance(fixtureValue.root, fixtureValue.policy).findings;

test("acepta el inventario actual sin generar artefactos", (t) => {
  const value = fixture(t);
  assert.deepEqual(findings(value), []);
  assert.deepEqual(inspectRepositoryGovernance(value.root, value.policy).counts, {
    markdown: 1, scripts: 1, npmScripts: 1
  });
});

test("permite editar y eliminar documentos existentes", (t) => {
  const value = fixture(t);
  value.write("docs/QUALITY.md", "Texto actualizado\n");
  assert.deepEqual(findings(value), []);
  rmSync(join(value.root, "docs/QUALITY.md"));
  assert.deepEqual(findings(value), []);
  assert.equal(inspectRepositoryGovernance(value.root, value.policy).counts.markdown, 0);
});

test("rechaza superar el máximo de documentos aunque sean de otras carpetas", (t) => {
  const value = fixture(t);
  value.write("docs/NEW.md", "sin autorización");
  value.write("data/NOTES.md", "sin autorización");
  assert.ok(findings(value).some((item) => item.includes("Exceso de Markdown: 3 (máximo 1)")));
});

test("permite editar, eliminar y sustituir scripts dentro del máximo", (t) => {
  const value = fixture(t);
  value.write("scripts/run.mjs", "export default 2;\n");
  assert.deepEqual(findings(value), []);
  rmSync(join(value.root, "scripts/run.mjs"));
  assert.deepEqual(findings(value), []);
  value.write("tools/new.py", "print(1)\n");
  assert.deepEqual(findings(value), []);
});

test("rechaza superar el máximo de scripts desde cualquier carpeta", (t) => {
  const value = fixture(t);
  value.write("tools/new.py", "print(1)\n");
  value.write("docs/hidden.sh", "echo fail\n");
  value.write("scripts/123.ts", "export const id = '123';\n");
  assert.ok(findings(value).some((item) => item.includes("Exceso de scripts: 4 (máximo 1)")));
});

test("mantiene protegidos los comandos npm y los cambios de su contenido", (t) => {
  const value = fixture(t);
  value.write("package.json", JSON.stringify({ scripts: { test: "node scripts/changed.mjs", extra: "echo no" } }));
  assert.ok(findings(value).some((item) => item.includes("Comando npm modificado")));
  assert.ok(findings(value).some((item) => item.includes("Comando npm no autorizado")));
});

test("mantiene protegidos los puntos de entrada package bin", (t) => {
  const value = fixture(t);
  value.write("package.json", JSON.stringify({ scripts: value.policy.npmScripts, bin: "scripts/run.mjs" }));
  assert.ok(findings(value).some((item) => item.includes("package.json/bin")));
});

test("prohíbe nombres de fases en cualquier carpeta y extensión", (t) => {
  const value = fixture(t);
  for (const pathname of ["docs/OPERATIVA_F8.md", "src/phase-12.ts", "data/FASE_15.json", "src/f16-extra.ts"]) {
    value.write(pathname, "contenido");
  }
  assert.equal(findings(value).filter((item) => item.includes("Nombre de fase prohibido")).length, 4);
});

test("rechaza contratos incompletos y límites inválidos", (t) => {
  const value = fixture(t);
  assert.throws(() => inspectRepositoryGovernance(value.root, { version: 2 }), /inválido/u);
  for (const count of [-1, 0.5, "1", null]) {
    assert.throws(() => inspectRepositoryGovernance(value.root, {
      ...value.policy, maxCounts: { markdown: count, scripts: 1 }
    }), /inválido/u);
  }
});
