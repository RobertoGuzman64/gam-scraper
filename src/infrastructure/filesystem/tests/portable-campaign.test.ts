import assert from "node:assert/strict";
import { readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { finalizeActiveCampaign } from "../../../pipeline/campaign/finalization.js";
import { approveDraft, createFixture } from "../../../pipeline/campaign/tests/finalization-fixture.js";
import { reuseCampaignTestFixture } from "../../../pipeline/campaign/tests/campaign-catalog-fixture.js";
import { readPortableCampaign } from "../catalog/portable-campaign.js";

const fixtures = reuseCampaignTestFixture(createFixture);
after(fixtures.close);

test("solo una acreditación aprobada crea una campaña íntegra y portable, sin storage", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    assert.equal(draft.status, "draft");
    await assert.rejects(readPortableCampaign(data.root, data.runId), /ausente/);
    await approveDraft(draft.draftFile);
    assert.equal((await finalizeActiveCampaign(data.root, true)).status, "simulation");
    await assert.rejects(readPortableCampaign(data.root, data.runId), /ausente/);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
    const first = await readPortableCampaign(data.root, data.runId);
    assert.equal(Object.keys(first.files).length, 18);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
    assert.deepEqual(await readPortableCampaign(data.root, data.runId), first);
    await rm(join(data.root, "storage"), { recursive: true, force: true });
    const moved = `${data.root}-moved`;
    await rename(data.root, moved);
    try { assert.deepEqual(await readPortableCampaign(moved, data.runId), first); }
    finally { await rename(moved, data.root); }
  } finally { await data.cleanup(); }
});

test("la campaña portátil detecta alteración de JSON final y no conserva directorios históricos internos", async () => {
  const data = await fixtures.fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    await finalizeActiveCampaign(data.root, false);
    const base = join(data.root, "catalogs", "campaigns", data.runId);
    assert.deepEqual((await readdir(join(data.root, "catalogs", "campaigns"))).sort(), [data.runId]);
    const file = join(base, "gam", "publishable.json");
    const before = await readFile(file, "utf8");
    await writeFile(file, `${before} `);
    await assert.rejects(readPortableCampaign(data.root, data.runId), /Integridad/);
    await assert.rejects(finalizeActiveCampaign(data.root, false), /Integridad/);
    assert.equal(await readFile(file, "utf8"), `${before} `);
  } finally { await data.cleanup(); }
});

test("las correcciones acreditadas preservan original, derivado y expediente sin storage", async () => {
  const data = await fixtures.fixture();
  try {
    const { campaignScript } = await import("../../../pipeline/campaign/tests/finalization-fixture.js");
    const { interveneActiveCampaign } = await import("../../../pipeline/campaign/intervention.js");
    const script = await campaignScript(data.root, data.runId);
    const applied = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(applied.applied, true);
    const draft = await finalizeActiveCampaign(data.root, false);
    await approveDraft(draft.draftFile);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
    const base = join(data.root, "catalogs", "campaigns", data.runId, "gam");
    assert.equal((await readdir(base)).length, 6);
    await rm(join(data.root, "storage"), { recursive: true, force: true });
    await readPortableCampaign(data.root, data.runId);
    const record = join(base, "intervention-record.json");
    const raw = await readFile(record, "utf8");
    await writeFile(record, raw.replace("applied", "tampered"));
    await assert.rejects(readPortableCampaign(data.root, data.runId), /Integridad/);
  } finally { await data.cleanup(); }
});
