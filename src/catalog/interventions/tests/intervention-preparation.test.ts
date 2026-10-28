import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { selectPublishableCatalog } from "../../editorial/select-publishable.js";
import { parseOfflinePreparation } from "../../preparation/offline-document.js";
import { buildProductIdentity } from "../../identity.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { writeCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { persistAppliedIntervention } from "../../../infrastructure/filesystem/interventions/intervention-application.js";
import { readAppliedIntervention } from "../../../infrastructure/filesystem/interventions/intervention-derived.js";
import { readInterventionSource } from "../../../infrastructure/filesystem/interventions/intervention-source.js";
import { readOfflinePreparation, offlinePreparationManifest, offlinePreparationManifestPath } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";
import { prepareSavedCatalog } from "../../../pipeline/preparation/prepare.js";
import { validateOfflinePreparation } from "../../../pipeline/validation/offline.js";
import type { ManualInterventionProposal } from "../contracts.js";
import { simulateIntervention } from "../simulation.js";

const product: ProductRecord = {
  providerId: "gam", categoryKey: "maquinas", categoryName: "Máquinas",
  url: "https://proveedor.example/maquina", title: "Equipo original", shortDescription: "Texto antiguo",
  longDescription: null, price: null, reference: "EX-1", brand: null, model: null, year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  image: "https://proveedor.example/publicada.jpg", images: ["https://proveedor.example/publicada.jpg"]
};

const proposal: ManualInterventionProposal = {
  providerId: "gam", identity: buildProductIdentity(product).key,
  field: "shortDescription", expected: "Texto antiguo", next: "Texto corregido",
  reason: "Corrección editorial puntual", evidence: "Ficha de origen contrastada"
};

const sha = (content: Buffer | string): string => createHash("sha256").update(content).digest("hex");

const fixture = async () => {
  const workdir = await mkdtemp(join(tmpdir(), "intervention-preparation-"));
  const prefix = "catalogo-intervencion";
  const original = join(workdir, `${prefix}-catalog.json`);
  const startedAt = "2026-10-25T10:00:00.000Z";
  const endedAt = "2026-10-25T10:02:00.000Z";
  const originalHash = await writeCanonicalCatalog(workdir, prefix, "0123456789abcdef", startedAt, endedAt, [product]);
  await writeFile(join(workdir, `${prefix}-summary.json`), JSON.stringify({
    quality: { status: "complete", published: true }, totals: { scrapedProducts: 1 },
    startedAt, endedAt, artifacts: { catalogSha256: originalHash }
  }));
  const storage = join(process.cwd(), "storage", "interventions");
  await mkdir(storage, { recursive: true });
  const campaignPath = await mkdtemp(join(storage, "manual-preparation-test-"));
  const campaign = basename(campaignPath);
  await mkdir(join(campaignPath, "scripts"));
  const script = join(campaignPath, "scripts", "revision.ts");
  await writeFile(script, "export const proposals = [];\n");
  const originalData = await readInterventionSource(original);
  const simulation = simulateIntervention(originalData.catalog, originalData.catalogSha256, [proposal]);
  const applied = await persistAppliedIntervention({
    source: original, script, campaign, confirmation: simulation.planSha256, simulation
  });
  const derived = join(applied.path, "catalog-derived.json");
  const preparation = join(applied.path, "prepared", "intervention-preparation.json");
  return {
    original, workdir, campaignPath, derived, preparation, applied,
    cleanup: async () => {
      await rm(workdir, { recursive: true, force: true });
      await rm(campaignPath, { recursive: true, force: true });
    }
  };
};

test("verifica procedencia y reconstruye el catálogo derivado sin alterar imágenes", async () => {
  const data = await fixture();
  try {
    const verified = await readAppliedIntervention(data.derived, data.original);
    assert.equal(verified.catalog.products[0]?.shortDescription, "Texto corregido");
    assert.deepEqual(verified.catalog.products[0]?.images, product.images);
    assert.equal(verified.provenance.sourceCatalogSha256, data.applied.catalogSha256);
    assert.equal(verified.provenance.derivedCatalogSha256, data.applied.derivedSha256);
    assert.equal(verified.provenance.planSha256, data.applied.planSha256);
    assert.equal(verified.catalogSha256, sha(await readFile(data.derived)));
  } finally { await data.cleanup(); }
});

test("rechaza derivado, expediente, plan u origen modificados", async () => {
  const data = await fixture();
  try {
    const originalDerived = await readFile(data.derived, "utf8");
    const derived = JSON.parse(originalDerived) as Record<string, unknown>;
    const catalog = derived.catalog as { products: Array<{ image: string }> };
    catalog.products[0]!.image = "https://proveedor.example/no-vigente.jpg";
    await writeFile(data.derived, JSON.stringify(derived));
    await assert.rejects(readAppliedIntervention(data.derived, data.original), /alterada|procedencia/i);
    await writeFile(data.derived, originalDerived);

    const recordPath = join(dirname(data.derived), "intervention-record.json");
    const oldRecord = await readFile(recordPath, "utf8");
    const record = JSON.parse(oldRecord) as { planSha256: string };
    record.planSha256 = "a".repeat(64);
    await writeFile(recordPath, JSON.stringify(record));
    await assert.rejects(readAppliedIntervention(data.derived, data.original), /procedencia|expediente/i);
    await writeFile(recordPath, oldRecord);

    const sourceContents = await readFile(data.original, "utf8");
    await writeFile(data.original, sourceContents + " ");
    await assert.rejects(readAppliedIntervention(data.derived, data.original), /catálogo|manifest/i);
  } finally { await data.cleanup(); }
});

test("prepara y valida con reglas existentes y conserva procedencia explícita", async () => {
  const data = await fixture();
  try {
    const input = {
      providerId: "gam", source: data.derived, out: data.preparation,
      dryRun: true, compare: null, originalSource: data.original
    };
    const simulated = await prepareSavedCatalog(input);
    await assert.rejects(prepareSavedCatalog({
      ...input, out: join(dirname(data.original), "intervention-preparation.json")
    }), /separada/);
    assert.equal(simulated.preparation.source.intervention?.planSha256, data.applied.planSha256);
    await assert.rejects(stat(data.preparation), /ENOENT/);
    const result = await prepareSavedCatalog({ ...input, dryRun: false });
    const loaded = await readOfflinePreparation(data.preparation, "gam");
    assert.deepEqual(result.preparation.source, loaded.source);
    assert.equal(loaded.source.catalogSha256, data.applied.derivedSha256);
    assert.equal(loaded.products.length, 1);
    assert.deepEqual(loaded.products[0]?.product.images, product.images);
    const verified = await validateOfflinePreparation("gam", data.preparation, data.derived, null, data.original);
    assert.equal(verified.catalog.catalogSha256, data.applied.derivedSha256);
    assert.equal(verified.catalog.productCount, 1);
    await assert.rejects(validateOfflinePreparation("gam", data.preparation, data.derived), /catálogo|fuente/i);
    assert.throws(() => selectPublishableCatalog([loaded, loaded, loaded]), /intervenidos/);
    assert.ok(result.manifestFile.endsWith("-preparation.manifest.json"));
  } finally { await data.cleanup(); }
});

test("no admite que un preparado de extracción se presente como intervenido ni al revés", async () => {
  const data = await fixture();
  try {
    await prepareSavedCatalog({
      providerId: "gam", source: data.derived, out: data.preparation,
      dryRun: false, compare: null, originalSource: data.original
    });
    const raw = await readFile(data.preparation, "utf8");
    const withoutProvenance: unknown = JSON.parse(raw);
    const modified = withoutProvenance as { source: { intervention?: unknown } };
    delete modified.source.intervention;
    const file = JSON.stringify(modified, null, 2);
    await writeFile(data.preparation, file);
    const parsed = parseOfflinePreparation(withoutProvenance, "gam");
    await writeFile(offlinePreparationManifestPath(data.preparation), offlinePreparationManifest(file, parsed));
    await assert.rejects(
      validateOfflinePreparation("gam", data.preparation, data.derived, null, data.original), /procedencia/
    );
    assert.throws(() => parseOfflinePreparation({
      ...parsed, source: { ...parsed.source, intervention: {
        campaign: "prueba", sourceCatalogSha256: sha("origen"),
        planSha256: sha("plan"), derivedCatalogSha256: sha("otro")
      } }
    }, "gam"), /Procedencia/);
  } finally { await data.cleanup(); }
});

test("la CLI manual prepara y valida; el seleccionador sigue rechazando derivaciones", async () => {
  const data = await fixture();
  try {
    const prepareArgs = ["dist/cli/commands/interventions/prepare-intervention.js", "gam", "--derived", data.derived, "--source", data.original];
    const simulation = execFileSync(process.execPath, [...prepareArgs, "--dry-run"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20000
    });
    assert.match(simulation, /SIMULACIÓN/);
    const prepared = execFileSync(process.execPath, prepareArgs, {
      cwd: process.cwd(), encoding: "utf8", timeout: 20000
    });
    assert.match(prepared, /GUARDADA/);
    const validated = spawnSync(process.execPath, [
      "dist/cli/commands/interventions/validate-intervention.js", "gam", "--derived", data.derived,
      "--source", data.original, "--preparation", data.preparation
    ], { cwd: process.cwd(), encoding: "utf8", timeout: 20000 });
    assert.equal(validated.status, 0);
    assert.match(validated.stdout, /procedencia verificada/);
    assert.match(validated.stdout, /Categorización comercial: responsabilidad del backend/);
    assert.doesNotMatch(validated.stdout, /Bloqueados: 1/);
  } finally { await data.cleanup(); }
});
