import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
