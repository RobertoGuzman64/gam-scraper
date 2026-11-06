import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { deliverActiveCampaign } from "../../delivery/execute.js";
import { verifyDeliveredCampaign } from "../../delivery/verification.js";
import { prepareCampaignAdmission } from "../../retention/admission.js";
import { abandonFailedCampaign, inspectRecoverableCampaign } from "../../retention/recovery.js";
import { createBatchRunId } from "../../../scraping/batch/run.js";
import { listCampaignRuns } from "../../discovery/search.js";
import { CAMPAIGN_PROVIDERS } from "../../discovery/report.js";
import { createDeliveryFixtures, date, prefixes, createSecondCampaign, writeInterruptedRotation } from "./delivery-fixtures.js";

const fixtureCache = createDeliveryFixtures();
const fixture = fixtureCache.fixture;
const approvedFixture = fixtureCache.approvedFixture;
after(fixtureCache.close);

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
