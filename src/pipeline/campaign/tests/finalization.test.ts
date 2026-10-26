import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/offline-preparation.js";
import { persistAppliedIntervention } from "../../../infrastructure/filesystem/intervention-application.js";
import { registerInterventionScripts } from "../../../infrastructure/filesystem/intervention-script-registration.js";
import { reviewActiveCampaign } from "../review.js";
import { interveneActiveCampaign } from "../intervention.js";
import { finalizeActiveCampaign } from "../finalization.js";
import { CAMPAIGN_PROVIDERS } from "../discovery.js";
import { copyCampaignTestCatalog } from "./campaign-catalog-fixture.js";
import type { ProviderRun, BatchReport } from "../../batch/report-types.js";

const sourceRoot = resolve("src/testing/fixtures");
const prefixes = {
  gam: "scrape-gam-marzo-2026",
  gomariz: "scrape-gomariz",
  mercaeleva: "scrape-mercaeleva"
} as const;

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-f4-"));
  const runId = `lote-${randomUUID()}`;
  const providers: ProviderRun[] = [];
  for (const id of CAMPAIGN_PROVIDERS) {
    const prefix = prefixes[id];
    const dir = join(root, "storage", "scraped", "campanas", runId, id);
    await mkdir(dir, { recursive: true });
    const catalog = await copyCampaignTestCatalog(sourceRoot, dir, id, prefix);
    providers.push({
      providerId: id, status: "complete",
      startedAt: new Date(Date.parse(catalog.startedAt) - 1000).toISOString(),
      endedAt: new Date(Date.parse(catalog.endedAt) + 1000).toISOString(),
      durationMs: 1000, outputDir: dir, outputPrefix: prefix,
      logFile: join(dir, "missing.log"), summaryFile: join(dir, `${prefix}-summary.json`),
      changesFile: join(dir, `${prefix}-changes.json`)
    });
  }
  const runFile = join(root, "storage", "runs", runId, "run.json");
  const run: BatchReport = {
    version: 1, runId, status: "complete", requestedProviders: [...CAMPAIGN_PROVIDERS],
    startedAt: "2026-10-22T08:20:00.000Z", endedAt: "2026-10-22T09:10:00.000Z", providers
  };
  await mkdir(dirname(runFile), { recursive: true });
  await writeFile(runFile, JSON.stringify(run));
  const review = await reviewActiveCampaign(root);
  assert.equal(review.complete, true, JSON.stringify(review.providers));
  return { root, runId, providers, review, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const approveDraft = async (path: string) => {
  const draft = JSON.parse(await readFile(path, "utf8"));
  const approved = {
    ...draft, approved: true, approvalReason: "Exclusiones y correcciones revisadas por una persona responsable.",
    exclusions: draft.exclusions.map((entry: { readonly sourceUrl: string; readonly status: string }) => ({
      ...entry, decision: entry.status === "intervention" ? "incluir" : "excluir",
      reason: "Ficha contrastada con su fuente y revisada manualmente.",
      evidenceUrls: [entry.sourceUrl]
    }))
  };
  await writeFile(path, JSON.stringify(approved, null, 2));
  return approved;
};

const campaignScript = async (root: string, runId: string): Promise<string> => {
  const catalogFile = join(root, "storage", "scraped", "campanas", runId, "gam", `${prefixes.gam}-catalog.json`);
  const catalog = await readCanonicalCatalog(catalogFile);
  const product = catalog.products.find((entry) => entry.title !== null);
  assert.ok(product);
  const folder = join(root, "storage", "interventions", runId, "scripts");
  await mkdir(folder, { recursive: true });
  const file = join(folder, "correccion.ts");
  await writeFile(file, `export const proposals = ${JSON.stringify([{
    providerId: "gam", identity: buildProductIdentity(product).key, field: "title",
    expected: product.title, next: `${product.title} contrastada`,
    reason: "Corrección editorial acordada para esta ficha",
    evidence: "Verificación manual con la ficha de origen publicada"
  }])};`);
  return file;
};

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
    assert.equal(publicables.length, 3);
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

test("rechaza un script de otra campaña y requiere autorización explícita para aplicar", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const preview = await interveneActiveCampaign(data.root, "gam", [script], false);
    assert.equal(preview.applied, false);
    assert.equal(preview.simulation.changes.length, 1);
    const oldDir = join(data.root, "storage", "interventions", "otro-lote", "scripts");
    await mkdir(oldDir, { recursive: true });
    const old = join(oldDir, "correccion.ts");
    await copyFile(script, old);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [old], true), /no pertenece al lote actual/);
    const original = data.providers.find((item) => item.providerId === "gam");
    assert.ok(original);
    const originalFile = join(original.outputDir, `${original.outputPrefix}-catalog.json`);
    const before = await readFile(originalFile);
    const applied = await interveneActiveCampaign(data.root, "gam", [script], true);
    assert.equal(applied.applied, true);
    assert.ok(applied.derivedFile);
    assert.ok(applied.preparationFile);
    assert.deepEqual(await readFile(originalFile), before);
    assert.ok((await readOfflinePreparation(applied.preparationFile, "gam")).source.intervention);
    const reviewed = await reviewActiveCampaign(data.root);
    assert.equal(reviewed.complete, true, JSON.stringify(reviewed));
    assert.equal(reviewed.providers.find((item) => item.providerId === "gam")?.preparationFile, applied.preparationFile);
    await assert.rejects(interveneActiveCampaign(data.root, "gam", [script], true), /ya tiene un origen libre|no tiene un origen libre/);
  } finally { await data.cleanup(); }
});

test("no reutiliza un borrador anterior después de una intervención", async () => {
  const data = await fixture();
  try {
    const initial = await finalizeActiveCampaign(data.root, false);
    await approveDraft(initial.draftFile);
    const script = await campaignScript(data.root, data.runId);
    await interveneActiveCampaign(data.root, "gam", [script], true);
    const updated = await finalizeActiveCampaign(data.root, false);
    assert.equal(updated.status, "draft");
    assert.notEqual(updated.draftFile, initial.draftFile);
    const old = JSON.parse(await readFile(initial.draftFile, "utf8"));
    assert.equal(old.approved, true);
    assert.equal((await finalizeActiveCampaign(data.root, false)).status, "pending");
    await approveDraft(updated.draftFile);
    const selected = await finalizeActiveCampaign(data.root, false);
    assert.equal(selected.status, "selected");
    assert.equal(selected.selection?.source.find((item) => item.providerId === "gam")?.intervention?.campaign, data.runId);
  } finally { await data.cleanup(); }
});

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


test("registra un script elegido una sola vez sin permitir sustituirlo silenciosamente", async () => {
  const data = await fixture();
  try {
    const script = await campaignScript(data.root, data.runId);
    const external = join(data.root, "correccion.ts");
    await copyFile(script, external);
    const registered = await registerInterventionScripts(data.root, data.runId, [external]);
    assert.deepEqual(registered, [script]);
    assert.deepEqual(await registerInterventionScripts(data.root, data.runId, [external]), registered);
    assert.equal((await interveneActiveCampaign(data.root, "gam", registered, false)).applied, false);
    await writeFile(external, "export const proposals = [];\n");
    await assert.rejects(registerInterventionScripts(data.root, data.runId, [external]), /EEXIST/);
    assert.notEqual(await readFile(script, "utf8"), await readFile(external, "utf8"));
  } finally { await data.cleanup(); }
});
