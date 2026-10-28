import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { readCatalogIntervention, readInterventionCatalog } from "../catalog.js";
import { runCampaignIntervention } from "../../../cli/commands/campaign/campaign-intervene.js";

const base = {
  providerId: "gam", identity: "gam:ref:prueba", field: "brand", expected: "YALE", next: "HYSTER",
  reason: "Contradicción en la ficha", evidence: "https://ejemplo.test/prueba"
};

const content = (metadata = { id: "gam-prueba", summary: "Corrige la marca de la ficha GAM" }, proposals: unknown = [base]): string =>
  `export const metadata = ${JSON.stringify(metadata)};\nexport const proposals = ${JSON.stringify(proposals)};\n`;

const fixture = (): { root: string; script: string; cleanup: () => void } => {
  const root = mkdtempSync(join(tmpdir(), "catalogo-intervenciones-"));
  const directory = join(root, "interventions", "gam");
  mkdirSync(directory, { recursive: true });
  const script = join(directory, "maquina.ts");
  writeFileSync(script, content());
  return { root, script, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

test("catálogo estático: deriva proveedor, máquinas, campos, motivos y evidencias sin ejecutar el script", () => {
  const { root, script, cleanup } = fixture();
  try {
    const before = readFileSync(script);
    const found = readInterventionCatalog("gam", root);
    assert.equal(found.length, 1);
    assert.deepEqual(found[0]?.metadata, { id: "gam-prueba", summary: "Corrige la marca de la ficha GAM" });
    assert.deepEqual(found[0]?.identities, ["gam:ref:prueba"]);
    assert.deepEqual(found[0]?.fields, ["brand"]);
    assert.deepEqual(found[0]?.proposals, [base]);
    assert.equal(found[0]?.script, "interventions/gam/maquina.ts");
    assert.deepEqual(readFileSync(script), before);
    assert.deepEqual(readInterventionCatalog("gomariz", root), []);
  } finally {
    cleanup();
  }
});

test("catálogo estático: rechaza ejecución, imports de runtime y valores computados", () => {
  const { root, script, cleanup } = fixture();
  const marker = join(root, "no-debe-ejecutarse");
  try {
    writeFileSync(script, `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "mal");\n${content()}`);
    assert.throws(() => readCatalogIntervention(script, root), /import type|export const/);
    assert.equal(existsSync(marker), false);
    writeFileSync(script, `export const metadata = { id: "gam-prueba", summary: "Cambio" };\nexport const proposals = getProposals(${JSON.stringify([base])});`);
    assert.throws(() => readCatalogIntervention(script, root), /valores literales|proposals/);
    writeFileSync(script, `export const metadata = { id: "gam-prueba", summary: process.env.TOKEN };\nexport const proposals = ${JSON.stringify([base])};`);
    assert.throws(() => readCatalogIntervention(script, root), /valores literales/);
  } finally {
    cleanup();
  }
});

test("catálogo estático: metadatos y propuestas incompletas, incoherentes o repetidas bloquean el listado", () => {
  const { root, script, cleanup } = fixture();
  try {
    writeFileSync(script, content({ id: "gomariz-prueba", summary: "Cambio" }));
    assert.throws(() => readInterventionCatalog("gam", root), /comenzar por gam-/);
    writeFileSync(script, `export const proposals = ${JSON.stringify([base])};`);
    assert.throws(() => readInterventionCatalog("gam", root), /metadata y proposals/);
    writeFileSync(script, content(undefined, [{ ...base, providerId: "gomariz" }]));
    assert.throws(() => readInterventionCatalog("gam", root), /proveedor diferente/);
    writeFileSync(script, content(undefined, [{ ...base, evidence: "" }]));
    assert.throws(() => readInterventionCatalog("gam", root), /evidence/);
    writeFileSync(script, content());
    writeFileSync(join(root, "interventions", "gam", "duplicada.ts"), content());
    assert.throws(() => readInterventionCatalog("gam", root), /Identificador duplicado/);
  } finally {
    cleanup();
  }
});

test("comandos de consulta: solo lectura, sin necesitar ni descubrir la campaña", () => {
  const root = resolve(process.cwd());
  const run = (...args: string[]) => spawnSync(process.execPath, ["dist/cli/commands/campaign/campaign-intervene.js", ...args], {
    cwd: root, encoding: "utf8"
  });
  const list = run("gam", "--listar");
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /gam-6002/);
  assert.match(list.stdout, /gam-6003/);
  assert.match(list.stdout, /gam-6004/);
  const detail = run("gam", "--consultar", "gam-6004");
  assert.equal(detail.status, 0, detail.stderr);
  assert.match(detail.stdout, /Motivo:|Evidencia:/);
  assert.match(detail.stdout, /spec:Modelo/);
  const reference = run("gam", "--consultar", "gam:ref:6002");
  assert.equal(reference.status, 0, reference.stderr);
  assert.match(reference.stdout, /gam-6002/);
  assert.notEqual(run("gam", "--consultar", "inexistente").status, 0);
});

test("comando de campaña: rechaza el registro retirado antes de modificar archivos", async () => {
  await assert.rejects(
    runCampaignIntervention(["gam", "--registrar", "fuera.ts"]),
    /--registrar fue retirado/
  );
});
