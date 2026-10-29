import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { offlinePreparationManifestPath } from "../../../infrastructure/filesystem/preparation/offline-preparation.js";
import { prepareSavedCatalog } from "../../preparation/prepare.js";
import { writeOutputs } from "../../publication/publish.js";
import { readIndividualSelection, selectIndividualPublishable } from "../individual-selection.js";

const category: CategoryConfig = {
  key: "elevacion-nueva", name: "Plataformas elevadoras nuevas", url: "https://example.test/catalogo"
};

const machine = (reference: string): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/${reference}-maquina`,
  reference, title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Plataforma eléctrica",
  longDescription: "Maquinaria", price: "20000 €", brand: "XCMG", model: "Tijera", year: null,
  location: null, country: null, horometer: null, serialNumber: null, condition: "Nuevo",
  image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"],
  specs: { "Altura de trabajo": "8 m" }
});

const withPreparation = async (run: (paths: { source: string; preparation: string }) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-individual-"));
  const source = join(root, "original", "catalogo-ejemplo-catalog.json");
  const preparation = join(root, "prepared", "catalogo-ejemplo-preparation.json");
  const now = new Date().toISOString();
  const products = [machine("11111"), machine("22222")];
  const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
  try {
    await writeOutputs(join(root, "original"), "catalogo-ejemplo", [result], now, now);
    await prepareSavedCatalog({ providerId: "gam", source, out: preparation, dryRun: false, compare: null });
    await run({ source, preparation });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test("selección individual verifica origen y preparación y exige aprobación humana", async () => {
  await withPreparation(async ({ source, preparation }) => {
    const context = await readIndividualSelection("gam", source, preparation);
    assert.equal(context.sources.length, 1);
    assert.equal(context.sources[0]?.productCount, 2);
    assert.equal(context.draft.approved, false);
    assert.equal(context.draft.runId, context.runId);
    assert.equal(context.preparation.totals.ready, 2);
    assert.throws(() => selectIndividualPublishable(context, JSON.stringify(context.draft)), /aprobación ausente/);
    const approved = { ...context.draft, approved: true, approvalReason: "Revisión editorial individual acreditada" };
    const result = selectIndividualPublishable(context, JSON.stringify(approved));
    assert.equal(result.totals.publishable, 2);
    assert.equal(result.accreditation?.runId, context.runId);
    assert.equal((await readFile(preparation, "utf8")).includes('"approved": true'), false);
  });
});

test("selección individual rechaza preparación alterada y proveedor distinto", async () => {
  await withPreparation(async ({ source, preparation }) => {
    await assert.rejects(readIndividualSelection("gomariz", source, preparation), /proveedores distintos/);
    const original = await readFile(preparation, "utf8");
    await writeFile(preparation, original.replace("11111", "99999"));
    await assert.rejects(readIndividualSelection("gam", source, preparation), /Manifest/);
    await writeFile(offlinePreparationManifestPath(preparation), "{}");
    await assert.rejects(readIndividualSelection("gam", source, preparation), /Manifest/);
  });
});
