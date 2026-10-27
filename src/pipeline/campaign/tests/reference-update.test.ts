import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { readCampaignReference } from "../../../infrastructure/filesystem/campaign-reference.js";
import { deliverActiveCampaign } from "../delivery.js";
import { planDeliveredCampaignCleanup } from "../cleanup.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { reviewActiveCampaign } from "../review.js";
import { updateActiveCampaignReference } from "../reference-update.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { copyCampaignTestCatalog } from "./campaign-catalog-fixture.js";
import type { BatchReport, ProviderRun } from "../../batch/report-types.js";

const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva"
} as const;

const withCampaign = async (callback: (root: string, desktop: string, runId: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-reference-update-"));
  const desktop = join(root, "Escritorio");
  const runId = `lote-${randomUUID()}`;
  try {
    await mkdir(desktop);
    const providers: ProviderRun[] = [];
    for (const providerId of CAMPAIGN_PROVIDERS) {
      const prefix = prefixes[providerId];
      const outputDir = join(root, "storage", "scraped", "campaigns", runId, providerId);
      await mkdir(outputDir, { recursive: true });
      const catalog = await copyCampaignTestCatalog(resolve("src/testing/fixtures"), outputDir, providerId, prefix);
      providers.push({
        providerId, status: "complete", startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
        endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(), durationMs: 1000,
        outputDir, outputPrefix: prefix, logFile: join(outputDir, "missing.log"),
        summaryFile: join(outputDir, `${prefix}-summary.json`), changesFile: join(outputDir, `${prefix}-changes.json`)
      });
    }
    const runFile = join(root, "storage", "runs", runId, "run.json");
    const report: BatchReport = {
      version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
      startedAt: "2026-10-22T08:20:00.000Z", endedAt: "2026-10-22T09:10:00.000Z", providers
    };
    await mkdir(dirname(runFile), { recursive: true });
    await writeFile(runFile, JSON.stringify(report));
    assert.equal((await reviewActiveCampaign(root)).complete, true);
    await callback(root, desktop, runId);
  } finally { await rm(root, { recursive: true, force: true }); }
};

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
  assert.deepEqual(saved?.catalogs.map((catalog) => catalog.productCount), [4, 4, 4]);
  assert.deepEqual(saved?.catalogs.map((catalog) => catalog.providerId), CAMPAIGN_PROVIDERS);
  assert.equal(saved?.manifest.runId, runId);
  await assert.rejects(updateActiveCampaignReference(root, desktop), /ya está guardado/);
}));

test("la referencia acreditada no depende del inventario de archivos eliminables", async () => withCampaign(async (root, desktop, runId) => {
  await approve(root);
  await deliverActiveCampaign(root, desktop, new Date(2026, 9, 26, 12));
  const auxiliary = join(root, "storage", "scraped", "campaigns", runId, "gam", "auxiliar-ajeno.csv");
  await writeFile(auxiliary, "archivo ajeno a la limpieza");
  await assert.rejects(planDeliveredCampaignCleanup(root, desktop), /no reconocido/);
  const result = await updateActiveCampaignReference(root, desktop);
  assert.equal(result.manifest.runId, runId);
  assert.equal((await readCampaignReference(root))?.manifest.runId, runId);
  assert.equal(await readFile(auxiliary, "utf8"), "archivo ajeno a la limpieza");
  await assert.rejects(planDeliveredCampaignCleanup(root, desktop), /no reconocido/);
}));

test("si la entrega acreditada cambia, no puede modificar la referencia válida", async () => withCampaign(async (root, desktop, runId) => {
  await approve(root);
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
}));
