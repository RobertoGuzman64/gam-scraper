import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { copyCampaignTestCatalog } from "./campaign-catalog-fixture.js";
import { reviewActiveCampaign } from "../review.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { deliverActiveCampaign } from "../delivery.js";
import { cleanDeliveredCampaign } from "../cleanup.js";
import { updateActiveCampaignReference } from "../reference-update.js";
import { inspectCampaignOperations } from "../operations-status.js";
import type { BatchReport, ProviderRun } from "../../batch/report-types.js";

const fixtures = resolve("src/testing/fixtures");
const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva"
} as const;

const createCampaign = async (root: string): Promise<string> => {
  const runId = `lote-${randomUUID()}`;
  const providers: ProviderRun[] = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[providerId];
    const dir = join(root, "storage", "scraped", "campanas", runId, providerId);
    await mkdir(dir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(fixtures, dir, providerId, prefix);
    providers.push({
      providerId, status: "complete",
      startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
      endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
      durationMs: 1000, outputDir: dir, outputPrefix: prefix,
      logFile: join(dir, "missing.log"), summaryFile: join(dir, `${prefix}-summary.json`),
      changesFile: join(dir, `${prefix}-changes.json`)
    });
  }
  const runFile = join(root, "storage", "runs", runId, "run.json");
  const report: BatchReport = {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-22T08:20:00.000Z", endedAt: "2026-10-22T09:10:00.000Z", providers
  };
  await mkdir(dirname(runFile), { recursive: true });
  await writeFile(runFile, JSON.stringify(report));
  return runId;
};

test("estado de campaña sin escritura y orientación consistente entre editorial, entrega y referencia", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-estado-"));
  const desktop = join(root, "Escritorio");
  try {
    const initial = await inspectCampaignOperations(root, desktop);
    assert.equal(initial.campaign.runId, null);
    assert.ok(initial.next.includes("npm run campana:extraer"));
    assert.deepEqual(await readdir(root), []);

    const runId = await createCampaign(root);
    const unprepared = await inspectCampaignOperations(root, desktop);
    assert.deepEqual(unprepared.next, ["npm run campana:revisar"]);
    assert.equal(unprepared.reference.status, "absent");
    assert.equal((await readdir(join(root, "storage", "campanas")).catch(() => [])).length, 0);

    const review = await reviewActiveCampaign(root);
    assert.equal(review.complete, true);
    const beforeDraft = await inspectCampaignOperations(root, desktop);
    assert.deepEqual(beforeDraft.next, ["npm run campana:finalizar"]);
    const created = await finalizeActiveCampaign(root, false);
    assert.equal(created.status, "draft");
    const pending = await inspectCampaignOperations(root, desktop);
    assert.match(pending.description, /Acreditación pendiente/);
    assert.ok(pending.next.some((command) => command.includes("--validar")));

    const raw: unknown = JSON.parse(await readFile(created.draftFile, "utf8"));
    assert.ok(raw && typeof raw === "object" && "exclusions" in raw && Array.isArray(raw.exclusions));
    const next = {
      ...raw, approved: true, approvalReason: "Decisiones revisadas por una persona responsable",
      exclusions: raw.exclusions.map((entry: { readonly sourceUrl: string; readonly status: string }) => ({
        ...entry, decision: entry.status === "intervention" ? "incluir" : "excluir",
        reason: "Ficha contrastada con su fuente y revisada manualmente",
        evidenceUrls: [entry.sourceUrl]
      }))
    };
    await writeFile(created.draftFile, JSON.stringify(next, null, 2));
    const approved = await inspectCampaignOperations(root, desktop);
    assert.match(approved.description, /aprobada/);
    assert.deepEqual(approved.next, ["npm run campana:finalizar"]);
    const selected = await finalizeActiveCampaign(root, false);
    assert.equal(selected.status, "selected");
    const readyForDelivery = await inspectCampaignOperations(root, desktop);
    assert.ok(readyForDelivery.next.some((command) => command.includes("campana:entregar")));

    await mkdir(desktop);
    const delivered = await deliverActiveCampaign(root, desktop, new Date(2026, 9, 26, 12));
    const awaitingReference = await inspectCampaignOperations(root, desktop);
    assert.match(awaitingReference.description, /Entrega acreditada/);
    assert.ok(awaitingReference.next.some((command) => command.includes("--actualizar")));
    await updateActiveCampaignReference(root, desktop);
    const referenced = await inspectCampaignOperations(root, desktop);
    assert.match(referenced.description, /referencia verificada/);
    assert.ok(referenced.next.some((command) => command.includes("campana:limpiar")));
    assert.ok(referenced.next.every((command) => !command.includes("--actualizar")));
    assert.equal(referenced.reference.status, "valid");
    if (referenced.reference.status === "valid") assert.equal(referenced.reference.reference.manifest.runId, runId);

    const deliveredArchive = await readFile(delivered.zipFile);
    await writeFile(delivered.zipFile, "ZIP modificado");
    const altered = await inspectCampaignOperations(root, desktop);
    assert.match(altered.description, /no verificable/);
    assert.ok(altered.next.every((command) => !command.includes("campana:limpiar") && !command.includes("--actualizar")));

    await writeFile(delivered.zipFile, deliveredArchive);
    const cleanPlan = await cleanDeliveredCampaign(root, desktop, true);
    assert.ok(cleanPlan.directories.length > 0);
    const cleaned = await cleanDeliveredCampaign(root, desktop, false);
    assert.deepEqual(cleaned.directories, cleanPlan.directories);
    const afterCleanup = await inspectCampaignOperations(root, desktop);
    assert.equal(afterCleanup.campaign.runId, null);
    assert.equal(afterCleanup.reference.status, "valid");
    if (afterCleanup.reference.status === "valid") {
      assert.equal(afterCleanup.reference.reference.manifest.runId, runId);
    }
    assert.ok(afterCleanup.next.includes("npm run campana:extraer"));
    assert.ok(afterCleanup.next.every((command) => !command.includes("campana:limpiar")));
    assert.deepEqual(await readFile(delivered.zipFile), deliveredArchive);
    assert.equal((await readdir(join(root, "storage", "campanas"))).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
