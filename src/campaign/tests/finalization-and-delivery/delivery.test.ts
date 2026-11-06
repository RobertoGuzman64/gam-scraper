import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readPortableCampaign } from "../../../infrastructure/filesystem/catalog/portable-campaign.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { createZipArchive, readZipArchive } from "../../../infrastructure/archive/zip.js";
import { finalizeActiveCampaign } from "../../finalization.js";
import { interveneActiveCampaign } from "../../intervention.js";
import { deliverActiveCampaign } from "../../delivery/execute.js";
import { CAMPAIGN_PROVIDERS } from "../../discovery/report.js";
import { createDeliveryFixtures, approve, date, prefixes } from "./delivery-fixtures.js";

const fixtureCache = createDeliveryFixtures();
const fixture = fixtureCache.fixture;
const approvedFixture = fixtureCache.approvedFixture;
after(fixtureCache.close);

const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

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
    const receiptFile = join(data.root, "storage", "campaigns", data.runId, "delivery.json");
    const receipt = await readFile(receiptFile);
    const portable = await readPortableCampaign(data.root, data.runId);
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
    assert.deepEqual(await readFile(receiptFile), receipt);
    assert.deepEqual(await readPortableCampaign(data.root, data.runId), portable);
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
    const { planDeliveredCampaignCleanup } = await import("../../cleanup.js");
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
    const { cleanDeliveredCampaign } = await import("../../cleanup.js");
    await assert.rejects(cleanDeliveredCampaign(data.root, data.desktop, false), /limpieza manual ordinaria/);
    assert.equal((await readFile(join(scripts, "correccion.ts"), "utf8")), "export const proposals = [];");
    assert.ok((await readFile(delivery.zipFile)).length > 0);
    assert.ok((await readFile(join(data.root, "storage", "runs", data.runId, "run.json"))).length > 0);
  } finally { await data.cleanup(); }
});

test("no limpia sin entrega acreditada, con ZIP alterado ni ante archivos desconocidos", async () => {
  const data = await fixture();
  try {
    const { planDeliveredCampaignCleanup } = await import("../../cleanup.js");
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
    const { cleanDeliveredCampaign } = await import("../../cleanup.js");
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
