import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../discovery/report.js";
import test, { after } from "node:test";
import { finalizeActiveCampaign } from "../../finalization.js";
import { reuseCampaignTestFixture } from "../campaign-catalog-fixture.js";
import { approveDraft, createFixture } from "../finalization-fixture.js";

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

test("elabora borrador del lote sin aprobación automática y selecciona solo al aprobar", async () => {
  const data = await fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    assert.equal(draft.status, "draft");
    assert.ok(draft.draftFile.includes(data.runId));
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "pending");
    await approveDraft(draft.draftFile);
    const simulated = await finalizeActiveCampaign(data.root, true);
    assert.equal(simulated.status, "simulation");
    assert.ok(simulated.selection);
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.ok(selected.selectionDir);
    assert.equal((await finalizeActiveCampaign(data.root, false)).selectionDir, selected.selectionDir);
    const totals = selected.selection?.totals;
    assert.equal(totals?.original, totals?.publishable! + totals?.excluded!);
    const publicables = await Promise.all(CAMPAIGN_PROVIDERS.map(async (id) =>
      JSON.parse(await readFile(join(selected.selectionDir!, `${id}-publishable.json`), "utf8")) as unknown));
    assert.equal(publicables.length, CAMPAIGN_PROVIDERS.length);
    assert.ok(publicables.every(Array.isArray));
  } finally { await data.cleanup(); }
});

test("no acepta acreditación incompleta y no crea selección", async () => {
  const data = await fixture();
  try {
    const draft = await finalizeActiveCampaign(data.root, false);
    const raw = JSON.parse(await readFile(draft.draftFile, "utf8"));
    raw.approved = true;
    raw.approvalReason = "Aprobación sin acreditar decisiones individuales";
    await writeFile(draft.draftFile, JSON.stringify(raw));
    await assert.rejects(finalizeActiveCampaign(data.root, false), /Acreditación editorial/);
  } finally { await data.cleanup(); }
});
