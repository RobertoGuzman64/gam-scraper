import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { inspectBeforeExtraction } from "../preflight.js";
import { reviewActiveCampaign } from "../review.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import type { BatchReport, ProviderRun } from "../../batch/report-types.js";

const sourceRoot = resolve("src/testing/fixtures");

const populate = async (root: string, providerId: string): Promise<ProviderRun> => {
  const source = join(sourceRoot, providerId);
  const names = ["gam", "gomariz", "mercaeleva"];
  const prefixes = ["scrape-gam-marzo-2026", "scrape-gomariz", "scrape-mercaeleva"];
  const prefix = prefixes[names.indexOf(providerId)];
  if (!prefix) throw new Error("Proveedor no admitido");
  const dir = join(root, "storage", "scraped", "campaigns", "prueba", providerId);
  await mkdir(dir, { recursive: true });
  for (const name of [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`]) {
    await copyFile(join(source, name), join(dir, name));
  }
  const catalog: unknown = JSON.parse(await readFile(join(dir, `${prefix}-catalog.json`), "utf8"));
  if (!catalog || typeof catalog !== "object" || !("startedAt" in catalog) || !("endedAt" in catalog) ||
    typeof catalog.startedAt !== "string" || typeof catalog.endedAt !== "string") {
    throw new Error("Catálogo de prueba inválido");
  }
  const startedAt = new Date(Date.parse(catalog.startedAt) - 1000).toISOString();
  const endedAt = new Date(Date.parse(catalog.endedAt) + 1000).toISOString();
  return {
    providerId, status: "complete", startedAt, endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    outputDir: dir, outputPrefix: prefix, logFile: join(root, "missing.log"),
    summaryFile: join(dir, `${prefix}-summary.json`), changesFile: join(dir, `${prefix}-changes.json`)
  };
};

const writeRun = async (root: string, status: BatchReport["status"], providers: readonly ProviderRun[]): Promise<void> => {
  const runId = "revision-actual";
  const file = join(root, "storage", "runs", runId, "run.json");
  await mkdir(dirname(file), { recursive: true });
  const report: BatchReport = {
    version: 1, runId, status, startedAt: "2026-10-22T08:20:00.000Z",
    endedAt: status === "running" ? null : "2026-10-22T09:10:00.000Z",
    requestedProviders: [...CAMPAIGN_PROVIDERS], providers
  };
  await writeFile(file, JSON.stringify(report));
};

test("instalación sin históricos no intenta generar una preparación", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-review-clean-"));
  try {
    const result = await reviewActiveCampaign(root);
    assert.equal(result.complete, false);
    assert.equal(result.campaign.status, "none");
    assert.deepEqual(result.providers.map((p) => p.state), ["pending", "pending", "pending"]);
    const inspect = await inspectBeforeExtraction(root);
    assert.equal(inspect.requiresNewCampaign, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("un lote incompleto exige reconocerlo antes de empezar otro y no se prepara automáticamente", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-review-incomplete-"));
  try {
    await writeRun(root, "failed", []);
    const inspect = await inspectBeforeExtraction(root);
    assert.equal(inspect.requiresNewCampaign, true);
    const reviewed = await reviewActiveCampaign(root);
    assert.equal(reviewed.complete, false);
    assert.ok(reviewed.campaign.issues.some((issue) => issue.includes("no es seleccionable")));
    assert.deepEqual(reviewed.providers.map((provider) => provider.state), ["pending", "pending", "pending"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("prepara y valida los tres catálogos del mismo run sin cambiar los Review; reutiliza preparaciones válidas", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-review-run-"));
  try {
    const providers = await Promise.all(CAMPAIGN_PROVIDERS.map((id) => populate(root, id)));
    await writeRun(root, "complete", providers);
    const first = await reviewActiveCampaign(root);
    assert.equal(first.complete, true, JSON.stringify(first.providers.filter((p) => p.state !== "validated")));
    assert.deepEqual(first.providers.map((p) => p.state), ["validated", "validated", "validated"]);
    for (const p of first.providers) {
      assert.equal(p.ready! + p.review!, p.products);
      assert.ok(p.preparationFile?.includes(join("storage", "campaigns", "revision-actual")));
      assert.equal(p.items?.length, p.review);
      for (const issue of p.items ?? []) {
        assert.ok(issue.reference.length > 0);
        assert.ok(issue.url.length > 0);
        assert.ok(issue.issues.length > 0);
      }
    }
    const second = await reviewActiveCampaign(root);
    assert.equal(second.complete, true, JSON.stringify(second.providers.filter((p) => p.state !== "validated")));
    assert.deepEqual(second.providers.map((p) => p.preparationFile), first.providers.map((p) => p.preparationFile));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("una preparación alterada bloquea la revisión y no se reemplaza silenciosamente", async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-review-invalid-"));
  try {
    const providers = await Promise.all(CAMPAIGN_PROVIDERS.map((id) => populate(root, id)));
    await writeRun(root, "complete", providers);
    const first = await reviewActiveCampaign(root);
    assert.equal(first.complete, true);
    const preparationFile = first.providers[0]?.preparationFile;
    assert.ok(preparationFile);
    await writeFile(preparationFile, "{}");
    const second = await reviewActiveCampaign(root);
    assert.equal(second.complete, false);
    assert.ok(second.campaign.issues.some((issue) => issue.includes("Preparación no verificable")));
    assert.equal(await readFile(preparationFile, "utf8"), "{}");
  } finally { await rm(root, { recursive: true, force: true }); }
});
