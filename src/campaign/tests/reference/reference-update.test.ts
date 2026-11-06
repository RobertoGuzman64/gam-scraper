import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { readCampaignReference } from "../../../infrastructure/filesystem/reference/store.js";
import { deliverActiveCampaign } from "../../delivery/execute.js";
import { planDeliveredCampaignCleanup } from "../../cleanup.js";
import { finalizeActiveCampaign } from "../../finalization.js";
import { updateActiveCampaignReference } from "../../reference/update-legacy.js";
import { CAMPAIGN_PROVIDERS } from "../../discovery/report.js";
import { reuseCampaignTestFixture } from "../campaign-catalog-fixture.js";
import { createFixture } from "../finalization-fixture.js";

const fixtures = reuseCampaignTestFixture(createFixture);
after(fixtures.close);

const approve = async (root: string): Promise<void> => {
  const selection = await finalizeActiveCampaign(root, false);
  assert.ok(selection.status === "draft" || selection.status === "pending");
  const draft: unknown = JSON.parse(await readFile(selection.draftFile, "utf8"));
  if (!draft || typeof draft !== "object" || !("exclusions" in draft) || !Array.isArray(draft.exclusions)) {
    throw new Error("Expediente editorial de prueba inválido");
  }
  const approved = {
    ...draft, approved: true, approvalReason: "Revisión manual de prueba",
    exclusions: draft.exclusions.map((entry: unknown) => {
      if (!entry || typeof entry !== "object" || !("status" in entry) || !("sourceUrl" in entry) ||
        typeof entry.sourceUrl !== "string") throw new Error("Exclusión editorial de prueba inválida");
      return { ...entry, decision: entry.status === "intervention" ? "incluir" : "excluir",
        reason: "Ficha comprobada", evidenceUrls: [entry.sourceUrl] };
    })
  };
  await writeFile(selection.draftFile, JSON.stringify(approved, null, 2));
};

const withCampaign = async (
  callback: (root: string, desktop: string, runId: string) => Promise<void>,
  state: "reviewed" | "approved" = "reviewed"
): Promise<void> => {
  const data = state === "approved" ? await fixtures.prepared("reference-approved", async (campaign) => {
    await approve(campaign.root);
  }) : await fixtures.fixture();
  const desktop = join(data.root, "Escritorio");
  try {
    await mkdir(desktop, { recursive: true });
    await callback(data.root, desktop, data.runId);
  } finally {
    await data.cleanup();
  }
};

test("la actualización requiere entrega acreditada y conserva los originales completos", async () => withCampaign(async (root, desktop, runId) => {
  assert.equal(await readCampaignReference(root), null);
  await assert.rejects(updateActiveCampaignReference(root, desktop), /entrega|preparaciones|acreditación/i);
  await approve(root);
  await assert.rejects(updateActiveCampaignReference(root, desktop), /justificante|entrega/i);
  await deliverActiveCampaign(root, desktop, new Date(2026, 9, 26, 12));
  const result = await updateActiveCampaignReference(root, desktop);
  assert.equal(result.manifest.runId, runId);
  assert.equal(result.comparison.baseline, "initial");
  const saved = await readCampaignReference(root);
  assert.deepEqual(saved?.catalogs.map((catalog) => catalog.productCount), [4, 4, 4, 1]);
  assert.deepEqual(saved?.catalogs.map((catalog) => catalog.providerId), CAMPAIGN_PROVIDERS);
  assert.equal(saved?.manifest.runId, runId);
  await assert.rejects(updateActiveCampaignReference(root, desktop), /ya está guardado/);
}));

test("la referencia acreditada no depende del inventario de archivos eliminables", async () => withCampaign(async (root, desktop, runId) => {
  await deliverActiveCampaign(root, desktop, new Date(2026, 9, 26, 12));
  const auxiliary = join(root, "storage", "scraped", "campaigns", runId, "gam", "auxiliar-ajeno.csv");
  await writeFile(auxiliary, "archivo ajeno a la limpieza");
  await assert.rejects(planDeliveredCampaignCleanup(root, desktop), /no reconocido/);
  const result = await updateActiveCampaignReference(root, desktop);
  assert.equal(result.manifest.runId, runId);
  assert.equal((await readCampaignReference(root))?.manifest.runId, runId);
  assert.equal(await readFile(auxiliary, "utf8"), "archivo ajeno a la limpieza");
  await assert.rejects(planDeliveredCampaignCleanup(root, desktop), /no reconocido/);
}, "approved"));
test("si la entrega acreditada cambia, no puede modificar la referencia válida", async () => withCampaign(async (root, desktop, runId) => {
  await deliverActiveCampaign(root, desktop, new Date(2026, 9, 26, 12));
  await updateActiveCampaignReference(root, desktop);
  const original = await readFile(join(root, "data", "reference", "manifest.json"), "utf8");
  const receipt = join(root, "storage", "campaigns", runId, "delivery.json");
  const content: unknown = JSON.parse(await readFile(receipt, "utf8"));
  if (!content || typeof content !== "object" || !("zipSha256" in content)) {
    throw new Error("Justificante de prueba inválido");
  }
  await writeFile(receipt, JSON.stringify({ ...content, zipSha256: "0".repeat(64) }));
  await assert.rejects(updateActiveCampaignReference(root, desktop), /modificado|entrega|ZIP/);
  assert.equal(await readFile(join(root, "data", "reference", "manifest.json"), "utf8"), original);
}, "approved"));
