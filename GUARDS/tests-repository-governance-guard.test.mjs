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
    version: 3,
    maxCounts: { markdown: 1, scripts: 1 },
    allowedPaths: { markdown: ["docs/QUALITY.md"], scripts: ["scripts/run.mjs"] },
    npmScripts: { test: "node scripts/run.mjs" },
    npmBin: null
  };
  return { root, write, policy };
};

const findings = (fixtureValue) => inspectRepositoryGovernance(fixtureValue.root, fixtureValue.policy).findings;

test("acepta el inventario autorizado sin generar artefactos", (t) => {
  const value = fixture(t);
  assert.deepEqual(findings(value), []);
  assert.deepEqual(inspectRepositoryGovernance(value.root, value.policy).counts, {
    markdown: 1, scripts: 1, npmScripts: 1
  });
});

test("permite editar y eliminar documentos existentes sin controlar el contenido", (t) => {
  const value = fixture(t);
  value.write("docs/QUALITY.md", "Texto actualizado\n");
  assert.deepEqual(findings(value), []);
  rmSync(join(value.root, "docs/QUALITY.md"));
  assert.deepEqual(findings(value), []);
  assert.equal(inspectRepositoryGovernance(value.root, value.policy).counts.markdown, 0);
});

test("rechaza documentos nuevos aunque no se supere el máximo", (t) => {
  const value = fixture(t);
  rmSync(join(value.root, "docs/QUALITY.md"));
  value.write("data/NEW.md", "sin autorización");
  assert.deepEqual(findings(value), ["Markdown no autorizado: data/NEW.md"]);
});

test("rechaza superar el máximo de documentos aunque sean de otras carpetas", (t) => {
  const value = fixture(t);
  value.write("docs/NEW.md", "sin autorización");
  value.write("data/NOTES.md", "sin autorización");
  assert.ok(findings(value).some((item) => item.includes("Exceso de Markdown: 3 (máximo 1)")));
});

test("permite editar y eliminar scripts existentes sin controlar el contenido", (t) => {
  const value = fixture(t);
  value.write("scripts/run.mjs", "export default 2;\n");
  assert.deepEqual(findings(value), []);
  rmSync(join(value.root, "scripts/run.mjs"));
  assert.deepEqual(findings(value), []);
});

test("rechaza scripts añadidos o sustituidos dentro del máximo", (t) => {
  const value = fixture(t);
  rmSync(join(value.root, "scripts/run.mjs"));
  value.write("tools/new.py", "print(1)\n");
  assert.deepEqual(findings(value), ["Script no autorizado: tools/new.py"]);
});

test("rechaza un script añadido fuera de las carpetas habituales", (t) => {
  const value = fixture(t);
  value.write("src/preparation/auxiliary.mjs", "export {};\n");
  assert.ok(findings(value).includes("Script no autorizado: src/preparation/auxiliary.mjs"));
});

test("rechaza superar el máximo de scripts desde cualquier carpeta", (t) => {
  const value = fixture(t);
  value.write("tools/new.py", "print(1)\n");
  value.write("docs/hidden.sh", "echo fail\n");
  value.write("scripts/123.ts", "export const id = '123';\n");
  assert.ok(findings(value).some((item) => item.includes("Exceso de scripts: 4 (máximo 1)")));
});

test("rechaza scripts y documentación temporal sin depender de la extensión", (t) => {
  const value = fixture(t);
  value.write("docs/notes.tmp", "borrador\n");
  value.write("scripts/scratch.txt", "prueba\n");
  value.write("src/preparation/temp-audit.ts", "export const run = true;\n");
  const result = findings(value);
  assert.ok(result.includes("Archivo temporal prohibido: docs/notes.tmp"));
  assert.ok(result.includes("Archivo temporal prohibido: scripts/scratch.txt"));
  assert.ok(result.includes("Archivo temporal prohibido: src/preparation/temp-audit.ts"));
});

test("rechaza archivos encubiertos en las carpetas de documentación y scripts", (t) => {
  const value = fixture(t);
  value.write("docs/nota.txt", "texto\n");
  value.write("scripts/nota.txt", "texto\n");
  value.write("GUARDS/otro.json", "{}\n");
  const result = findings(value);
  assert.ok(result.includes("Archivo no autorizado en docs/: docs/nota.txt"));
  assert.ok(result.includes("Archivo no autorizado en scripts/: scripts/nota.txt"));
  assert.ok(result.includes("Archivo no autorizado en GUARDS/: GUARDS/otro.json"));
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

test("rechaza contratos incompletos, rutas duplicadas y límites inválidos", (t) => {
  const value = fixture(t);
  assert.throws(() => inspectRepositoryGovernance(value.root, { version: 3 }), /inválido/u);
  for (const count of [-1, 0.5, "1", null]) {
    assert.throws(() => inspectRepositoryGovernance(value.root, {
      ...value.policy, maxCounts: { markdown: count, scripts: 1 }
    }), /inválido/u);
  }
  for (const pathname of ["../escape.md", "/docs/NEW.md", "docs\\BAD.md", "storage/hidden.md", "scripts/run.mjs"]) {
    assert.throws(() => inspectRepositoryGovernance(value.root, {
      ...value.policy, allowedPaths: { markdown: [pathname], scripts: ["scripts/run.mjs"] }
    }), /inválido/u);
  }
  assert.throws(() => inspectRepositoryGovernance(value.root, {
    ...value.policy, allowedPaths: { markdown: ["docs/QUALITY.md", "docs/QUALITY.md"], scripts: ["scripts/run.mjs"] }
  }), /inválido/u);
  assert.throws(() => inspectRepositoryGovernance(value.root, {
    ...value.policy, maxCounts: { markdown: 2, scripts: 1 }
  }), /inválido/u);
});
