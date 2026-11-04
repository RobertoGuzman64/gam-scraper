import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import type { BrandLogoReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { planCommercialExport } from "../export-projection.js";
import { accreditCommercialPlan } from "../../diagnostics/commercial-accreditation.js";

const catalog: ImportCatalog = {
  categories: [
    { id: 20, parentId: null, name: "Elevación", slug: "elevacion" },
    { id: 29, parentId: 20, name: "Articuladas", slug: "articuladas" }
  ],
  attributes: [
    { id: 115, name: "Marca", type: "TEXT", required: true, unit_option: "" },
    { id: 24, name: "Neumáticos", type: "SELECT", required: false, unit_option: "Macizos / Superelásticos" }
  ],
  relations: [{ categoryID: 29, attributeID: 115 }, { categoryID: 29, attributeID: 24 }]
};
const logos: readonly BrandLogoReference[] = [
  { id: 16, brand: "JCB", slug: "jcb", logo: "https://example.org/jcb.png" },
  { id: 18, brand: "Otras Marcas", slug: "otras-marcas", logo: "https://example.org/otras.png" }
];
const source = (ref: string): ProductRecord => ({
  providerId: "gam", categoryKey: "maquinaria", categoryName: "Maquinaria",
  url: `https://example.org/venta/${ref}`, reference: ref, externalReference: "VISIBLE-1",
  title: "Compra JCB AB123 | GAM Online", shortDescription: "Resumen acreditado",
  longDescription: "Descripción acreditada", price: null, condition: "Segunda mano",
  brand: "JCB", model: "AB123", year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: "https://example.org/image.jpg", images: ["https://example.org/image.jpg"],
  specs: { Marca: "JCB", Modelo: "AB123" }
});
const published = (record: ProductRecord): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference,
  externalReference: record.externalReference ?? null, title: record.title,
  categorySellID: null, category: null, condition: "Segunda_Mano", price: null,
  description_title: record.title, description: record.shortDescription,
  description_general: record.longDescription, image: record.image, images: record.images ?? [],
  spec: record.specs ?? {}, attributes: []
});
const entry = (reference: string, categorySellID: number | null = 29): CommercialBaselineInput => {
  const original = source(reference);
  const product = published(original);
  return { source: original, published: product, mapped: { status: "ready", issues: [], product: {
    ...product, categorySellID, category: categorySellID === 29 ? "Articuladas" : null,
    attributes: [{ attributeID: 115, value: "JCB" }]
  } } };
};
const plan = (items: readonly CommercialBaselineInput[], environment: "develop" | "production" | null = null,
  companyID: number | null = null) => planCommercialExport(items, "gam", "a".repeat(64), catalog, logos, environment, companyID);

test("deriva contenido y metadata F3, categoría y atributos F1–F2 sin alterar publicación", () => {
  const input = entry("100");
  const snapshot = JSON.stringify(input);
  const output = plan([input]);
  assert.equal(output.total, 1);
  assert.equal(output.summary.exported, 1);
  assert.equal(output.summary.categorized, 1);
  assert.equal(output.summary.withLogo, 1);
  assert.equal(output.summary.attributes, 1);
  assert.equal(output.products[0]?.reference, "100");
  assert.equal(output.products[0]?.externalReference, "VISIBLE-1");
  assert.equal(output.products[0]?.title, "JCB AB123");
  assert.equal(output.products[0]?.category, "Articuladas");
  assert.equal(output.products[0]?.categorySellID, 29);
  assert.equal(output.products[0]?.logoID, 16);
  assert.deepEqual(output.products[0]?.attributes, [{ attributeID: 115, value: "JCB" }]);
  assert.deepEqual(output.products[0]?.metadata.tags, ["maquinaria", "segunda-mano", "articuladas", "jcb"]);
  assert.equal(output.products[0]?.metadata.featured, false);
  assert.deepEqual(output.products[0]?.spec, input.published.spec);
  assert.deepEqual(output.products[0]?.images, input.published.images);
  assert.equal(output.products[0]?.companyID, undefined);
  assert.equal(output.exceptions[0]?.reason, "precio-no-acreditado");
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(plan([input]), output);
});

test("conserva todas las elegibles incluso sin categoría, y registra exclusiones de lotes y herramientas", () => {
  const unresolved = entry("101", null);
  const batch = entry("102");
  const tool = entry("103");
  const output = plan([unresolved, {
    ...batch,
    source: { ...batch.source, url: "https://example.org/lotes/102" },
    published: { ...batch.published, sourceUrl: "https://example.org/lotes/102" },
    mapped: { ...batch.mapped, product: { ...batch.mapped.product, sourceUrl: "https://example.org/lotes/102" } }
  }, {
    ...tool,
    source: { ...tool.source, categoryKey: "herramientas" }
  }]);
  assert.equal(output.total, 3);
  assert.equal(output.summary.exported, 1);
  assert.equal(output.summary.pendingCategory, 1);
  assert.equal(output.summary.excludedLots, 1);
  assert.equal(output.summary.excludedTools, 1);
  assert.equal(output.products[0]?.categorySellID, null);
  assert.deepEqual(output.products[0]?.attributes, []);
  assert.ok(output.exceptions.some((item) => item.reason === "sin-categoria"));
  assert.equal(output.excluded.length, 2);
  assert.equal(output.excluded[0]?.reason, "lote");
  assert.equal(output.excluded[1]?.reason, "herramienta");
});

test("dos máquinas con la misma referencia comercial mantienen identidades propias", () => {
  const output = plan([entry("104"), entry("105")]);
  assert.deepEqual(output.products.map((item) => item.reference), ["104", "105"]);
  assert.deepEqual(output.products.map((item) => item.externalReference), ["VISIBLE-1", "VISIBLE-1"]);
  assert.notEqual(output.products[0]?.sourceUrl, output.products[1]?.sourceUrl);
});

test("companyID solo se incorpora con entorno explícito", () => {
  assert.equal(plan([entry("106")]).products[0]?.companyID, undefined);
  assert.equal(plan([entry("106")], "production", 208).products[0]?.companyID, 208);
  assert.throws(() => plan([entry("106")], null, 208), /entorno explícito/);
  assert.throws(() => plan([entry("106")], "develop", null), /entorno explícito/);
});

test("no asigna logo Otras Marcas ni marca no acreditada, y no inventa precio", () => {
  const sample = entry("107");
  const published = { ...sample.published, title: "Equipo SIN MARCA", spec: { Modelo: "AB123" } };
  const output = plan([{ ...sample, published }]);
  assert.equal(output.products[0]?.logoID, null);
  assert.equal(output.products[0]?.price, null);
  assert.ok(output.exceptions.some((item) => item.reason === "logo-sin-correspondencia-acreditada"));
  assert.ok(output.exceptions.some((item) => item.reason === "precio-no-acreditado"));
});

test("atribuye solo valores compatibles y registra rechazos sin borrar fichas", () => {
  const sample = entry("108");
  const changed = { ...sample, mapped: { ...sample.mapped, product: {
    ...sample.mapped.product,
    attributes: [{ attributeID: 115, value: "JCB" }, { attributeID: 24, value: "De bandaje" }]
  } } };
  const output = plan([changed]);
  assert.deepEqual(output.products[0]?.attributes, [{ attributeID: 115, value: "JCB" }]);
  assert.ok(output.exceptions.some((item) => item.reason === "atributo-24:opcion-invalida"));
});

test("rechaza identidades cambiadas, duplicadas o categorías no hoja", () => {
  const sample = entry("109");
  assert.throws(() => plan([sample, sample]), /duplicada/);
  assert.throws(() => plan([{ ...sample, published: { ...sample.published, reference: "OTRA" } }]), /discordante/);
  const wrong = { ...sample, mapped: { ...sample.mapped, product: { ...sample.mapped.product, categorySellID: 20 } } };
  assert.throws(() => plan([wrong]), /Categoría comercial no válida/);
});

test("F5 acredita conservación íntegra, metadata y referencias visibles compartidas sin mezclarlas", () => {
  const input = [entry("301"), entry("302")];
  const commercial = plan(input);
  const audit = accreditCommercialPlan(input, commercial, catalog, logos, null);
  assert.equal(audit.summary.originals, 2);
  assert.equal(audit.summary.exported, 2);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.summary.lostFields, 0);
  assert.equal(audit.summary.normalizedTitles, 2);
  assert.equal(audit.decisions.length, 2);
  assert.equal(audit.samples.length, 1);
  assert.equal(audit.samples[0]?.count, 2);
});

test("F5 detecta pérdidas, recategorizaciones ajenas, metadata y empresa alteradas", () => {
  const input = entry("303");
  const commercial = plan([input], "production", 208);
  const actual = commercial.products[0];
  assert.ok(actual);
  const broken = {
    ...actual,
    spec: {}, images: [], condition: "Nuevo" as const, categorySellID: null,
    companyID: 970, metadata: { ...actual.metadata, tags: [...actual.metadata.tags, "etiqueta-inesperada"] }
  };
  const audit = accreditCommercialPlan([input], { ...commercial, products: [broken] }, catalog, logos, 208);
  const issues = audit.blocking.map((item) => item.reason);
  assert.ok(issues.includes("campo-spec-changed"));
  assert.ok(issues.includes("campo-images-changed"));
  assert.ok(issues.includes("campo-condition-changed"));
  assert.ok(issues.includes("categoria-distinta-de-decision"));
  assert.ok(issues.includes("companyID-entorno-incoherente"));
  assert.ok(issues.includes("metadata-no-determinista"));
});

test("F5 detecta atributos ilegales, identidades omitidas y totales inconsistentes", () => {
  const input = [entry("304"), entry("305")];
  const commercial = plan(input);
  const first = commercial.products[0];
  assert.ok(first);
  const corrupted = { ...first, attributes: [{ attributeID: 24, value: "Falso" }] };
  const audit = accreditCommercialPlan(input, {
    ...commercial, products: [corrupted], summary: { ...commercial.summary, exported: 2 }
  }, catalog, logos, null);
  const issues = audit.blocking.map((item) => item.reason);
  assert.ok(issues.includes("atributos-incompatibles"));
  assert.ok(issues.includes("producto-elegible-ausente-o-excluido"));
  assert.ok(issues.includes("totales-incoherentes"));
});

test("F5 no requiere referencia visible única ni reference cuando la identidad tiene serial", () => {
  const first = entry("306");
  const withoutRef: CommercialBaselineInput = {
    ...first,
    source: { ...first.source, reference: null, serialNumber: "SERIE-306" },
    published: { ...first.published, reference: null },
    mapped: { ...first.mapped, product: { ...first.mapped.product, reference: null } }
  };
  const commercial = plan([withoutRef]);
  const audit = accreditCommercialPlan([withoutRef], commercial, catalog, logos, null);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.decisions[0]?.status, "categorized");
});

test("F5 distingue exclusiones reales de pérdidas de producto", () => {
  const lot = entry("307");
  const excluded = {
    ...lot,
    source: { ...lot.source, url: "https://example.org/lotes/307" },
    published: { ...lot.published, sourceUrl: "https://example.org/lotes/307" },
    mapped: { ...lot.mapped, product: { ...lot.mapped.product, sourceUrl: "https://example.org/lotes/307" } }
  };
  const commercial = plan([excluded]);
  assert.equal(accreditCommercialPlan([excluded], commercial, catalog, logos, null).summary.blocking, 0);
  const audit = accreditCommercialPlan([excluded], { ...commercial, excluded: [] }, catalog, logos, null);
  assert.ok(audit.blocking.some((item) => item.reason === "exclusion-no-corresponde"));
});
