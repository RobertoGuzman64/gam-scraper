import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { createAccreditationDraft, selectAccreditedPublishable, sha256 } from "../../../catalog/editorial/campaign-accreditation.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { persistAppliedIntervention } from "../interventions/intervention-application.js";
import { writeCanonicalCatalog } from "../catalog/canonical-catalog.js";
import { readInterventionSource } from "../interventions/intervention-source.js";
import { readCampaignAccreditationSources } from "../../../pipeline/campaign/accreditation-sources.js";
import { readOfflinePreparation } from "../preparation/offline-preparation.js";
import { simulateIntervention } from "../../../catalog/interventions/simulation.js";
import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";

const providers = CAMPAIGN_PROVIDERS;
const makeProduct = (providerId: string): ProductRecord => ({
  providerId, categoryKey: "industrial", categoryName: "Industrial",
  url: `https://proveedor.example/${providerId}/maquina`, title: "Máquina original",
  shortDescription: "Descripción original", longDescription: null, price: null,
  reference: `${providerId}-1`, brand: "Marca anterior", model: "Modelo", year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  image: "https://proveedor.example/actual.jpg", images: ["https://proveedor.example/actual.jpg"]
});

const buildFixture = async () => {
  await mkdir(join("storage", "interventions"), { recursive: true });
  const root = await mkdtemp(join(tmpdir(), "acreditacion-intervenida-"));
  const campaignDir = await mkdtemp(join("storage", "interventions", "acreditacion-intervenida-"));
  const campaign = basename(campaignDir);
  const scripts = join(campaignDir, "scripts");
  await mkdir(scripts);
  const script = join(scripts, "correccion.ts");
  await writeFile(script, "export const proposals = [];\n");
  const startedAt = "2026-10-25T10:00:00.000Z";
  const endedAt = "2026-10-25T10:02:00.000Z";
  const paths: { providerId: string; path: string }[] = [];
  const reportProviders: {
    providerId: string; status: "complete"; outputDir: string; outputPrefix: string;
    startedAt: string; endedAt: string;
  }[] = [];
  for (const providerId of providers) {
    const directory = join(root, providerId);
    const prepared = join(root, "prepared", providerId);
    await mkdir(directory);
    const product = makeProduct(providerId);
    const prefix = `${providerId}-catalogo`;
    const hash = await writeCanonicalCatalog(directory, prefix, "0123456789abcdef", startedAt, endedAt, [product]);
    const source = join(directory, `${prefix}-catalog.json`);
    await writeFile(join(directory, `${prefix}-summary.json`), JSON.stringify({
      quality: { status: "complete", published: true }, totals: { scrapedProducts: 1 },
      startedAt, endedAt, artifacts: { catalogSha256: hash }
    }));
    let preparationFile = join(prepared, `${prefix}-preparation.json`);
    if (providerId === "gam") {
      const loaded = await readInterventionSource(source);
      const simulation = simulateIntervention(loaded.catalog, loaded.catalogSha256, [{
        providerId, identity: buildProductIdentity(product).key, field: "brand",
        expected: "Marca anterior", next: "Marca revisada",
        reason: "Contraste manual de la máquina", evidence: "Publicación vigente revisada"
      }]);
      const intervention = await persistAppliedIntervention({
        source, script, campaign, confirmation: simulation.planSha256, simulation
      });
      const derived = join(intervention.path, "catalog-derived.json");
      preparationFile = join(intervention.path, "prepared", "intervention-preparation.json");
      await prepareSavedCatalog({ providerId, source: derived, originalSource: source,
        out: preparationFile, compare: null, dryRun: false });
    } else {
      await prepareSavedCatalog({ providerId, source, out: preparationFile,
        compare: null, dryRun: false });
    }
    paths.push({ providerId, path: preparationFile });
    reportProviders.push({
      providerId, status: "complete", outputDir: directory, outputPrefix: prefix,
      startedAt: "2026-10-25T09:59:00.000Z", endedAt: "2026-10-25T10:03:00.000Z"
    });
  }
  const runId = "lote-validado";
  const run = join(root, "run.json");
  await writeFile(run, JSON.stringify({ version: 1, runId, status: "complete",
    requestedProviders: providers, providers: reportProviders }));
  const preparations = await Promise.all(paths.map(({ providerId, path }) => readOfflinePreparation(path, providerId)));
  return { root, campaignDir, run, runId, paths, preparations, cleanup: async () => {
    await rm(root, { recursive: true, force: true });
    await rm(campaignDir, { recursive: true, force: true });
  } };
};

test("reconoce la preparación intervenida del lote y exige decisión editorial sobre la máquina", async () => {
  const fixture = await buildFixture();
  try {
    const { sources } = await readCampaignAccreditationSources(fixture.run, fixture.preparations, fixture.paths);
    const gam = sources.find((source) => source.providerId === "gam");
    assert.ok(gam?.intervention);
    assert.deepEqual(gam.intervention.affectedReferences, ["gam-1"]);
    assert.equal(sources.filter((source) => source.intervention).length, 1);
    const draft = createAccreditationDraft(fixture.preparations, sources, fixture.runId);
    assert.ok(draft.exclusions.some((item) => item.providerId === "gam" && item.reference === "gam-1"));
    assert.throws(() => selectAccreditedPublishable(
      fixture.preparations, sources, fixture.runId, draft, sha256(JSON.stringify(draft))
    ), /aprobación ausente/);
    const approved = {
      ...draft, approved: true, approvalReason: "Revisión humana de las propuestas acreditadas.",
      exclusions: draft.exclusions.map((item) => ({
        ...item,
        decision: item.status === "intervention" ? "incluir" : "excluir",
        reason: "La ficha actual fue contrastada y la intervención revisada.",
        evidenceUrls: [item.sourceUrl]
      }))
    };
    const selection = selectAccreditedPublishable(
      fixture.preparations, sources, fixture.runId, approved, sha256(JSON.stringify(approved))
    );
    const gamPreparation = fixture.preparations.find((item) => item.source.providerId === "gam");
    assert.ok(gamPreparation);
    const isReady = gamPreparation.products[0]?.status === "ready";
    assert.equal(selection.products.some((item) => item.providerId === "gam" && item.reference === "gam-1"), isReady);
    if (!isReady) assert.ok(selection.exclusions.some((item) => item.providerId === "gam" && item.reference === "gam-1"));
    assert.equal(selection.source.find((item) => item.providerId === "gam")?.intervention?.campaign, basename(fixture.campaignDir));
  } finally { await fixture.cleanup(); }
});

test("rechaza preparaciones intervenidas que no coinciden con el derivado íntegro", async () => {
  const fixture = await buildFixture();
  try {
    const index = fixture.paths.find((item) => item.providerId === "gam");
    assert.ok(index);
    const old = await readFile(index.path, "utf8");
    const corrupted = JSON.parse(old);
    corrupted.products[0].product.title = "Cambio ajeno al plan";
    await writeFile(index.path, JSON.stringify(corrupted));
    await assert.rejects(readCampaignAccreditationSources(
      fixture.run, fixture.preparations, fixture.paths
    ), /Manifest de preparación/);
    assert.equal(basename(dirname(index.path)), "prepared");
  } finally { await fixture.cleanup(); }
});
