import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { createZipArchive, readZipArchive } from "../../../infrastructure/archive/zip.js";
import { reviewActiveCampaign } from "../review.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { interveneActiveCampaign } from "../intervention.js";
import { deliverActiveCampaign } from "../delivery.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { copyCampaignTestCatalog, reuseCampaignTestFixture } from "./campaign-catalog-fixture.js";
import type { BatchReport, ProviderRun } from "../../batch/report-types.js";

const fixtures = resolve("src/testing/fixtures");
const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva"
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

test("genera exactamente los tres JSON con la fecha local de entrega y totales acreditados", async () => {
  const data = await approvedFixture();
  try {
    const delivered = await deliverActiveCampaign(data.root, data.desktop, date);
    assert.equal(delivered.runId, data.runId);
    assert.equal(delivered.date, "2026-10-26");
    assert.equal(delivered.zipFile, join(data.desktop, "equipzilla-2026-10-26.zip"));
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
    assert.deepEqual(await readdir(data.desktop), ["equipzilla-2026-10-26.zip"]);
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

test("reemplaza una entrega del mismo día solo con el nuevo ZIP ya comprobado", async () => {
  const data = await approvedFixture();
  try {
    const first = await deliverActiveCampaign(data.root, data.desktop, date);
    const original = await readFile(first.zipFile);
    const replacement = await deliverActiveCampaign(data.root, data.desktop, date);
    assert.equal(replacement.zipFile, first.zipFile);
    assert.deepEqual(await readFile(first.zipFile), original);
    assert.deepEqual(await readdir(data.desktop), ["equipzilla-2026-10-26.zip"]);
  } finally { await data.cleanup(); }
});

test("una campaña intervenida y acreditada sustituye el ZIP del mismo día; si falta nueva aprobación conserva el anterior", async () => {
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
    const current = await deliverActiveCampaign(data.root, data.desktop, date);
    assert.equal(current.zipFile, first.zipFile);
    const next = await readFile(current.zipFile);
    assert.notDeepEqual(next, previous);
    assert.equal(readZipArchive(next).length, 3);
    assert.deepEqual(await readdir(data.desktop), ["equipzilla-2026-10-26.zip"]);
    const scriptContent = await readFile(script, "utf8");
    const { cleanDeliveredCampaign } = await import("../cleanup.js");
    const closed = await cleanDeliveredCampaign(data.root, data.desktop, false);
    assert.ok(closed.directories.some((path) => path.endsWith("results")));
    assert.equal(await readFile(script, "utf8"), scriptContent);
    assert.ok(intervention.derivedFile);
    await assert.rejects(readFile(intervention.derivedFile));
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
    assert.deepEqual(await readdir(data.desktop), ["equipzilla-2026-10-26.zip"]);
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

test("limpia únicamente artefactos de la campaña entregada, conservando scripts permanentes y ZIP", async () => {
  const data = await fixture();
  try {
    const scripts = join(data.root, "storage", "interventions", data.runId, "scripts");
    await mkdir(scripts, { recursive: true });
    await writeFile(join(scripts, "correccion.ts"), "export const proposals = [];");
    await approve(data.root);
    const delivery = await deliverActiveCampaign(data.root, data.desktop, date);
    const { cleanDeliveredCampaign } = await import("../cleanup.js");
    const plan = await cleanDeliveredCampaign(data.root, data.desktop, false);
    assert.equal(plan.preservedScripts, scripts);
    assert.equal((await readFile(join(scripts, "correccion.ts"), "utf8")), "export const proposals = [];");
    assert.equal((await readFile(delivery.zipFile)).length > 0, true);
    await assert.rejects(readFile(join(data.root, "storage", "runs", data.runId, "run.json")));
    const { discoverCampaign } = await import("../discovery.js");
    assert.equal((await discoverCampaign(data.root)).runId, null);
  } finally { await data.cleanup(); }
});

test("no limpia sin entrega acreditada, con ZIP alterado ni ante archivos desconocidos", async () => {
  const data = await fixture();
  try {
    const { cleanDeliveredCampaign } = await import("../cleanup.js");
    await assert.rejects(cleanDeliveredCampaign(data.root, data.desktop, false), /justificante/);
    await approve(data.root);
    const delivered = await deliverActiveCampaign(data.root, data.desktop, date);
    const original = await readFile(delivered.zipFile);
    await writeFile(delivered.zipFile, "ZIP alterado");
    await assert.rejects(cleanDeliveredCampaign(data.root, data.desktop, false), /ZIP entregado fue modificado/);
    await writeFile(delivered.zipFile, original);
    const unexpected = join(data.root, "storage", "campaigns", data.runId, "documento-personal.txt");
    await writeFile(unexpected, "Conservar");
    await assert.rejects(cleanDeliveredCampaign(data.root, data.desktop, false), /no reconocido/);
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
    const applied = await cleanDeliveredCampaign(data.root, data.desktop, false);
    assert.ok(applied.bytes >= dry.bytes);
    await assert.rejects(readFile(csv), { code: "ENOENT" });
    await assert.rejects(readFile(snapshot), { code: "ENOENT" });
    await assert.rejects(readFile(join(history, "active.json")), { code: "ENOENT" });
    assert.equal(await readFile(join(scripts, "estable.ts"), "utf8"), "export const proposals = [];");
    assert.ok((await readFile(delivery.zipFile)).length > 0);
  } finally { await data.cleanup(); }
});
