import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { createZipArchive, readZipArchive } from "../../../infrastructure/archive/zip.js";
import { reviewActiveCampaign } from "../review.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { interveneActiveCampaign } from "../intervention.js";
import { deliverActiveCampaign } from "../delivery.js";
import { verifyDeliveredCampaign } from "../delivery-verification.js";
import { prepareCampaignAdmission, abandonFailedCampaign, inspectRecoverableCampaign, recoverCompletedCampaign } from "../campaign-retention.js";
import { createBatchRunId } from "../../batch/run.js";
import { readCampaignFinalizationContext } from "../finalization.js";
import { findCampaignBaseline } from "../reference-comparison.js";
import { persistCampaignDelivery } from "../../../infrastructure/filesystem/campaign-cleanup.js";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { listCampaignRuns } from "../discovery.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { copyCampaignTestCatalog, reuseCampaignTestFixture } from "./campaign-catalog-fixture.js";
import type { BatchReport, ProviderRun } from "../../batch/report-types.js";

const fixtures = resolve("src/testing/fixtures");
const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva",
  manain: "scrape-manain"
} as const;
const date = new Date(2026, 9, 26, 12);
const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-delivery-"));
  const desktop = join(root, "Escritorio");
  await mkdir(desktop);
  const runId = `lote-${randomUUID()}`;
  const providers: ProviderRun[] = [];
  for (const id of CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[id];
    const dir = join(root, "storage", "scraped", "campaigns", runId, id);
    await mkdir(dir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(fixtures, dir, id, prefix);
    providers.push({
      providerId: id, status: "complete",
      startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
      endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
      durationMs: 1000, outputDir: dir, outputPrefix: prefix,
      logFile: join(dir, "missing.log"), summaryFile: join(dir, `${prefix}-summary.json`),
      changesFile: join(dir, `${prefix}-changes.json`)
    });
  }
  const runFile = join(root, "storage", "runs", runId, "run.json");
  const run: BatchReport = {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-22T08:20:00.000Z", endedAt: "2026-10-22T09:10:00.000Z", providers
  };
  await mkdir(dirname(runFile), { recursive: true });
  await writeFile(runFile, JSON.stringify(run));
  const review = await reviewActiveCampaign(root);
  assert.equal(review.complete, true, JSON.stringify(review.providers));
  return { root, desktop, runId, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

const approve = async (root: string): Promise<void> => {
  const draft = await finalizeActiveCampaign(root, false);
  assert.ok(draft.status === "draft" || draft.status === "pending");
  const original = JSON.parse(await readFile(draft.draftFile, "utf8"));
  const approved = {
    ...original, approved: true,
    approvalReason: "Decisiones revisadas por una persona responsable",
    exclusions: original.exclusions.map((entry: { readonly sourceUrl: string; readonly status: string }) => ({
      ...entry, decision: entry.status === "intervention" ? "incluir" : "excluir",
      reason: "Ficha contrastada manualmente con su fuente",
      evidenceUrls: [entry.sourceUrl]
    }))
  };
  await writeFile(draft.draftFile, JSON.stringify(approved, null, 2));
};

const approvedFixture = () => fixtureCache.prepared("approved", async (data) => approve(data.root));

test("genera exactamente los cuatro JSON con la fecha local de entrega y totales acreditados", async () => {
  const data = await approvedFixture();
  try {
    const delivered = await deliverActiveCampaign(data.root, data.desktop, date);
    assert.equal(delivered.runId, data.runId);
    assert.equal(delivered.date, "2026-10-26");
    assert.equal(delivered.zipFile, join(data.desktop, `equipzilla-2026-10-26-${data.runId}.zip`));
    const archive = readZipArchive(await readFile(delivered.zipFile));
    assert.deepEqual(archive.map((entry) => entry.name), CAMPAIGN_PROVIDERS.map((id) => `${id}-2026-10-26.json`));
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.ok(selected.selection);
    for (const [index, providerId] of CAMPAIGN_PROVIDERS.entries()) {
      const products: unknown = JSON.parse(archive[index]!.data.toString("utf8"));
      assert.deepEqual(products, selected.selection.products.filter((product) => product.providerId === providerId));
      assert.ok(isArray(products));
      assert.equal(products.length, delivered.products[providerId]);
    }
    assert.equal(Object.values(delivered.products).reduce((total, count) => total + count, 0),
      selected.selection.totals.publishable);
    assert.deepEqual(await readdir(data.desktop), [`equipzilla-2026-10-26-${data.runId}.zip`]);
  } finally { await data.cleanup(); }
});

test("sin aprobación editorial no entrega ni reemplaza un ZIP anterior", async () => {
  const data = await fixture();
  try {
    const previousFile = join(data.desktop, "equipzilla-2026-10-26.zip");
    const previous = createZipArchive(CAMPAIGN_PROVIDERS.map((id) => ({
      name: `${id}-2026-10-26.json`, data: "[]"
    })));
    await writeFile(previousFile, previous);
    await assert.rejects(deliverActiveCampaign(data.root, data.desktop, date), /acreditación aprobada/);
    assert.deepEqual(await readFile(previousFile), previous);
    assert.deepEqual(await readdir(data.desktop), ["equipzilla-2026-10-26.zip"]);
  } finally { await data.cleanup(); }
});

test("una entrega repetida del mismo lote se rechaza sin sobrescribir el ZIP acreditado", async () => {
  const data = await approvedFixture();
  try {
    const first = await deliverActiveCampaign(data.root, data.desktop, date);
    const original = await readFile(first.zipFile);
    await assert.rejects(deliverActiveCampaign(data.root, data.desktop, date), /ya tiene una entrega/);
    assert.deepEqual(await readFile(first.zipFile), original);
    assert.deepEqual(await readdir(data.desktop), [`equipzilla-2026-10-26-${data.runId}.zip`]);
  } finally { await data.cleanup(); }
});

test("una intervención posterior no reescribe la entrega acreditada del lote", async () => {
  const data = await approvedFixture();
  try {
    const first = await deliverActiveCampaign(data.root, data.desktop, date);
    const previous = await readFile(first.zipFile);
    const source = join(data.root, "storage", "scraped", "campaigns", data.runId, "gam", `${prefixes.gam}-catalog.json`);
    const catalog = await readCanonicalCatalog(source);
    const selected = await finalizeActiveCampaign(data.root, false);
    const published = selected.selection?.products.find((entry) => entry.providerId === "gam" && entry.title !== null);
    assert.ok(published);
    const product = catalog.products.find((entry) => entry.reference === published.reference);
    assert.ok(product);
    const scripts = join(data.root, "storage", "interventions", data.runId, "scripts");
    await mkdir(scripts, { recursive: true });
    const script = join(scripts, "cambio.ts");
    await writeFile(script, `export const proposals = ${JSON.stringify([{
      providerId: "gam", identity: buildProductIdentity(product).key, field: "title",
      expected: product.title, next: `${product.title} contrastada`,
      reason: "Ajuste editorial autorizado", evidence: "Producto revisado en la fuente original"
    }])};`);
    const intervention = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(intervention.applied, true);
    await assert.rejects(deliverActiveCampaign(data.root, data.desktop, date), /acreditación aprobada/);
    assert.deepEqual(await readFile(first.zipFile), previous);
    await approve(data.root);
    await assert.rejects(deliverActiveCampaign(data.root, data.desktop, date), /ya tiene una entrega/);
    assert.deepEqual(await readFile(first.zipFile), previous);
    assert.deepEqual(await readdir(data.desktop), [`equipzilla-2026-10-26-${data.runId}.zip`]);
    assert.ok(intervention.derivedFile);
    assert.ok((await readFile(intervention.derivedFile)).length > 0);
    assert.ok((await readFile(script)).length > 0);
  } finally { await data.cleanup(); }
});

test("si se altera una selección, la entrega válida anterior permanece intacta", async () => {
  const data = await approvedFixture();
  try {
    const delivered = await deliverActiveCampaign(data.root, data.desktop, date);
    const previous = await readFile(delivered.zipFile);
    const selection = await finalizeActiveCampaign(data.root, false);
    assert.ok(selection.selectionDir);
    await writeFile(join(selection.selectionDir, "gam-publishable.json"), "[]");
    await assert.rejects(deliverActiveCampaign(data.root, data.desktop, date), /archivos han cambiado/);
    assert.deepEqual(await readFile(delivered.zipFile), previous);
    assert.deepEqual(await readdir(data.desktop), [`equipzilla-2026-10-26-${data.runId}.zip`]);
  } finally { await data.cleanup(); }
});

test("el lector ZIP rechaza contenidos corruptos, duplicados y directorios inconsistentes", () => {
  assert.throws(() => createZipArchive([{ name: "a.json", data: "[]" }, { name: "a.json", data: "[]" }]), /duplicadas/);
  const zipped = createZipArchive([{ name: "gam.json", data: "[]" }]);
  assert.deepEqual(readZipArchive(zipped).map((entry) => entry.name), ["gam.json"]);
  const corrupt = Buffer.from(zipped);
  corrupt[30 + Buffer.byteLength("gam.json")] = (corrupt[30 + Buffer.byteLength("gam.json")] ?? 0) ^ 0x01;
  assert.throws(() => readZipArchive(corrupt), /corrupta|CRC|tamaño/);
  assert.throws(() => readZipArchive(zipped.subarray(0, zipped.length - 5)), /ZIP:/);
});

test("rechaza fecha inválida y Escritorio ausente sin dejar artefactos", async () => {
  const data = await approvedFixture();
  try {
    await assert.rejects(deliverActiveCampaign(data.root, data.desktop, new Date(Number.NaN)), /Fecha de entrega inválida/);
    await assert.rejects(deliverActiveCampaign(data.root, join(data.root, "inexistente"), date), /ENOENT/);
    assert.deepEqual(await readdir(data.desktop), []);
  } finally { await data.cleanup(); }
});

test("simula limpieza acreditada y conserva la campaña hasta autorización explícita", async () => {
  const data = await approvedFixture();
  try {
    await writeFile(join(data.root, "storage", "runs", data.runId, "gam.log"), "Registro técnico");
    const delivered = await deliverActiveCampaign(data.root, data.desktop, date);
    await assert.rejects(readFile(join(data.root, "storage", "runs", data.runId, "gam.log")));
    const { planDeliveredCampaignCleanup } = await import("../cleanup.js");
    const plan = await planDeliveredCampaignCleanup(data.root, data.desktop);
    assert.equal(plan.runId, data.runId);
    assert.equal(plan.directories.length, 3);
    assert.ok(plan.bytes > 0);
    assert.ok((await readFile(delivered.zipFile)).length > 0);
    assert.ok((await readFile(join(data.root, "storage", "runs", data.runId, "run.json"))).length > 0);
  } finally { await data.cleanup(); }
});

test("una campaña entregada conserva sus scripts y originales frente a limpieza manual", async () => {
  const data = await fixture();
  try {
    const scripts = join(data.root, "storage", "interventions", data.runId, "scripts");
    await mkdir(scripts, { recursive: true });
    await writeFile(join(scripts, "correccion.ts"), "export const proposals = [];");
    await approve(data.root);
    const delivery = await deliverActiveCampaign(data.root, data.desktop, date);
    const { cleanDeliveredCampaign } = await import("../cleanup.js");
    await assert.rejects(cleanDeliveredCampaign(data.root, data.desktop, false), /limpieza manual ordinaria/);
    assert.equal((await readFile(join(scripts, "correccion.ts"), "utf8")), "export const proposals = [];");
    assert.ok((await readFile(delivery.zipFile)).length > 0);
    assert.ok((await readFile(join(data.root, "storage", "runs", data.runId, "run.json"))).length > 0);
  } finally { await data.cleanup(); }
});

test("no limpia sin entrega acreditada, con ZIP alterado ni ante archivos desconocidos", async () => {
  const data = await fixture();
  try {
    const { planDeliveredCampaignCleanup } = await import("../cleanup.js");
    await assert.rejects(planDeliveredCampaignCleanup(data.root, data.desktop), /justificante/);
    await approve(data.root);
    const delivered = await deliverActiveCampaign(data.root, data.desktop, date);
    const original = await readFile(delivered.zipFile);
    await writeFile(delivered.zipFile, "ZIP alterado");
    await assert.rejects(planDeliveredCampaignCleanup(data.root, data.desktop), /ZIP físico alterado/);
    await writeFile(delivered.zipFile, original);
    const unexpected = join(data.root, "storage", "campaigns", data.runId, "documento-personal.txt");
    await writeFile(unexpected, "Conservar");
    await assert.rejects(planDeliveredCampaignCleanup(data.root, data.desktop), /no reconocido/);
    assert.equal(await readFile(unexpected, "utf8"), "Conservar");
    assert.ok((await readFile(join(data.root, "storage", "runs", data.runId, "run.json"))).length > 0);
  } finally { await data.cleanup(); }
});


test("limpia auxiliares reconocidos del lote entregado sin tocar scripts ni ZIP", async () => {
  const data = await approvedFixture();
  try {
    const gam = join(data.root, "storage", "scraped", "campaigns", data.runId, "gam");
    const prefix = prefixes.gam;
    const csv = join(gam, `${prefix}-all.csv`);
    const snapshot = join(gam, `${prefix}-snapshot-grouped.json`);
    const history = join(gam, ".history", prefix);
    const scripts = join(data.root, "storage", "interventions", data.runId, "scripts");
    await mkdir(history, { recursive: true });
    await mkdir(scripts, { recursive: true });
    await writeFile(csv, "categoryKey,categoryName,title,reference\nmaquinaria,Maquinaria,Máquina,ABC\n");
    await writeFile(snapshot, JSON.stringify({ version: 1, scope: "grouped", createdAt: "2026-10-22T10:00:00Z", items: [] }));
    const summary = JSON.parse(await readFile(join(gam, `${prefix}-summary.json`), "utf8"));
    await writeFile(join(history, "active.json"), JSON.stringify({
      version: 1, summary, changes: {}, errors: {}
    }));
    await writeFile(join(scripts, "estable.ts"), "export const proposals = [];");
    const delivery = await deliverActiveCampaign(data.root, data.desktop, date);
    const { cleanDeliveredCampaign } = await import("../cleanup.js");
    const dry = await cleanDeliveredCampaign(data.root, data.desktop, true);
    assert.ok(dry.inventory.some(({ area, details }) => area === "scraped" &&
      details.breakdown.some(({ kind }) => kind === "history")));
    assert.match(await readFile(csv, "utf8"), /categoryKey,categoryName,title/);
    await assert.rejects(cleanDeliveredCampaign(data.root, data.desktop, false), /limpieza manual ordinaria/);
    assert.match(await readFile(csv, "utf8"), /categoryKey,categoryName,title/);
    assert.ok((await readFile(snapshot)).length > 0);
    assert.ok((await readFile(join(history, "active.json"))).length > 0);
    assert.equal(await readFile(join(scripts, "estable.ts"), "utf8"), "export const proposals = [];");
    assert.ok((await readFile(delivery.zipFile)).length > 0);
  } finally { await data.cleanup(); }
});

const createSecondCampaign = async (root: string): Promise<string> => {
  const runId = `lote-${randomUUID()}`;
  const providers: ProviderRun[] = [];
  for (const id of CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[id];
    const dir = join(root, "storage", "scraped", "campaigns", runId, id);
    await mkdir(dir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(fixtures, dir, id, prefix);
    providers.push({
      providerId: id, status: "complete",
      startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
      endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
      durationMs: 1000, outputDir: dir, outputPrefix: prefix,
      logFile: join(dir, "missing.log"), summaryFile: join(dir, `${prefix}-summary.json`),
      changesFile: join(dir, `${prefix}-changes.json`)
    });
  }
  const run: BatchReport = {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-22T08:20:00.001Z", endedAt: "2026-10-22T09:10:00.001Z", providers
  };
  const file = join(root, "storage", "runs", runId, "run.json");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(run));
  const reviewed = await reviewActiveCampaign(root);
  assert.equal(reviewed.complete, true);
  await approve(root);
  return runId;
};

const createFailedCampaign = async (root: string): Promise<string> => {
  const runId = `lote-${randomUUID()}`;
  const outputDir = join(root, "storage", "scraped", "campaigns", runId, "gam");
  await mkdir(outputDir, { recursive: true });
  const provider: ProviderRun = {
    providerId: "gam", status: "failed", startedAt: "2026-10-23T08:21:00.000Z",
    endedAt: "2026-10-23T08:21:20.000Z", durationMs: 20000,
    outputDir, outputPrefix: prefixes.gam, logFile: join(outputDir, "missing.log"),
    summaryFile: join(outputDir, `${prefixes.gam}-summary.json`),
    changesFile: join(outputDir, `${prefixes.gam}-changes.json`), error: "Origen no disponible"
  };
  const report: BatchReport = {
    version: 1, runId, status: "failed", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-23T08:20:00.000Z", endedAt: "2026-10-23T08:21:21.000Z", providers: [provider]
  };
  const file = join(root, "storage", "runs", runId, "run.json");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report));
  return runId;
};

test("dos entregas del mismo día no se sobrescriben y la rotación conserva la última acreditada", async () => {
  const data = await approvedFixture();
  try {
    const first = await deliverActiveCampaign(data.root, data.desktop, date);
    const original = await readFile(first.zipFile);
    const secondRunId = await createSecondCampaign(data.root);
    const second = await deliverActiveCampaign(data.root, data.desktop, date);
    assert.equal(second.runId, secondRunId);
    assert.notEqual(second.zipFile, first.zipFile);
    assert.deepEqual(await readFile(first.zipFile), original);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).zipStatus, "verified");
    await prepareCampaignAdmission(data.root, false);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [secondRunId]);
    assert.ok((await readFile(join(data.root, "storage", "runs", secondRunId, "run.json"))).length > 0);
    assert.deepEqual(await readFile(first.zipFile), original);
  } finally { await data.cleanup(); }
});

test("con entrega anterior y campaña fallida --nueva no elimina nada; el abandono expreso libera solo la fallida", async () => {
  const data = await approvedFixture();
  try {
    const valid = await deliverActiveCampaign(data.root, data.desktop, date);
    const partial = join(data.root, "storage", "scraped", "manain", "scrape-manain-partial-all.csv");
    await mkdir(dirname(partial), { recursive: true });
    await writeFile(partial, "parcial individual conservado");
    const failedId = await createFailedCampaign(data.root);
    await assert.rejects(prepareCampaignAdmission(data.root, true), /incompleta|Dos posiciones ocupadas/);
    assert.ok((await readFile(join(data.root, "storage", "runs", failedId, "run.json"))).length > 0);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).runId, data.runId);
    await abandonFailedCampaign(data.root, failedId);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [data.runId]);
    assert.ok((await readFile(valid.zipFile)).length > 0);
    assert.equal(await readFile(partial, "utf8"), "parcial individual conservado");
  } finally { await data.cleanup(); }
});

test("una entrega local sigue acreditable sin ZIP físico y la retirada bloquea archivos desconocidos", async () => {
  const data = await approvedFixture();
  try {
    const first = await deliverActiveCampaign(data.root, data.desktop, date);
    await rm(first.zipFile);
    const historical = await verifyDeliveredCampaign(data.root, undefined, data.runId);
    assert.equal(historical.zipStatus, "absent");
    await createSecondCampaign(data.root);
    await deliverActiveCampaign(data.root, data.desktop, date);
    const unknown = join(data.root, "storage", "campaigns", data.runId, "nota-personal.txt");
    await writeFile(unknown, "Conservar");
    await assert.rejects(prepareCampaignAdmission(data.root, false), /no reconocido|No se borra/);
    assert.equal(await readFile(unknown, "utf8"), "Conservar");
    assert.equal((await listCampaignRuns(data.root)).length, 2);
  } finally { await data.cleanup(); }
});


test("recupera por runId una extracción interrumpida solo si los cuatro canónicos son íntegros", async () => {
  const data = await fixture();
  try {
    const file = join(data.root, "storage", "runs", data.runId, "run.json");
    const report: BatchReport = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify({ ...report, status: "running", endedAt: null }));
    await assert.rejects(prepareCampaignAdmission(data.root, false), /incompleta/);
    await recoverCompletedCampaign(data.root, data.runId);
    const recovered: BatchReport = JSON.parse(await readFile(file, "utf8"));
    assert.equal(recovered.status, "complete");
    assert.ok(recovered.endedAt);
    assert.equal((await listCampaignRuns(data.root))[0]?.report.runId, data.runId);
  } finally { await data.cleanup(); }
});

test("no recupera un lote fallido sin sus catálogos y no abandona trabajos editoriales", async () => {
  const data = await fixture();
  try {
    const failedId = await createFailedCampaign(data.root);
    await assert.rejects(recoverCompletedCampaign(data.root, failedId), /no terminó los cuatro proveedores/);
    const authored = join(data.root, "storage", "interventions", failedId, "results", "pendiente.txt");
    await mkdir(dirname(authored), { recursive: true });
    await writeFile(authored, "Trabajo no consolidado");
    await assert.rejects(abandonFailedCampaign(data.root, failedId), /no reconocido|trabajo/);
    assert.equal(await readFile(authored, "utf8"), "Trabajo no consolidado");
    assert.ok((await readFile(join(data.root, "storage", "runs", failedId, "run.json"))).length > 0);
  } finally { await data.cleanup(); }
});


test("una entrega histórica de tres proveedores se verifica por runId y sirve de referencia a cuatro", async () => {
  const data = await fixture();
  try {
    const file = join(data.root, "storage", "runs", data.runId, "run.json");
    const report: BatchReport = JSON.parse(await readFile(file, "utf8"));
    const historical = report.providers.filter(({ providerId }) => providerId !== "manain");
    for (const provider of historical) {
      const shared = join(data.root, "storage", "scraped", provider.providerId);
      await cp(provider.outputDir, shared, { recursive: true });
    }
    await writeFile(file, JSON.stringify({ ...report,
      requestedProviders: [...LEGACY_CAMPAIGN_PROVIDERS],
      providers: historical.map((provider) => ({ ...provider,
        outputDir: join(data.root, "storage", "scraped", provider.providerId) })) }));
    await rm(join(data.root, "storage", "scraped", "campaigns", data.runId), { recursive: true });
    const context = await readCampaignFinalizationContext(data.root, data.runId);
    const approved = { ...context.expected, approved: true,
      approvalReason: "Revisión humana de la entrega histórica",
      exclusions: context.expected.exclusions.map((entry) => ({ ...entry,
        decision: entry.status === "intervention" ? "incluir" : "excluir",
        reason: "Ficha contrastada manualmente con su fuente", evidenceUrls: [entry.sourceUrl] })) };
    const raw = JSON.stringify(approved, null, 2);
    await mkdir(dirname(context.draftFile), { recursive: true });
    await writeFile(context.draftFile, raw);
    const selected = await finalizeActiveCampaign(data.root, true, data.runId);
    assert.equal(selected.status, "simulation");
    assert.ok(selected.selection);
    const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
    const selectionDir = join(data.root, "storage", "campaigns", data.runId, "selection", hash(raw));
    await mkdir(selectionDir, { recursive: true });
    await writeFile(join(selectionDir, "selection.json"), JSON.stringify(selected.selection, null, 2));
    const files = LEGACY_CAMPAIGN_PROVIDERS.map((id) => ({
      name: `${id}-2026-10-26.json`, data: JSON.stringify(selected.selection!.products.filter((item) => item.providerId === id), null, 2)
    }));
    for (const entry of files) {
      await writeFile(join(selectionDir, entry.name.replace("-2026-10-26.json", "-publishable.json")), entry.data);
    }
    const zip = createZipArchive(files);
    const zipFile = join(data.desktop, "equipzilla-2026-10-26.zip");
    await writeFile(zipFile, zip);
    await persistCampaignDelivery(data.root, { version: 1, runId: data.runId,
      date: "2026-10-26", zipFile, zipSha256: hash(zip), selectionSha256: hash(JSON.stringify(selected.selection)) });
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).zipStatus, "verified");
    assert.deepEqual((await findCampaignBaseline(data.root))?.catalogs.map(({ providerId }) => providerId),
      [...LEGACY_CAMPAIGN_PROVIDERS]);
    await assert.rejects(finalizeActiveCampaign(data.root, false, data.runId), /histórica de tres proveedores/);
    const sharedOriginal = join(data.root, "storage", "scraped", "gam", `${prefixes.gam}-catalog.json`);
    const savedOriginal = await readFile(sharedOriginal);
    const manainPartial = join(data.root, "storage", "scraped", "manain", "censo-parcial.csv");
    await mkdir(dirname(manainPartial), { recursive: true });
    await writeFile(manainPartial, "Datos parciales independientes");
    const successorId = await createSecondCampaign(data.root);
    await deliverActiveCampaign(data.root, data.desktop, date);
    await prepareCampaignAdmission(data.root, false);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [successorId]);
    assert.deepEqual(await readFile(sharedOriginal), savedOriginal);
    assert.equal(await readFile(manainPartial, "utf8"), "Datos parciales independientes");
  } finally { await data.cleanup(); }
});


test("abandona expresamente un run fallido sin proveedores, sin afectar la última entrega", async () => {
  const data = await approvedFixture();
  try {
    const delivery = await deliverActiveCampaign(data.root, data.desktop, date);
    const failedId = `lote-${randomUUID()}`;
    const file = join(data.root, "storage", "runs", failedId, "run.json");
    const report: BatchReport = {
      version: 1, runId: failedId, status: "failed", requestedProviders: [...CAMPAIGN_PROVIDERS],
      startedAt: "2026-10-23T08:20:00.000Z", endedAt: "2026-10-23T08:20:03.000Z", providers: []
    };
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(report));
    const inspection = await inspectRecoverableCampaign(data.root, failedId);
    assert.equal(inspection.canAbandon, true);
    await assert.rejects(prepareCampaignAdmission(data.root, true), /incompleta|Dos posiciones ocupadas/);
    await abandonFailedCampaign(data.root, failedId);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [data.runId]);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).zipStatus, "verified");
    assert.ok((await readFile(delivery.zipFile)).length > 0);
  } finally { await data.cleanup(); }
});

test("el abandono sin proveedores no elimina contenido desconocido ni trabajo editorial", async () => {
  const data = await fixture();
  try {
    const failedId = `lote-${randomUUID()}`;
    const file = join(data.root, "storage", "runs", failedId, "run.json");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({
      version: 1, runId: failedId, status: "running", requestedProviders: [...CAMPAIGN_PROVIDERS],
      startedAt: "2026-10-23T08:20:00.000Z", endedAt: null, providers: []
    }));
    const authored = join(data.root, "storage", "campaigns", failedId, "editorial", "acreditacion.txt");
    await mkdir(dirname(authored), { recursive: true });
    await writeFile(authored, "Trabajo pendiente");
    await assert.rejects(abandonFailedCampaign(data.root, failedId), /no reconocido|trabajo/);
    assert.equal(await readFile(authored, "utf8"), "Trabajo pendiente");
    assert.ok((await readFile(file)).length > 0);
  } finally { await data.cleanup(); }
});

const writeInterruptedRotation = async (root: string, retiredId: string, retainedId: string): Promise<void> => {
  const folder = join(root, "storage", "scraped", "campaigns");
  await writeFile(join(folder, ".rotation.json"), JSON.stringify({
    version: 1, kind: "rotation", runId: retiredId, retainedRunId: retainedId,
    scrapedFolder: retiredId,
    prefixes: CAMPAIGN_PROVIDERS.map((providerId) => ({ providerId, outputPrefix: prefixes[providerId] }))
  }));
};

test("reanuda rotación interrumpida tras retirar los metadatos y conserva la entrega sucesora", async () => {
  const data = await approvedFixture();
  try {
    const original = await deliverActiveCampaign(data.root, data.desktop, date);
    const successorId = await createSecondCampaign(data.root);
    const successor = await deliverActiveCampaign(data.root, data.desktop, date);
    await writeInterruptedRotation(data.root, data.runId, successorId);
    await rm(join(data.root, "storage", "campaigns", data.runId), { recursive: true });
    await rm(join(data.root, "storage", "runs", data.runId, "run.json"));
    await writeFile(join(data.root, "storage", "runs", data.runId, "gam.log"), "Registro técnico parcial");
    await prepareCampaignAdmission(data.root, false);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [successorId]);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, successorId)).zipStatus, "verified");
    assert.ok((await readFile(original.zipFile)).length > 0);
    assert.ok((await readFile(successor.zipFile)).length > 0);
    await assert.rejects(readFile(join(data.root, "storage", "scraped", "campaigns", ".rotation.json")));
  } finally { await data.cleanup(); }
});

test("una rotación interrumpida se bloquea si la entrega restante cambia o hay archivos extraños", async () => {
  const data = await approvedFixture();
  try {
    await deliverActiveCampaign(data.root, data.desktop, date);
    const successorId = await createSecondCampaign(data.root);
    await deliverActiveCampaign(data.root, data.desktop, date);
    await writeInterruptedRotation(data.root, data.runId, successorId);
    const unexpected = join(data.root, "storage", "scraped", "campaigns", data.runId, "nota-ajena.txt");
    await writeFile(unexpected, "No eliminar");
    await assert.rejects(prepareCampaignAdmission(data.root, false), /no reconocido|No se borra/);
    assert.equal(await readFile(unexpected, "utf8"), "No eliminar");
    const receipt = join(data.root, "storage", "campaigns", successorId, "delivery.json");
    await writeFile(receipt, "Entrega alterada");
    await assert.rejects(prepareCampaignAdmission(data.root, false), /JSON|Justificante|incoherente|token/i);
    assert.ok((await readFile(join(data.root, "storage", "runs", data.runId, "run.json"))).length > 0);
    assert.ok((await readFile(join(data.root, "storage", "scraped", "campaigns", ".rotation.json"))).length > 0);
  } finally { await data.cleanup(); }
});


test("una extracción interrumpida en el primer proveedor conserva su vínculo al runId y permite abandono explícito", async () => {
  const data = await approvedFixture();
  try {
    const delivery = await deliverActiveCampaign(data.root, data.desktop, date);
    const failedId = createBatchRunId();
    const folder = join(data.root, "storage", "scraped", "campaigns", failedId);
    const firstProvider = join(folder, "gam");
    await mkdir(firstProvider, { recursive: true });
    const partial = join(firstProvider, `${prefixes.gam}-all.csv.${randomUUID()}.tmp`);
    await writeFile(partial, "categoryKey,categoryName,title,\ncontenido parcial");
    const file = join(data.root, "storage", "runs", failedId, "run.json");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ version: 1, runId: failedId, status: "running",
      requestedProviders: [...CAMPAIGN_PROVIDERS], startedAt: "2026-10-27T08:20:00.000Z",
      endedAt: null, providers: [] }));
    const preserved = join(data.root, "storage", "scraped", "manain", "extraccion-individual.csv");
    await mkdir(dirname(preserved), { recursive: true });
    await writeFile(preserved, "Censo independiente");
    assert.equal((await inspectRecoverableCampaign(data.root, failedId)).canAbandon, true);
    await assert.rejects(prepareCampaignAdmission(data.root, true), /incompleta|Dos posiciones ocupadas/);
    assert.equal(await readFile(partial, "utf8"), "categoryKey,categoryName,title,\ncontenido parcial");
    await abandonFailedCampaign(data.root, failedId);
    await assert.rejects(lstat(folder), /ENOENT/);
    await assert.rejects(lstat(file), /ENOENT/);
    assert.equal(await readFile(preserved, "utf8"), "Censo independiente");
    assert.ok((await readFile(delivery.zipFile)).length > 0);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).zipStatus, "verified");
  } finally { await data.cleanup(); }
});

test("un archivo ajeno en la extracción interrumpida impide el abandono y queda intacto", async () => {
  const data = await fixture();
  try {
    const failedId = createBatchRunId();
    const folder = join(data.root, "storage", "scraped", "campaigns", failedId, "gam");
    await mkdir(folder, { recursive: true });
    const foreign = join(folder, "trabajo-ajeno.txt");
    await writeFile(foreign, "No retirar");
    const file = join(data.root, "storage", "runs", failedId, "run.json");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ version: 1, runId: failedId, status: "failed",
      requestedProviders: [...CAMPAIGN_PROVIDERS], startedAt: "2026-10-27T08:20:00.000Z",
      endedAt: "2026-10-27T08:25:00.000Z", providers: [] }));
    await assert.rejects(inspectRecoverableCampaign(data.root, failedId), /no reconocido|No se borra/);
    await assert.rejects(abandonFailedCampaign(data.root, failedId), /no reconocido|No se borra/);
    assert.equal(await readFile(foreign, "utf8"), "No retirar");
    assert.ok((await readFile(file)).length > 0);
  } finally { await data.cleanup(); }
});

test("temporal de rotación truncado se descarta sin tocar campañas ni bloquear la admisión", async () => {
  const data = await approvedFixture();
  try {
    await deliverActiveCampaign(data.root, data.desktop, date);
    const stage = join(data.root, "storage", "scraped", "campaigns", ".rotation.json.tmp");
    await writeFile(stage, '{"version":1,"kind":"rotat');
    await prepareCampaignAdmission(data.root, false);
    await assert.rejects(lstat(stage), /ENOENT/);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [data.runId]);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).zipStatus, "verified");
  } finally { await data.cleanup(); }
});

test("rotación con temporal previo crea un registro comprometido y concluye sin residuos", async () => {
  const data = await approvedFixture();
  try {
    await deliverActiveCampaign(data.root, data.desktop, date);
    const successorId = await createSecondCampaign(data.root);
    await deliverActiveCampaign(data.root, data.desktop, date);
    const folder = join(data.root, "storage", "scraped", "campaigns");
    const stage = join(folder, ".rotation.json.tmp");
    await writeFile(stage, '{"version":');
    await prepareCampaignAdmission(data.root, false);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [successorId]);
    await assert.rejects(lstat(stage), /ENOENT/);
    await assert.rejects(lstat(join(folder, ".rotation.json")), /ENOENT/);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, successorId)).zipStatus, "verified");
  } finally { await data.cleanup(); }
});
