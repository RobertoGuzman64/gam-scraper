import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readPortableCampaign } from "../../../../infrastructure/filesystem/catalog/portable-campaign.js";
import { createZipArchive } from "../../../../infrastructure/archive/zip.js";
import { finalizeActiveCampaign } from "../../finalization.js";
import { deliverActiveCampaign } from "../../delivery/execute.js";
import { verifyDeliveredCampaign } from "../../delivery/verification.js";
import { prepareCampaignAdmission } from "../../retention/admission.js";
import { abandonFailedCampaign, inspectRecoverableCampaign, recoverCompletedCampaign } from "../../retention/recovery.js";
import { readCampaignFinalizationContext } from "../../finalization.js";
import { findCampaignBaseline } from "../../reference/compare.js";
import { persistCampaignDelivery } from "../../../../infrastructure/filesystem/campaign/campaign-cleanup.js";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../../../../contracts/campaign-providers.js";
import { listCampaignRuns } from "../../discovery/search.js";
import { CAMPAIGN_PROVIDERS } from "../../discovery/report.js";
import type { BatchReport } from "../../../../contracts/batch-report.js";
import { createDeliveryFixtures, date, prefixes, createSecondCampaign, createFailedCampaign } from "./delivery-fixtures.js";

const fixtureCache = createDeliveryFixtures();
const fixture = fixtureCache.fixture;
const approvedFixture = fixtureCache.approvedFixture;
after(fixtureCache.close);

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
    await readPortableCampaign(data.root, data.runId);
    await readPortableCampaign(data.root, secondRunId);
    const currentFile = join(data.root, "catalogs", "campaigns", secondRunId, "gam", "publishable.json");
    const originalCurrent = await readFile(currentFile, "utf8");
    await writeFile(currentFile, `${originalCurrent} `);
    await assert.rejects(prepareCampaignAdmission(data.root, false), /Integridad/);
    assert.equal((await listCampaignRuns(data.root)).length, 2);
    await readPortableCampaign(data.root, data.runId);
    await writeFile(currentFile, originalCurrent);
    await prepareCampaignAdmission(data.root, false);
    await assert.rejects(readPortableCampaign(data.root, data.runId), /ausente/);
    await readPortableCampaign(data.root, secondRunId);
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
