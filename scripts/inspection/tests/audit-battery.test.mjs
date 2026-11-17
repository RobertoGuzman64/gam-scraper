import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AUDIT_MODES, classifyAudit, executeNode, runAuditBattery } from "../audit-battery-core.mjs";

const okRun = (stdout = "", stderr = "", exitCode = 0) => ({ stdout, stderr, exitCode,
  error: null, signal: null, timedOut: false });
const testSources = (count = 1) => ({
  originals: { complete: false, sources: [{ providerId: "gomariz", available: false,
    expected: { catalogSha256: "a".repeat(64), productCount: 143 } }] },
  populations: { version: 1, analyzedAt: `2026-11-16T00:00:0${count}.000Z`, byStage: [
    { stage: "originales_canonicos", products: 1751, complete: true, providers: [{ providerId: "gam", products: 983, sourceSha256: "b".repeat(64) }] },
    { stage: "publicacion_final", products: 1344, complete: true, providers: [{ providerId: "gam", products: 980, sourceSha256: "c".repeat(64) }] },
    { stage: "publicacion_tecnica", products: 931, complete: false, providers: [{ providerId: "manain", products: 384, sourceSha256: "d".repeat(64) }] }
  ] }
});
const withWorkspace = async (action) => {
  const root = await mkdtemp(join(tmpdir(), "eqz-audit-battery-"));
  try { await action(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};
const partial = { version: 1, auditCoverage: { requested: 3, evaluated: 2,
  incompleteSource: 1, errors: 0, failures: [{ providerId: "gomariz", category: "INCOMPLETE_SOURCE" }] },
provenance: { source: "comparacion_publicaciones_y_preparacion", publications: [
  { providerId: "gam", publishedProducts: 980, publicationSha256: "f".repeat(64) },
  { providerId: "mercaeleva", publishedProducts: 221, publicationSha256: "e".repeat(64) }] } };

const fakeAudit = async (_root, args) => {
  const mode = AUDIT_MODES.find((item) => item.command === args[1] &&
    JSON.stringify(item.args) === JSON.stringify(args.slice(2)));
  assert.ok(mode, `Invocación inesperada ${args.join(" ")}`);
  if (["comparar", "comparar-specs", "comparar-titulos", "acreditacion-json"].includes(mode.id))
    return okRun(JSON.stringify(partial), "INCOMPLETE_SOURCE | gomariz | Original histórico ausente", 1);
  if (["revision", "contenido-revision"].includes(mode.id))
    return okRun("COBERTURA PARCIAL | 2/3 proveedores evaluados", "INCOMPLETE_SOURCE | gomariz | Original histórico ausente", 1);
  if (mode.id === "coherencia") return okRun("COHERENCIA DE PREPARACIÓN | 1751 fichas | 2 defectos\n  DEFECTO mercaeleva:123 | description", "", 1);
  return okRun(mode.format === "json" ? JSON.stringify({ version: 1, provenance: { source: mode.stage } }) : "DETALLE | sin fallos");
};

test("se conservan los once modos inventariados y solo lectura", () => {
  assert.equal(AUDIT_MODES.length, 11);
  assert.equal(new Set(AUDIT_MODES.map((item) => item.id)).size, 11);
  assert.ok(AUDIT_MODES.every((item) => ["huecos", "auditar:comercial"].includes(item.command)));
  assert.equal(AUDIT_MODES.filter((item) => item.format === "json").length, 7);
  assert.ok(AUDIT_MODES.every((item) => !item.args.includes("--aplicar") && !item.args.includes("--simular")));
});

test("clasifica inconcluso, hallazgo real y error técnico sin convertirlos en PASS", () => {
  const jsonMode = AUDIT_MODES[4];
  assert.ok(jsonMode);
  assert.equal(classifyAudit(jsonMode, okRun(JSON.stringify(partial), "", 1), partial), "INCOMPLETE_SOURCE");
  assert.equal(classifyAudit(jsonMode, okRun('{"status":"ERROR"}', "", 1), { status: "ERROR" }), "ERROR");
  assert.equal(classifyAudit(jsonMode, okRun("", "", 0), null), "ERROR");
  assert.equal(classifyAudit(jsonMode, okRun("{}", "", 1), {}), "ERROR");
  assert.equal(classifyAudit(jsonMode, okRun("{}", "", 1), { auditCoverage: { errors: 1 } }), "ERROR");
  const coherencia = AUDIT_MODES[10];
  assert.ok(coherencia);
  assert.equal(classifyAudit(coherencia, okRun("2 defectos\n  DEFECTO mercaeleva:123", "", 1), null), "FINDINGS");
  assert.equal(classifyAudit(coherencia, okRun("0 defectos", "", 1), null), "ERROR");
  assert.equal(classifyAudit(coherencia, okRun("2 defectos\n  DEFECTO", "", 0), null), "SUCCESS");
});

test("una única invocación produce 11 resultados, fuentes, JSON nativo y nada obsoleto", async () => {
  await withWorkspace(async (root) => {
    const parent = join(root, "catalogs", "reports", "audit-battery");
    await mkdir(join(parent, "corte-anterior"), { recursive: true });
    await writeFile(join(parent, "corte-anterior", "manifest.json"), "ANTIGUO");
    const options = { root, outDirectory: parent, execute: fakeAudit,
      prepare: async () => okRun(), sources: async () => testSources(1) };
    const first = await runAuditBattery(options);
    const second = await runAuditBattery(options);
    assert.notEqual(first.output, second.output);
    assert.deepEqual(first.report.totals, { SUCCESS: 4, FINDINGS: 1, INCOMPLETE_SOURCE: 6, ERROR: 0 });
    assert.equal(first.report.status, "INCOMPLETE_SOURCE");
    assert.equal(first.report.sources.changed, false);
    assert.equal(first.report.sources.status, "INCOMPLETE_SOURCE");
    assert.equal(first.report.sources.originalAvailability.sources[0].expected.productCount, 143);
    assert.equal(first.report.audits.find((item) => item.id === "revision")?.sourceStages[0].products, 1344);
    assert.equal(first.report.audits.length, 11);
    assert.equal(first.report.stages.preparado, "NO_EVALUADO");
    assert.equal(first.report.stages.exportado, "NO_EVALUADO");
    for (const record of first.report.audits) {
      const stdout = await readFile(join(first.output, record.stdout), "utf8");
      const stderr = await readFile(join(first.output, record.stderr), "utf8");
      assert.equal(typeof stdout, "string");
      assert.equal(typeof stderr, "string");
      if (record.json) assert.deepEqual(JSON.parse(await readFile(join(first.output, record.json), "utf8")), JSON.parse(stdout));
    }
    assert.equal(first.report.audits.filter((item) => item.json !== null).length, 7);
    assert.equal((await readdir(join(first.output, "resultados"))).filter((item) => item.endsWith(".json")).length, 7);
    assert.equal(await readFile(join(parent, "corte-anterior", "manifest.json"), "utf8"), "ANTIGUO");
    assert.match(await readFile(join(first.output, "resumen.txt"), "utf8"), /originales canónicos no equivalen a una preparación/u);
    assert.equal(first.report.audits.find((item) => item.id === "comparar")?.auditCoverage?.incompleteSource, 1);
  });
});

test("JSON inválido, error de original y ejecución técnica se reflejan en el expediente", async () => {
  await withWorkspace(async (root) => {
    const report = await runAuditBattery({ root, prepare: async () => okRun(),
      sources: async () => testSources(1), execute: async (...args) => {
        const result = await fakeAudit(...args);
        if (args[1][1] === "huecos" && args[1].includes("--finales")) return okRun("texto inesperado");
        if (args[1].includes("--acreditacion-json")) return okRun(JSON.stringify({
          ...partial, auditCoverage: { requested: 3, evaluated: 1, incompleteSource: 1, errors: 1 } }), "", 1);
        return result;
      } });
    assert.equal(report.report.status, "ERROR");
    assert.equal(report.report.audits.find((item) => item.id === "finales")?.json, null);
    assert.equal(report.report.audits.find((item) => item.id === "acreditacion-json")?.status, "ERROR");
    assert.equal(report.report.audits.find((item) => item.id === "acreditacion-json")?.json, null);
  });
});

test("huellas cambiantes de origen invalidan el corte conjunto", async () => {
  await withWorkspace(async (root) => {
    let count = 0;
    const { report } = await runAuditBattery({ root, prepare: async () => okRun(),
      sources: async () => { count += 1; const value = testSources(count); value.populations.byStage[0].providers[0].sourceSha256 = count === 1 ? "a".repeat(64) : "b".repeat(64); return value; },
      execute: fakeAudit });
    assert.equal(report.sources.changed, true);
    assert.equal(report.status, "ERROR");
  });
});

test("fallo de compilación registra once ejecuciones no realizadas sin reutilizar capturas antiguas", async () => {
  await withWorkspace(async (root) => {
    const { report, output } = await runAuditBattery({ root, prepare: async () => okRun("", "Falta cheerio", 1),
      execute: async () => { throw new Error("No deben lanzarse auditores tras fallar build"); } });
    assert.equal(report.status, "ERROR");
    assert.equal(report.build.exitCode, 1);
    assert.equal(report.audits.length, 11);
    assert.ok(report.audits.every((item) => item.exitCode === null && item.status === "ERROR" && item.json === null));
    assert.equal(await readFile(join(output, "build.stderr.txt"), "utf8"), "Falta cheerio");
  });
});

test("ejecutor de proceso cierra stdin y conserva stdout, stderr y el código", async () => {
  await withWorkspace(async (root) => {
    const script = join(root, "child.mjs");
    await writeFile(script, 'console.log("áéí 🎯"); console.error("ñ"); process.exitCode = 17;');
    const report = await executeNode(root, [script], 4_000);
    assert.equal(report.exitCode, 17);
    assert.match(report.stdout, /áéí 🎯/u);
    assert.match(report.stderr, /ñ/u);
    assert.equal(report.timedOut, false);
    assert.equal(report.error, null);
  });
});


test("si una invocación lanza excepción los restantes diez modos siguen auditándose", async () => {
  await withWorkspace(async (root) => {
    let calls = 0;
    const { report } = await runAuditBattery({ root, prepare: async () => okRun(),
      sources: async () => testSources(1), execute: async (...args) => {
        calls += 1;
        if (calls === 2) throw new Error("Proceso inaccesible");
        return fakeAudit(...args);
      } });
    assert.equal(calls, 11);
    assert.equal(report.audits[1].status, "ERROR");
    assert.equal(report.audits[1].error, "Proceso inaccesible");
    assert.equal(report.audits[10].status, "FINDINGS");
  });
});

test("fuente ilegible deja el informe como error sin silenciar las auditorías", async () => {
  await withWorkspace(async (root) => {
    const { report } = await runAuditBattery({ root, prepare: async () => okRun(),
      sources: async () => { throw new Error("Manifest original corrupto"); }, execute: fakeAudit });
    assert.equal(report.status, "ERROR");
    assert.equal(report.sources.status, "ERROR");
    assert.equal(report.sources.error, "Manifest original corrupto");
    assert.equal(report.audits.length, 11);
    assert.equal(report.audits[10].status, "FINDINGS");
  });
});

test("la ejecución excedida no se presenta como éxito", async () => {
  await withWorkspace(async (root) => {
    const script = join(root, "slow.mjs");
    await writeFile(script, 'setInterval(() => {}, 1000);');
    const result = await executeNode(root, [script], 200);
    assert.equal(result.timedOut, true);
    assert.ok(result.signal !== null || result.exitCode !== 0);
  });
});
