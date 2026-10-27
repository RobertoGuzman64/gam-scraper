import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { prepareSavedCatalog } from "../../preparation/prepare.js";
import { discoverCampaign, discoverCampaignCatalogHistory, CAMPAIGN_PROVIDERS } from "../discovery.js";
import type { BatchReport, ProviderRun } from "../../batch/report-types.js";

const fixtureRoot = resolve("src/testing/fixtures");

const createRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "equipzilla-campaign-discovery-"));

const populate = async (root: string, providerId: string): Promise<ProviderRun> => {
  const source = join(fixtureRoot, providerId);
  const names = ["gam", "gomariz", "mercaeleva"];
  const prefixes = ["scrape-gam-marzo-2026", "scrape-gomariz", "scrape-mercaeleva"];
  const prefix = prefixes[names.indexOf(providerId)];
  if (!prefix) throw new Error("Proveedor de prueba no declarado");
  const outputDir = join(root, "storage", "scraped", providerId);
  await mkdir(outputDir, { recursive: true });
  for (const name of [`${prefix}-catalog.json`, `${prefix}-catalog.manifest.json`, `${prefix}-summary.json`]) {
    await copyFile(join(source, name), join(outputDir, name));
  }
  const catalog: unknown = JSON.parse(await readFile(join(outputDir, `${prefix}-catalog.json`), "utf8"));
  if (!catalog || typeof catalog !== "object" || !("startedAt" in catalog) || !("endedAt" in catalog) ||
    typeof catalog.startedAt !== "string" || typeof catalog.endedAt !== "string") {
    throw new Error("Fixture de catálogo inválido");
  }
  return {
    providerId, status: "complete", startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
    endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
    durationMs: Date.parse(catalog.endedAt) - Date.parse(catalog.startedAt) + 2000,
    outputDir, outputPrefix: prefix, logFile: join(root, "not-generated.log"),
    summaryFile: join(outputDir, `${prefix}-summary.json`), changesFile: join(outputDir, `${prefix}-changes.json`)
  };
};

const writeRun = async (root: string, runId: string, runs: readonly ProviderRun[], startedAt: string,
  status: BatchReport["status"] = "complete"): Promise<void> => {
  const file = join(root, "storage", "runs", runId, "run.json");
  await mkdir(dirname(file), { recursive: true });
  const report: BatchReport = {
    version: 1, runId, startedAt, endedAt: status === "running" ? null :
      new Date(Math.max(Date.parse(startedAt), ...runs.map((run) => Date.parse(run.endedAt))) + 1000).toISOString(),
    status, requestedProviders: [...CAMPAIGN_PROVIDERS], providers: runs
  };
  await writeFile(file, JSON.stringify(report));
};

test("sin storage ni campañas previas devuelve los tres proveedores pendientes y no crea archivos", async () => {
  const root = await createRoot();
  try {
    const result = await discoverCampaign(root);
    assert.equal(result.status, "none");
    assert.equal(result.runFile, null);
    assert.deepEqual(result.providers.map((provider) => provider.state), ["not-started", "not-started", "not-started"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("descubre el lote completo a través de run.json, sus catálogos y los SHA legítimos", async () => {
  const root = await createRoot();
  try {
    const runs = await Promise.all(CAMPAIGN_PROVIDERS.map((providerId) => populate(root, providerId)));
    await writeRun(root, "lote-completo", runs, "2026-10-22T08:20:00.000Z");
    const result = await discoverCampaign(root);
    assert.equal(result.runId, "lote-completo");
    assert.equal(result.status, "complete");
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.providers.map((provider) => provider.state), ["catalog", "catalog", "catalog"]);
    for (const provider of result.providers) {
      assert.ok(provider.catalog);
      const raw = await readFile(provider.catalog.path);
      assert.equal(provider.catalog.sha256, createHash("sha256").update(raw).digest("hex"));
    }
    const gam = runs[0];
    assert.ok(gam);
    const preparationFile = join(root, "storage", "campaigns", "revision-local", "gam", `${gam.outputPrefix}-20261026-preparation.json`);
    await prepareSavedCatalog({
      providerId: "gam", source: join(gam.outputDir, `${gam.outputPrefix}-catalog.json`),
      out: preparationFile, dryRun: false, compare: null
    });
    const withPreparation = await discoverCampaign(root);
    assert.equal(withPreparation.providers[0]?.state, "prepared");
    assert.equal(withPreparation.providers[0]?.preparation?.path, preparationFile);
    assert.ok(withPreparation.providers[0]?.preparation?.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("no confunde el último lote incompleto con un lote completo anterior", async () => {
  const root = await createRoot();
  try {
    const runs = await Promise.all(CAMPAIGN_PROVIDERS.map((providerId) => populate(root, providerId)));
    await writeRun(root, "lote-anterior", runs, "2026-10-22T08:20:00.000Z");
    await writeRun(root, "lote-nuevo", [{ ...runs[0]!, status: "failed", error: "Portal no accesible",
      startedAt: "2026-10-23T08:21:00.000Z", endedAt: "2026-10-23T08:22:00.000Z" }],
      "2026-10-23T08:20:00.000Z", "partial");
    const result = await discoverCampaign(root);
    assert.equal(result.runId, "lote-nuevo");
    assert.equal(result.status, "partial");
    assert.deepEqual(result.providers.map((provider) => provider.state), ["failed", "not-started", "not-started"]);
    assert.ok(result.issues.some((issue) => issue.includes("no es seleccionable")));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rechaza catálogos con huellas alteradas y no mezcla preparaciones antiguas", async () => {
  const root = await createRoot();
  try {
    const runs = await Promise.all(CAMPAIGN_PROVIDERS.map((providerId) => populate(root, providerId)));
    await writeRun(root, "lote-alterado", runs, "2026-10-22T08:20:00.000Z");
    const catalog = runs[1];
    assert.ok(catalog);
    const file = join(catalog.outputDir, `${catalog.outputPrefix}-catalog.manifest.json`);
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!value || typeof value !== "object") throw new Error("Manifest de prueba inválido");
    await writeFile(file, JSON.stringify({ ...value, catalogSha256: "0".repeat(64) }));
    const result = await discoverCampaign(root);
    assert.equal(result.providers[1]?.state, "invalid");
    assert.equal(result.providers[1]?.catalog, undefined);
    assert.equal(result.providers[0]?.state, "catalog");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("run.json inválido bloquea un descubrimiento aparentemente exitoso", async () => {
  const root = await createRoot();
  try {
    const file = join(root, "storage", "runs", "incompleto", "run.json");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ version: 1, status: "complete", runId: "otro" }));
    const result = await discoverCampaign(root);
    assert.equal(result.runFile, null);
    assert.ok(result.issues.some((issue) => issue.includes("run.json")));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("resuelve rutas relativas de run.json desde el repositorio, no desde el directorio de ejecución", async () => {
  const root = await createRoot();
  try {
    const run = await populate(root, "gam");
    await writeRun(root, "lote-relativo", [{ ...run, outputDir: "storage/scraped/gam" }],
      "2026-10-22T08:20:00.000Z", "partial");
    const result = await discoverCampaign(root);
    assert.equal(result.providers[0]?.state, "catalog");
    assert.equal(result.providers[0]?.catalog?.path, join(run.outputDir, `${run.outputPrefix}-catalog.json`));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("detecta catálogos previos sin run.json sin convertirlos en lote válido", async () => {
  const root = await createRoot();
  try {
    await populate(root, "gam");
    const result = await discoverCampaign(root);
    assert.equal(result.status, "none");
    assert.ok(result.issues.some((issue) => issue.includes("sin run.json")));
  } finally { await rm(root, { recursive: true, force: true }); }
});


test("historial de mantenimiento: solo acredita campañas completas con catálogos originales verificables", async () => {
  const root = await createRoot();
  try {
    const runs = await Promise.all(CAMPAIGN_PROVIDERS.map((providerId) => populate(root, providerId)));
    await writeRun(root, "lote-completo", runs, "2026-10-22T08:20:00.000Z");
    const complete = await discoverCampaignCatalogHistory(root, "gam");
    assert.equal(complete.length, 1);
    assert.equal(complete[0]?.runId, "lote-completo");
    assert.equal(complete[0]?.catalog?.providerId, "gam");
    await writeRun(root, "lote-incompleto", [{ ...runs[0]!, status: "failed", error: "Sin extracción",
      startedAt: "2026-10-23T08:21:00.000Z", endedAt: "2026-10-23T08:22:00.000Z" }],
    "2026-10-23T08:20:00.000Z", "partial");
    const withGap = await discoverCampaignCatalogHistory(root, "gam");
    assert.equal(withGap[0]?.runId, "lote-incompleto");
    assert.equal(withGap[0]?.catalog, null);
    assert.ok(withGap[0]?.reason);
    const manifest = join(runs[0]!.outputDir, `${runs[0]!.outputPrefix}-catalog.manifest.json`);
    await writeFile(manifest, JSON.stringify({ version: 1, catalogSha256: "0".repeat(64) }));
    const altered = await discoverCampaignCatalogHistory(root, "gam");
    assert.equal(altered[1]?.catalog, null);
    assert.match(altered[1]?.reason ?? "", /no verificable/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
