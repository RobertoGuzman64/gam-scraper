import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { analyzeCatalogContentGaps } from "../../legacy-export/content-gaps-commercial.js";
import { prioritizeCatalogGaps } from "../content-gaps-source.js";
import type { GapInput } from "../content-gaps-types.js";
import type { ImportCandidate, ImportCatalog } from "../../legacy-export/contracts.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog: ImportCatalog = {
  categories: [{ id: 10, parentId: null, name: "Carretillas", slug: "carretillas" },
  { id: 20, parentId: null, name: "Plataformas", slug: "plataformas" }],
  attributes: [{ id: 2, name: "Radio de giro", type: "TEXT", required: false, unit_option: "" },
  { id: 3, name: "Altura", type: "NUMBER", required: false, unit_option: "" }],
  relations: [{ categoryID: 10, attributeID: 2, actived: true },
  { categoryID: 10, attributeID: 3, actived: false }, { categoryID: 20, attributeID: 3, actived: true }]
};

const original = (reference: string, values: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación", url: `https://example.com/${reference}`,
  title: "Máquina", shortDescription: null, longDescription: null, price: null,
  reference, brand: "Ejemplo", model: "A", year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: null, ...values
});
const candidate = (record: ProductRecord, overrides: Partial<ImportCandidate> = {}): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference, title: record.title,
  categorySellID: 10, category: "Carretillas", condition: null, price: null, description_title: record.title,
  description: null, description_general: null, image: null, images: [], spec: record.specs ?? {}, attributes: [], ...overrides
});
const entry = (reference: string, source: Partial<ProductRecord> = {}, product: Partial<ImportCandidate> = {}): GapInput => {
  const record = original(reference, source);
  const prepared: PreparedProduct = { status: "ready", issues: [], product: candidate(record, product) };
  return { source: record, prepared };
};

test("detecta atributos por categoría activa, descripciones independientes y evidencia prudente", () => {
  const inputs = [
    entry("1", { shortDescription: "", longDescription: "Detalle original", specs: { "Radio de giro": "100 / 120" } }),
    entry("2", {}, { description: "Corta", description_general: "Larga", attributes: [{ attributeID: 2, value: "100" }] })
  ];
  const result = analyzeCatalogContentGaps(inputs, catalog);
  const group = result.groups[0];
  assert.ok(group);
  assert.deepEqual(group.observations.map((item) => item.field.kind), ["description", "description_general", "attribute"]);
  assert.deepEqual(group.observations.map((item) => item.missing), [1, 1, 1]);
  assert.deepEqual(group.observations.map((item) => item.coveragePercent), [50, 50, 50]);
  const affected = result.cases.find((item) => item.reference === "1");
  assert.ok(affected);
  assert.deepEqual(affected.gaps.map((item) => item.evidence), [
    "texto_relacionado", "directa_del_campo", "especificaciones_sin_vinculo_acreditado"
  ]);
  assert.deepEqual(group.observations[2]?.originalSpecKeys, [{ key: "Radio de giro", count: 1 }]);
});

test("mantiene ausencias sistemáticas con texto relacionado como candidatas principales", () => {
  const inputs = Array.from({ length: 8 }, (_, index) => entry(String(index + 1), { longDescription: "Texto de origen" },
    { description_general: "Texto de salida" }));
  const result = analyzeCatalogContentGaps(inputs, catalog);
  const priority = prioritizeCatalogGaps(result);
  assert.equal(priority[0]?.observation.field.kind, "description");
  assert.equal(priority[0]?.observation.coverage, "sistematica");
  assert.equal(priority[0]?.observation.relatedText, 8);
  assert.equal(priority[0]?.tier, 0);
});

test("no mezcla proveedores ni categorías y permite refinamiento literal", () => {
  const inputs = [entry("1"), entry("2", { brand: "Otra" }),
  entry("3", { providerId: "gomariz" }), entry("4", {}, { categorySellID: 20, category: "Plataformas" })];
  const byCategory = analyzeCatalogContentGaps(inputs, catalog);
  assert.equal(byCategory.groups.length, 3);
  const byBrand = analyzeCatalogContentGaps(inputs, catalog, { groupBy: "marca" });
  assert.equal(byBrand.groups.length, 4);
  const forPlatforms = byCategory.groups.find((group) => group.categorySellID === 20);
  assert.deepEqual(forPlatforms?.observations.filter((item) => item.field.kind === "attribute").map((item) => item.field),
    [{ kind: "attribute", attributeID: 3, name: "Altura" }]);
});

test("sin categoría mantiene descripciones, pero no atributos", () => {
  const result = analyzeCatalogContentGaps([entry("1", {}, { categorySellID: null, category: null })], catalog);
  assert.equal(result.universe.withoutCategory, 1);
  assert.equal(result.groups[0]?.comparable, false);
  assert.equal(result.groups[0]?.observations.length, 2);
});

test("no confunde cadenas vacías ni una especificación ajena con evidencia directa", () => {
  const result = analyzeCatalogContentGaps([
    entry("1", { shortDescription: "  ", longDescription: "   ", specs: { Otro: "valor" } })
  ], catalog);
  const record = result.cases[0];
  assert.ok(record);
  assert.deepEqual(record.gaps.map((item) => item.evidence),
    ["sin_evidencia_observable", "sin_evidencia_observable", "especificaciones_sin_vinculo_acreditado"]);
});

test("orden estable, salida determinista y datos de entrada inalterados", () => {
  const inputs = [entry("2"), entry("1")];
  const before = JSON.stringify(inputs);
  const first = analyzeCatalogContentGaps(inputs, catalog);
  const second = analyzeCatalogContentGaps([...inputs].reverse(), catalog);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(inputs), before);
});

test("no equipara referencias idénticas entre proveedores y rechaza identidades duplicadas", () => {
  assert.equal(analyzeCatalogContentGaps([
    entry("1"), entry("1", { providerId: "gomariz" })
  ], catalog).universe.total, 2);
  assert.throws(() => analyzeCatalogContentGaps([entry("1"), entry("1")], catalog), /duplicada/);
});

test("distingue valores de atributo vacíos de cero y false", () => {
  const inputs = [
    entry("1", {}, { attributes: [{ attributeID: 2, value: "   " }] }),
    entry("2", {}, { attributes: [{ attributeID: 2, value: "" }] }),
    entry("3", {}, { attributes: [{ attributeID: 2, value: 0 }] }),
    entry("4", {}, { attributes: [{ attributeID: 2, value: false }] })
  ];
  const before = JSON.stringify(inputs);
  const result = analyzeCatalogContentGaps(inputs, catalog);
  const observation = result.groups[0]?.observations.find((item) => item.field.kind === "attribute");
  assert.equal(observation?.missing, 2);
  assert.equal(observation?.present, 2);
  assert.deepEqual(observation?.missingIdentities, ["gam:ref:1", "gam:ref:2"]);
  assert.equal(JSON.stringify(inputs), before);
});

test("prioriza evidencia directa y distingue ausencia total de evidencia", () => {
  const inputs = Array.from({ length: 10 }, (_, index) =>
    entry(String(index + 1), index < 7 ? { shortDescription: "Descripción original" } : {}));
  const result = analyzeCatalogContentGaps(inputs, catalog);
  const prioritized = prioritizeCatalogGaps(result);
  assert.equal(prioritized[0]?.observation.field.kind, "description");
  assert.equal(prioritized[0]?.observation.directEvidence, 7);
  assert.equal(prioritized[0]?.tier, 0);
  const noEvidence = result.cases.find((item) => item.reference === "10");
  assert.equal(noEvidence?.gaps.find((item) => item.field.kind === "description")?.evidence, "sin_evidencia_observable");
});

test("los originales históricos de tres proveedores preservan preparación y evidencias", async () => {
  const paths = [
    "gam/scrape-gam-marzo-2026-catalog.json",
    "gomariz/scrape-gomariz-catalog.json",
    "mercaeleva/scrape-mercaeleva-catalog.json"
  ];
  const sources = await Promise.all(paths.map((path) => readCanonicalCatalog(
    fileURLToPath(new URL(`../../../../src/testing/fixtures/${path}`, import.meta.url))
  )));
  const importCatalog = await loadImportCatalog();
  const inputs = sources.flatMap((source) => source.products.map((record) => ({
    source: record, prepared: prepareProduct(record, importCatalog)
  })));
  const before = JSON.stringify(inputs);
  const analysis = analyzeCatalogContentGaps(inputs, importCatalog);
  assert.equal(analysis.universe.total, sources.reduce((total, source) => total + source.productCount, 0));
  assert.deepEqual(analysis.universe.providers.map((item) => item.providerId), ["gam", "gomariz", "mercaeleva"]);
  assert.ok(prioritizeCatalogGaps(analysis).length > 0);
  assert.ok(analysis.groups.some((group) => group.observations.some((item) =>
    item.missing > 0 && item.originalSpecKeys.length > 0)));
  const radio = analysis.groups.flatMap((group) => group.observations.map((observation) => ({ group, observation })))
    .find(({ group, observation }) => group.providerId === "gam" && observation.field.name === "Radio de giro" &&
      observation.missing > 0 && observation.originalSpecKeys.length > 0);
  assert.ok(radio);
  assert.ok(radio.observation.missingIdentities.some((identity) => analysis.cases.some((item) =>
    item.identity === identity && Object.values(item.original.specs ?? {}).length > 0)));
  assert.equal(JSON.stringify(inputs), before);
});
