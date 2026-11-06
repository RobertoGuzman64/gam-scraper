import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { finalizeActiveCampaign } from "../../finalization.js";
import { reuseCampaignTestFixture } from "../campaign-catalog-fixture.js";
import { createFixture } from "../finalization-fixture.js";

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

test("los argumentos CLI aplican las decisiones y validan sin aprobar por defecto", async () => {
  const data = await fixture();
  try {
    const { runCampaignFinalization } = await import("../../../cli/commands/campaign/campaign-finalize.js");
    const { inspectActiveCampaignEditorial } = await import("../../editorial.js");
    await runCampaignFinalization([], data.root);
    const draft = await inspectActiveCampaignEditorial(data.root);
    const entry = draft.accreditation.exclusions[0];
    assert.ok(entry);
    await runCampaignFinalization(["--consultar", entry.providerId, entry.reference], data.root);
    await runCampaignFinalization(["--listar"], data.root);
    await assert.rejects(runCampaignFinalization(["--validar"], data.root), /incidencias editoriales/);
    await runCampaignFinalization(["--decidir", entry.providerId, entry.reference, "excluir",
      "--motivo", "Incidencia verificada manualmente con su fuente original.", "--evidencia", entry.sourceUrl], data.root);
    await assert.rejects(runCampaignFinalization(["--aprobar", "--motivo", "Conjunto cotejado y aprobado humanamente en esta campaña."], data.root),
      /decisión pendiente/);
    await assert.rejects(runCampaignFinalization(["--decidir", entry.providerId, entry.reference, "excluir",
      "--motivo", "Incidencia verificada manualmente con su fuente original.", "--evidencia"], data.root), /evidencia/);
    const updated = await inspectActiveCampaignEditorial(data.root);
    assert.equal(updated.inspection.completed, 1);
    assert.equal(updated.accreditation.exclusions[0]?.decision, "excluir");
    assert.equal(updated.accreditation.approved, false);
  } finally { await data.cleanup(); }
});

test("la edición simultánea no pierde decisiones ni deja bloqueos de escritura", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial } = await import("../../editorial.js");
    await finalizeActiveCampaign(data.root, false);
    const initial = await inspectActiveCampaignEditorial(data.root);
    const entries = initial.accreditation.exclusions.slice(0, 2);
    assert.equal(entries.length, 2);
    const results = await Promise.allSettled(entries.map((entry) => decideActiveCampaignEditorial(data.root, {
      providerId: entry.providerId, reference: entry.reference, decision: "excluir",
      reason: "Incidencia contrastada manualmente con la publicación vigente.", evidenceUrls: [entry.sourceUrl]
    })));
    const after = await inspectActiveCampaignEditorial(data.root);
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const entry = entries[index];
      assert.ok(result && entry);
      if (result.status === "fulfilled") {
        assert.equal(after.accreditation.exclusions.find((item) =>
          item.providerId === entry.providerId && item.reference === entry.reference)?.decision, "excluir");
      }
    }
    assert.ok(results.some((result) => result.status === "fulfilled"));
    await assert.rejects(readFile(`${initial.draftFile}.lock`), /ENOENT/);
  } finally { await data.cleanup(); }
});
