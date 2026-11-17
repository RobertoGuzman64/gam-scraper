import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { inspectRepositoryGovernance } from "./tests-repository-governance-guard.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
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
    version: 1,
    markdown: { "docs/QUALITY.md": hash("Reglas vigentes\n") },
    scripts: { "scripts/run.mjs": hash("export const run = true;\n") },
    npmScripts: { test: "node scripts/run.mjs" },
    npmBin: null
  };
  return { root, write, policy };
};

const findings = (fixtureValue) => inspectRepositoryGovernance(fixtureValue.root, fixtureValue.policy).findings;

test("acepta inventario exacto sin generar artefactos", (t) => {
  const value = fixture(t);
  assert.deepEqual(findings(value), []);
  assert.deepEqual(inspectRepositoryGovernance(value.root, value.policy).counts, {
    markdown: 1, scripts: 1, npmScripts: 1
  });
});

test("bloquea altas, edición y eliminación de documentación", (t) => {
  const value = fixture(t);
  value.write("docs/NEW.md", "sin autorización");
  assert.ok(findings(value).some((item) => item.includes("Markdown no autorizado")));
  value.write("docs/QUALITY.md", "modificada");
  assert.ok(findings(value).some((item) => item.includes("Markdown modificado")));
  rmSync(join(value.root, "docs/QUALITY.md"));
  assert.ok(findings(value).some((item) => item.includes("Markdown eliminado")));
});

test("bloquea altas, edición y eliminación de scripts", (t) => {
  const value = fixture(t);
  value.write("scripts/extra.mjs", "export default 1;");
  assert.ok(findings(value).some((item) => item.includes("Script no autorizado")));
  value.write("scripts/run.mjs", "export default 2;");
  assert.ok(findings(value).some((item) => item.includes("Script modificado")));
  rmSync(join(value.root, "scripts/run.mjs"));
  assert.ok(findings(value).some((item) => item.includes("Script eliminado")));
});

test("bloquea scripts fuera de scripts y ejecutables de intervención", (t) => {
  const value = fixture(t);
  value.write("tools/new.py", "print(1)\n");
  value.write("docs/hidden.sh", "echo fail\n");
  value.write("interventions/gam/123.ts", "export const id = '123';\n");
  assert.equal(findings(value).filter((item) => item.includes("Script no autorizado")).length, 3);
});

test("bloquea nuevos comandos npm y cambios en los existentes", (t) => {
  const value = fixture(t);
  value.write("package.json", JSON.stringify({ scripts: { test: "node scripts/changed.mjs", extra: "echo no" } }));
  assert.ok(findings(value).some((item) => item.includes("Comando npm modificado")));
  assert.ok(findings(value).some((item) => item.includes("Comando npm no autorizado")));
});

test("bloquea puntos de entrada package bin", (t) => {
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

test("rechaza contrato sin inventarios completos", (t) => {
  const value = fixture(t);
  assert.throws(() => inspectRepositoryGovernance(value.root, { version: 1 }), /inválido/u);
});
