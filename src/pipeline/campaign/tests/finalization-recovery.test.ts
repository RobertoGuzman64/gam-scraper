import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/offline-preparation.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { persistAppliedIntervention } from "../../../infrastructure/filesystem/intervention-application.js";
import { interveneActiveCampaign } from "../intervention.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { reuseCampaignTestFixture } from "./campaign-catalog-fixture.js";
import { campaignScript, createFixture, prefixes } from "./finalization-fixture.js";

const fixtureCache = reuseCampaignTestFixture(createFixture);
const fixture = fixtureCache.fixture;
after(fixtureCache.close);

test("la manipulación de una preparación intervenida bloquea la finalización", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const applied = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.ok(applied.preparationFile);
    await writeFile(applied.preparationFile, "{}");
    await assert.rejects(finalizeActiveCampaign(data.root, false), /No se puede finalizar/);
  } finally { await data.cleanup(); }
});

test("recupera un resultado aplicado íntegro tras una interrupción antes de prepararlo", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const preview = await interveneActiveCampaign(data.root, "gam", [script], false);
    const original = data.providers.find((item) => item.providerId === "gam");
    assert.ok(original);
    const source = join(original.outputDir, `${original.outputPrefix}-catalog.json`);
    assert.ok(preview.simulation);
    const pending = await persistAppliedIntervention({
      source, scripts: [script], campaign: data.runId, confirmation: preview.simulation.planSha256,
      simulation: preview.simulation, workspaceRoot: data.root
    });
    const resumed = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(resumed.derivedFile, join(pending.path, "catalog-derived.json"));
    assert.ok(resumed.preparationFile);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "draft");
  } finally { await data.cleanup(); }
});

test("una intervención nueva invalida la ruta del borrador editorial anterior sin alterar su contenido", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial } = await import("../editorial.js");
    const draft = await finalizeActiveCampaign(data.root, false);
    const original = await readFile(draft.draftFile, "utf8");
    const script = await campaignScript(data.root, data.runId);
    await interveneActiveCampaign(data.root, "gam", [script], true);
    await assert.rejects(inspectActiveCampaignEditorial(data.root), /No existe borrador vigente/);
    assert.equal(await readFile(draft.draftFile, "utf8"), original);
    const next = await finalizeActiveCampaign(data.root, false);
    assert.notEqual(next.draftFile, draft.draftFile);
  } finally { await data.cleanup(); }
});

test("permite aprobar la inclusión humana de una ficha intervenida y lista", async () => {
  const data = await fixture();
  try {
    const { inspectActiveCampaignEditorial, decideActiveCampaignEditorial, approveActiveCampaignEditorial } =
      await import("../editorial.js");
    const script = await campaignScript(data.root, data.runId);
    const provider = data.review.providers.find((item) => item.providerId === "gam");
    assert.ok(provider?.preparationFile);
    const preparation = await readOfflinePreparation(provider.preparationFile, "gam");
    const ready = preparation.products.find((item) => item.status === "ready" && item.product.title !== null);
    assert.ok(ready?.product.title);
    const originalProvider = data.providers.find((item) => item.providerId === "gam");
    assert.ok(originalProvider);
    const catalogFile = join(originalProvider.outputDir, `${originalProvider.outputPrefix}-catalog.json`);
    const catalog = await readCanonicalCatalog(catalogFile);
    const product = catalog.products.find((item) => item.reference === ready.product.reference);
    assert.ok(product?.title);
    await writeFile(script, `export const proposals = ${JSON.stringify([{
      providerId: "gam", identity: buildProductIdentity(product).key, field: "title", expected: product.title,
      next: `${product.title} contrastada`, reason: "Corrección contrastada de título de esta máquina",
      evidence: "Revisión individual de la fuente vigente antes de publicar"
    }])};`);
    await interveneActiveCampaign(data.root, "gam", [script], true);
    await finalizeActiveCampaign(data.root, false);
    const draft = await inspectActiveCampaignEditorial(data.root);
    const affected = draft.accreditation.exclusions.find((item) => item.status === "intervention");
    assert.ok(affected);
    for (const item of draft.accreditation.exclusions) {
      await decideActiveCampaignEditorial(data.root, {
        providerId: item.providerId, reference: item.reference,
        decision: item.status === "intervention" ? "incluir" : "excluir",
        reason: "Ficha comprobada y decisión humana justificada con su publicación.",
        evidenceUrls: [item.sourceUrl]
      });
    }
    const approved = await approveActiveCampaignEditorial(data.root,
      "Aprobación manual de intervenciones y exclusiones de la campaña vigente.");
    assert.equal(approved.inspection.completed, draft.inspection.total);
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.ok(selected.selection?.products.some((item) =>
      item.providerId === affected.providerId && item.reference === affected.reference));
  } finally { await data.cleanup(); }
});
