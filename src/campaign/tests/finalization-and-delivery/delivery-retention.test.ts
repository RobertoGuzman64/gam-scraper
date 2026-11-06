import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readPortableCampaign } from "../../../infrastructure/filesystem/catalog/portable-campaign.js";
import { deliverActiveCampaign } from "../../delivery/execute.js";
import { verifyDeliveredCampaign } from "../../delivery/verification.js";
import { prepareCampaignAdmission } from "../../retention/admission.js";
import { abandonFailedCampaign } from "../../retention/recovery.js";
import { listCampaignRuns } from "../../discovery/search.js";
import { createDeliveryFixtures, date, createSecondCampaign, createFailedCampaign } from "./delivery-fixtures.js";

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
