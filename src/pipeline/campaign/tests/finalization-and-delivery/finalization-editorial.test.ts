import assert from "node:assert/strict";
import test, { after } from "node:test";
import { finalizeActiveCampaign } from "../../finalization.js";
import { reuseCampaignTestFixture } from "../campaign-catalog-fixture.js";
import { createFixture } from "../finalization-fixture.js";

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

test("acredita editorialmente una campaña mediante operaciones guiadas sin editar JSON", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial, approveActiveCampaignEditorial } =
      await import("../../editorial.js");
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /No existe borrador vigente/);
    const draft = await finalizeActiveCampaign(data.root, false);
    const review = await inspectActiveCampaignEditorial(data.root);
    assert.equal(review.inspection.approved, false);
    assert.equal(review.inspection.completed, 0);
    assert.ok(review.inspection.total > 0);
    assert.equal(review.draftFile, draft.draftFile);
    const entry = review.accreditation.exclusions[0];
    assert.ok(entry);
    await assert.rejects(approveActiveCampaignEditorial(data.root, "Conjunto revisado y acreditado por el responsable."),
      /decisión pendiente/);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "incluir",
      reason: "Revisión manual documentada sobre la ficha", evidenceUrls: [entry.sourceUrl]
    }), /Solo se admite incluir/);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Motivo corto", evidenceUrls: [entry.sourceUrl]
    }), /al menos 15/);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Revisión manual documentada sobre la ficha", evidenceUrls: ["https://otro.example/expediente"]
    }), /URL original/);
    for (const item of review.accreditation.exclusions) {
      await decideActiveCampaignEditorial(data.root, {
        providerId: item.providerId, reference: item.reference, decision: "excluir",
        reason: "Contraste editorial individual con la ficha de origen vigente.",
        evidenceUrls: [item.sourceUrl]
      });
    }
    const validated = await inspectActiveCampaignEditorial(data.root);
    assert.equal(validated.inspection.completed, validated.inspection.total);
    assert.deepEqual(validated.inspection.issues, []);
    assert.equal(validated.inspection.approved, false);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "pending");
    const approved = await approveActiveCampaignEditorial(data.root,
      "Aprobación humana del conjunto completo tras revisar todas las fichas.");
    assert.equal(approved.inspection.approved, true);
    assert.equal(approved.inspection.issues.length, 0);
    await assert.rejects(decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Revisión manual documentada sobre la ficha", evidenceUrls: [entry.sourceUrl]
    }), /está aprobada/);
    assert.equal((await finalizeActiveCampaign(data.root, true)).status, "simulation");
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "selected");
  } finally { await data.cleanup(); }
});
