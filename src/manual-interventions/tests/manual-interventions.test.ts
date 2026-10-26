import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import type { ManualInterventionProposal } from "../contracts.js";
import { validateInterventionProposals } from "../proposals.js";
import { loadInterventionScript } from "../script-loader.js";
import { validateInterventionScriptSelection } from "../script-location.js";

const base: ManualInterventionProposal = {
  providerId: "gam",
  identity: "gam:ref:caso-prueba",
  field: "shortDescription",
  expected: "Texto anterior",
  next: "Texto revisado",
  reason: "Incidencia puntual acreditada",
  evidence: "Ficha de producto revisada"
};

const makeScript = (content: string): { path: string; cleanup: () => void } => {
  mkdirSync(join("storage", "interventions"), { recursive: true });
  const folder = mkdtempSync(join("storage", "interventions", "intervention-script-test-"));
  mkdirSync(join(folder, "scripts"));
  const path = join(folder, "scripts", "intervencion.ts");
  writeFileSync(path, content, "utf8");
  return { path, cleanup: () => rmSync(folder, { recursive: true, force: true }) };
};

const validScript = `import type { ManualInterventionProposal } from "../../../../src/manual-interventions/contracts.js";
export const proposals = [{
  providerId: "gam", identity: "gam:ref:caso-prueba", field: "shortDescription",
  expected: "Texto anterior", next: "Texto revisado",
  reason: "Incidencia puntual acreditada", evidence: "Ficha de producto revisada"
}] satisfies readonly ManualInterventionProposal[];
`;

test("carga el script TS explícito, tipado, sin generar compilados ni tocar su fuente", async () => {
  const entry = makeScript(validScript);
  try {
    const before = readFileSync(entry.path);
    const contents = readdirSync(dirname(entry.path));
    const proposals = await loadInterventionScript(entry.path, "gam");
    assert.deepEqual(proposals, [base]);
    assert.deepEqual(readFileSync(entry.path), before);
    assert.deepEqual(readdirSync(dirname(entry.path)), contents);
  } finally {
    entry.cleanup();
  }
});

test("rechaza imágenes, identidad y propiedades inesperadas incluso sin tipado estático", () => {
  assert.throws(() => validateInterventionProposals([{ ...base, field: "images" }], "gam"), /campo prohibido/);
  assert.throws(() => validateInterventionProposals([{ ...base, field: "serialNumber" }], "gam"), /campo prohibido/);
  assert.throws(() => validateInterventionProposals([{ ...base, image: "https:\/\/ejemplo.test\/foto.jpg" }], "gam"), /propiedad no permitida/);
});

test("rechaza duplicados, evidencia ausente, diferencias sin cambio y proveedor incorrecto", () => {
  assert.throws(() => validateInterventionProposals([base, base], "gam"), /duplicada/);
  assert.throws(() => validateInterventionProposals([{ ...base, evidence: "" }], "gam"), /evidence/);
  assert.throws(() => validateInterventionProposals([{ ...base, next: base.expected }], "gam"), /coincide/);
  assert.throws(() => validateInterventionProposals([base], "gomariz"), /proveedor diferente/);
  assert.throws(() => validateInterventionProposals([{ ...base, identity: "gomariz:ref:x" }], "gam"), /identidad incompatible/);
});

test("rechaza errores de TypeScript antes de evaluar el módulo", async () => {
  const entry = makeScript(validScript.replace('field: "shortDescription"', 'field: "images"'));
  try {
    await assert.rejects(loadInterventionScript(entry.path, "gam"), /TypeScript inválido/);
  } finally {
    entry.cleanup();
  }
});

test("rechaza importaciones de ejecución y dinámicas", async () => {
  const direct = makeScript('import { readFileSync } from "node:fs";\n' + validScript);
  const dynamic = makeScript('export const code = import("node:fs");\n' + validScript);
  try {
    await assert.rejects(loadInterventionScript(direct.path, "gam"), /Solo se permiten/);
    await assert.rejects(loadInterventionScript(dynamic.path, "gam"), /imports dinámicos/);
  } finally {
    direct.cleanup();
    dynamic.cleanup();
  }
});

test("no admite rutas fuera de storage/interventions/<campaña>/scripts", async () => {
  const folder = mkdtempSync(join(tmpdir(), "intervencion-externa-"));
  const file = join(folder, "incorrecto.ts");
  writeFileSync(file, validScript);
  try {
    await assert.rejects(loadInterventionScript(file, "gam"), /debe estar en storage/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("rechaza falta de proposals y scripts con valores dinámicos incorrectos", async () => {
  const absent = makeScript('export const otros = 3;');
  const invalid = makeScript('export const proposals = [{ providerId: "gam", identity: "gam:ref:x", field: "image" }];');
  try {
    await assert.rejects(loadInterventionScript(absent.path, "gam"), /proposals/);
    await assert.rejects(loadInterventionScript(invalid.path, "gam"), /siete campos obligatorios|campo prohibido/);
  } finally {
    absent.cleanup();
    invalid.cleanup();
  }
});


test("admite scripts permanentes del proveedor sin registrar copias y rechaza rutas ajenas", async () => {
  const root = mkdtempSync(join(tmpdir(), "intervencion-versionada-"));
  const folder = join(root, "interventions", "gam");
  mkdirSync(folder, { recursive: true });
  const script = join(folder, "maquina.ts");
  const otherProvider = join(root, "interventions", "gomariz");
  mkdirSync(otherProvider);
  const mismatched = join(otherProvider, "maquina.ts");
  const external = join(root, "fuera.ts");
  const legacyFolder = join(root, "storage", "interventions", "lote-anterior", "scripts");
  mkdirSync(legacyFolder, { recursive: true });
  const legacy = join(legacyFolder, "maquina.ts");
  const content = `export const proposals = ${JSON.stringify([base])};`;
  writeFileSync(script, content);
  writeFileSync(mismatched, content);
  writeFileSync(external, content);
  writeFileSync(legacy, content);
  try {
    assert.deepEqual(await loadInterventionScript(script, "gam", root), [base]);
    assert.deepEqual(validateInterventionScriptSelection([script], "gam", "lote-actual", root), [script]);
    await assert.rejects(loadInterventionScript(mismatched, "gam", root), /pertenece a gomariz/);
    assert.throws(() => validateInterventionScriptSelection([external], "gam", null, root), /debe estar en/);
    assert.throws(() => validateInterventionScriptSelection([script, script], "gam", null, root), /repetido/);
    assert.throws(() => validateInterventionScriptSelection([script, legacy], "gam", "lote-anterior", root), /repetido/);
    assert.throws(() => validateInterventionScriptSelection([legacy], "gam", "lote-actual", root), /campaña distinta/);
    assert.throws(() => validateInterventionScriptSelection([script, mismatched], "gam", null, root), /pertenece a gomariz/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
