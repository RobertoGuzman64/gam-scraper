import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { finalizeActiveCampaign } from "../../finalization.js";
import { reuseCampaignTestFixture } from "../campaign-catalog-fixture.js";
import { createFixture } from "../finalization-fixture.js";

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

test("rechaza borradores caducados, estructura adulterada y edición de selecciones existentes", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial } =
      await import("../../editorial.js");
    const draft = await finalizeActiveCampaign(data.root, false);
    const editorial = await inspectActiveCampaignEditorial(data.root);
    const first = editorial.accreditation.exclusions[0];
    assert.ok(first);
    const content = await readFile(draft.draftFile, "utf8");
    await writeFile(draft.draftFile, `\ufeff${content}`);
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /BOM UTF-8/);
    await writeFile(draft.draftFile, JSON.stringify({
      ...editorial.accreditation,
      exclusions: editorial.accreditation.exclusions.map((item, index) =>
        index === 0 ? { ...item, issues: ["manipulado"] } : item)
    }));
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /caducada/);
    await writeFile(draft.draftFile, content);
    const selectionFolder = join(data.root, "storage", "campaigns", data.runId, "selection");
    await mkdir(selectionFolder, { recursive: true });
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: first.providerId, reference: first.reference, decision: "excluir",
      reason: "Ficha contrastada manualmente con la publicación vigente.", evidenceUrls: [first.sourceUrl]
    }), /ya tiene selección/);
    await rm(selectionFolder, { recursive: true });
  } finally { await data.cleanup(); }
});
