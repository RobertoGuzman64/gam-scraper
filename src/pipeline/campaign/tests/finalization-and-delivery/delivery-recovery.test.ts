import test, { after } from "node:test";
import assert from "node:assert/strict";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { deliverActiveCampaign } from "../../delivery/execute.js";
import { verifyDeliveredCampaign } from "../../delivery/verification.js";
import { prepareCampaignAdmission } from "../../retention/admission.js";
import { abandonFailedCampaign, inspectRecoverableCampaign } from "../../retention/recovery.js";
import { createBatchRunId } from "../../../batch/run.js";
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

test("abandono de primer proveedor con bloqueo antiguo y temporal de run.json conserva la entrega", async () => {
  const data = await approvedFixture();
  try {
    await deliverActiveCampaign(data.root, data.desktop, date);
    const failedId = createBatchRunId();
    const scraped = join(data.root, "storage", "scraped", "campaigns", failedId);
    const gamDir = join(scraped, "gam");
    const runDir = join(data.root, "storage", "runs", failedId);
    await mkdir(gamDir, { recursive: true });
    await mkdir(runDir, { recursive: true });
    const partial = join(gamDir, `${prefixes.gam}-all.csv.${randomUUID()}.tmp`);
    const staged = join(runDir, `run.json.${randomUUID()}.tmp`);
    const lock = join(scraped, ".batch.lock");
    await writeFile(partial, "categoryKey,categoryName,title,\nparcial");
    await writeFile(staged, '{"version":1');
    await writeFile(lock, JSON.stringify({ runId: failedId, pid: 2147483000, startedAt: "2026-10-28T08:00:00.000Z" }));
    await writeFile(join(runDir, "run.json"), JSON.stringify({
      version: 1, runId: failedId, status: "running", requestedProviders: [...CAMPAIGN_PROVIDERS],
      startedAt: "2026-10-28T08:00:00.000Z", endedAt: null, providers: []
    }));
    assert.equal((await inspectRecoverableCampaign(data.root, failedId)).canAbandon, true);
    await abandonFailedCampaign(data.root, failedId);
    await assert.rejects(lstat(scraped), /ENOENT/);
    await assert.rejects(lstat(runDir), /ENOENT/);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).zipStatus, "verified");
  } finally { await data.cleanup(); }
});

test("un bloqueo activo o de otra ejecución impide abandonar sin borrar sus archivos", async () => {
  const data = await fixture();
  try {
    const failedId = createBatchRunId();
    const folder = join(data.root, "storage", "scraped", "campaigns", failedId);
    const file = join(data.root, "storage", "runs", failedId, "run.json");
    await mkdir(folder, { recursive: true });
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({
      version: 1, runId: failedId, status: "running", requestedProviders: [...CAMPAIGN_PROVIDERS],
      startedAt: "2026-10-28T08:00:00.000Z", endedAt: null, providers: []
    }));
    const lockFile = join(folder, ".batch.lock");
    for (const owner of [
      { runId: failedId, pid: process.pid, startedAt: "2026-10-28T08:00:00.000Z" },
      { runId: "otro-lote", pid: 2147483000, startedAt: "2026-10-28T08:00:00.000Z" }
    ]) {
      const content = JSON.stringify(owner);
      await writeFile(lockFile, content);
      await assert.rejects(inspectRecoverableCampaign(data.root, failedId), /PID|Bloqueo de otra ejecución/);
      await assert.rejects(abandonFailedCampaign(data.root, failedId), /PID|Bloqueo de otra ejecución/);
      assert.equal(await readFile(lockFile, "utf8"), content);
      assert.ok((await readFile(file)).length > 0);
    }
    await writeFile(lockFile, "bloqueo ilegible");
    await assert.rejects(abandonFailedCampaign(data.root, failedId), /propietario/);
    assert.equal(await readFile(lockFile, "utf8"), "bloqueo ilegible");
  } finally { await data.cleanup(); }
});

test("se puede abandonar expresamente un directorio ligado al runId aunque falte el primer run.json", async () => {
  const data = await approvedFixture();
  try {
    const delivered = await deliverActiveCampaign(data.root, data.desktop, date);
    const failedId = createBatchRunId();
    const folder = join(data.root, "storage", "scraped", "campaigns", failedId);
    const first = join(folder, "gam");
    const runDir = join(data.root, "storage", "runs", failedId);
    const staged = join(runDir, `run.json.${randomUUID()}.tmp`);
    await mkdir(first, { recursive: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(staged, '{"version":1');
    await writeFile(join(first, `${prefixes.gam}-all.csv.${randomUUID()}.tmp`), "contenido parcial");
    await writeFile(join(folder, ".batch.lock"), JSON.stringify({
      runId: failedId, pid: 2147483000, startedAt: "2026-10-28T08:00:00.000Z"
    }));
    assert.equal((await inspectRecoverableCampaign(data.root, failedId)).status, "interrupted");
    await abandonFailedCampaign(data.root, failedId);
    await assert.rejects(lstat(folder), /ENOENT/);
    await assert.rejects(lstat(runDir), /ENOENT/);
    assert.ok((await readFile(delivered.zipFile)).length > 0);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, data.runId)).zipStatus, "verified");
  } finally { await data.cleanup(); }
});

test("un huérfano sin run.json no permite borrar temporales ajenos ni un bloqueo activo", async () => {
  const data = await fixture();
  try {
    const failedId = createBatchRunId();
    const folder = join(data.root, "storage", "scraped", "campaigns", failedId);
    const runDir = join(data.root, "storage", "runs", failedId);
    await mkdir(folder, { recursive: true });
    await mkdir(runDir, { recursive: true });
    const foreign = join(runDir, "run.json.ajeno.tmp");
    await writeFile(foreign, "No es un temporal generado por el pipeline");
    await assert.rejects(abandonFailedCampaign(data.root, failedId), /no reconocido|No se borra/);
    assert.ok((await readFile(foreign)).length > 0);
    await rm(foreign);
    const lockFile = join(folder, ".batch.lock");
    await writeFile(lockFile, JSON.stringify({
      runId: failedId, pid: process.pid, startedAt: "2026-10-28T08:00:00.000Z"
    }));
    await assert.rejects(abandonFailedCampaign(data.root, failedId), /PID/);
    assert.ok((await readFile(lockFile)).length > 0);
  } finally { await data.cleanup(); }
});

test("un directorio aislado creado antes de run.json se puede abandonar sin afectar originales independientes", async () => {
  const data = await approvedFixture();
  try {
    await deliverActiveCampaign(data.root, data.desktop, date);
    const failedId = createBatchRunId();
    const folder = join(data.root, "storage", "scraped", "campaigns", failedId);
    const unrelated = join(data.root, "storage", "scraped", "manain", "censo.csv");
    await mkdir(folder, { recursive: true });
    await mkdir(dirname(unrelated), { recursive: true });
    await writeFile(unrelated, "censo independiente");
    assert.equal((await inspectRecoverableCampaign(data.root, failedId)).status, "interrupted");
    await abandonFailedCampaign(data.root, failedId);
    await assert.rejects(lstat(folder), /ENOENT/);
    assert.equal(await readFile(unrelated, "utf8"), "censo independiente");
  } finally { await data.cleanup(); }
});

test("la reanudación de rotación no retira una carpeta bloqueada por un proceso activo", async () => {
  const data = await approvedFixture();
  try {
    await deliverActiveCampaign(data.root, data.desktop, date);
    const successorId = await createSecondCampaign(data.root);
    await deliverActiveCampaign(data.root, data.desktop, date);
    await writeInterruptedRotation(data.root, data.runId, successorId);
    const folder = join(data.root, "storage", "scraped", "campaigns", data.runId);
    const lock = join(folder, ".batch.lock");
    await writeFile(lock, JSON.stringify({
      runId: data.runId, pid: process.pid, startedAt: "2026-10-28T08:00:00.000Z"
    }));
    await assert.rejects(prepareCampaignAdmission(data.root, false), /PID/);
    assert.ok((await readFile(lock)).length > 0);
    assert.ok((await readFile(join(data.root, "storage", "scraped", "campaigns", ".rotation.json"))).length > 0);
    assert.deepEqual((await listCampaignRuns(data.root)).map(({ report }) => report.runId), [successorId, data.runId]);
    await writeFile(lock, JSON.stringify({
      runId: data.runId, pid: 2147483000, startedAt: "2026-10-28T08:00:00.000Z"
    }));
    await prepareCampaignAdmission(data.root, false);
    await assert.rejects(lstat(folder), /ENOENT/);
    assert.equal((await verifyDeliveredCampaign(data.root, data.desktop, successorId)).zipStatus, "verified");
  } finally { await data.cleanup(); }
});
