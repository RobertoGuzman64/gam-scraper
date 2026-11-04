import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { projectCommercialPresentation } from "../../commercial/presentation-projection.js";
import { analyzeCommercialPresentation } from "../commercial-presentation.js";

const source = (reference: string): ProductRecord => ({
  providerId: "gam", categoryKey: "maquinaria", categoryName: "Máquinas",
  url: `https://online.gamrentals.com/es/elevacion/${reference}`, reference,
  title: "GENIE Z45/25J Plataforma articulada", shortDescription: "Descripción breve",
  longDescription: "Descripción general", condition: "Segunda mano", price: null,
  brand: "GENIE", model: "Z45/25J", year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: "https://example.org/principal.jpg",
  images: ["https://example.org/principal.jpg", "https://example.org/otra.jpg"],
  specs: { Marca: "GENIE", Modelo: "Z45/25J", Peso: "6200 kg" }
});

const published = (record: ProductRecord): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference,
  title: record.title, categorySellID: null, category: null, condition: "Segunda_Mano",
  price: 15000, description_title: record.title, description: record.shortDescription,
  description_general: record.longDescription, image: record.image,
  images: record.images ?? [], spec: record.specs ?? {}, attributes: []
});

const entry = (record: ProductRecord, categorySellID: number | null) => {
  const publication = published(record);
  const product: ImportCandidate = { ...publication, categorySellID,
    category: categorySellID === null ? null : "Plataformas Articuladas Diésel de Segunda Mano" };
  const mapped: PreparedProduct = { status: "ready", issues: [], product };
  return { source: record, published: publication, mapped };
};

test("genera metadata determinista y retira Compra y el sufijo del vendedor sin pérdida técnica", () => {
  const record = source("100");
  const technical = { ...published(record), title: "Compra Compra GENIE Z45/25J Plataforma articulada | GAM Online",
    description_title: "Compra Compra GENIE Z45/25J Plataforma articulada | GAM Online" };
  const before = JSON.stringify(technical);
  const projection = projectCommercialPresentation(record, technical, "Plataformas Articuladas Diésel de Segunda Mano");
  assert.equal(projection.title, "GENIE Z45/25J Plataforma articulada");
  assert.equal(projection.description_title, projection.title);
  assert.deepEqual(projection.metadata, {
    tags: ["maquinaria", "segunda-mano", "plataformas-articuladas-diesel-de-segunda-mano", "genie"],
    keywords: ["plataformas-articuladas-diesel-de-segunda-mano", "genie", "z45-25j", "genie-z45-25j-plataforma-articulada"],
    featured: false
  });
  assert.equal(projection.description, technical.description);
  assert.equal(projection.description_general, technical.description_general);
  assert.deepEqual(projection.images, technical.images);
  assert.deepEqual(projection.spec, technical.spec);
  assert.equal(JSON.stringify(technical), before);
});

test("no inventa categoría, marca ni modelo cuando el título acreditado no los sustenta", () => {
  const record = { ...source("101"), brand: "GENIE", model: "Z45/25J", title: "Vehículo clásico", specs: {} };
  const projection = projectCommercialPresentation(record, published(record), null);
  assert.deepEqual(projection.metadata.tags, ["maquinaria", "segunda-mano"]);
  assert.deepEqual(projection.metadata.keywords, ["vehiculo-clasico"]);
  assert.equal(projection.metadata.featured, false);
  assert.deepEqual(projectCommercialPresentation(record, published(record), null), projection);
});

test("recupera marca y modelo desde las especificaciones acreditadas aunque el título use una variante", () => {
  const record = { ...source("101B"), title: "GENIE Z45/25 Plataforma articulada" };
  const result = projectCommercialPresentation(record, published(record), "Plataformas Articuladas");
  assert.ok(result.metadata.tags.includes("genie"));
  assert.ok(result.metadata.keywords.includes("z45-25j"));
  assert.ok(!result.metadata.keywords.includes("z45-25"));
  assert.equal(result.title, "GENIE Z45/25 Plataforma articulada");
});

test("mantiene el título descriptivo independiente y no altera los textos revisados", () => {
  const record = source("102");
  const technical = { ...published(record), title: "GENIE Z45/25J", description_title: "Versión confirmada Z45/25J",
    description: "Texto breve acreditado", description_general: "Texto editorial largo acreditado" };
  const result = projectCommercialPresentation(record, technical, "Plataformas Articuladas");
  assert.equal(result.description_title, "Versión confirmada Z45/25J");
  assert.equal(result.description, "Texto breve acreditado");
  assert.equal(result.description_general, "Texto editorial largo acreditado");
  assert.deepEqual(result.images, technical.images);
  assert.deepEqual(result.spec, technical.spec);
});

test("un subtítulo independiente conserva su contenido sin prefijo de compra duplicado", () => {
  const record = source("102B");
  const publication = { ...published(record), description_title: "Compra Compra GENIE Z45/25J en venta | GAM Online" };
  const projection = projectCommercialPresentation(record, publication, null);
  assert.equal(projection.description_title, "GENIE Z45/25J en venta");
  assert.equal(publication.description_title, "Compra Compra GENIE Z45/25J en venta | GAM Online");
  assert.notEqual(projection.images, publication.images);
  assert.notEqual(projection.spec, publication.spec);
});

test("rechaza cruces de identidad en lugar de atribuir metadata a otra unidad", () => {
  const record = source("103");
  assert.throws(() => projectCommercialPresentation(record, { ...published(record), reference: "104" }, null), /discordantes/);
  assert.throws(() => projectCommercialPresentation(record, { ...published(record), sourceUrl: "https://example.org/otra" }, null), /discordantes/);
});

test("audita cobertura, títulos depurados, SEO y preservación sin tocar publicaciones", () => {
  const normal = source("105");
  const clean = source("106");
  const lot = { ...source("107"), categoryKey: "lotes", title: "Lote 11" };
  const normalEntry = entry(normal, 29);
  const technical = { ...normalEntry.published, title: "Compra GENIE Z45/25J Plataforma articulada | GAM Online",
    description_title: "Compra GENIE Z45/25J Plataforma articulada | GAM Online" };
  const items = [
    { ...normalEntry, published: technical },
    entry({ ...clean, title: "Plataforma sin marca literal", brand: "GENIE", model: "ABC123" }, null),
    entry(lot, null)
  ];
  const report = analyzeCommercialPresentation(items);
  assert.equal(report.eligible, 2);
  assert.equal(report.excluded, 1);
  assert.equal(report.categorized, 1);
  assert.equal(report.pendingCategory, 1);
  assert.equal(report.withMetadata, 2);
  assert.equal(report.metadataWithCategory, 1);
  assert.equal(report.titlesNormalized, 1);
  assert.equal(report.lostImages, 0);
  assert.equal(report.lostSpecifications, 0);
  assert.equal(report.changedShort, 0);
  assert.equal(report.changedGeneral, 0);
  assert.equal(report.decisions.filter((item) => item.status === "excluded").length, 1);
  assert.ok(report.signals.some((item) => item.reason === "titulo-sin-modelo-literal"));
  assert.deepEqual(analyzeCommercialPresentation(items), report);
  assert.equal(technical.title, "Compra GENIE Z45/25J Plataforma articulada | GAM Online");
});

test("dos unidades que comparten referencia comercial no se fusionan", () => {
  const first = source("108");
  const next = { ...source("109"), externalReference: "COM-108" };
  const report = analyzeCommercialPresentation([entry(first, 29), entry(next, 29)]);
  assert.equal(report.decisions.length, 2);
  assert.notEqual(report.decisions[0]?.sourceUrl, report.decisions[1]?.sourceUrl);
});

test("el auditor conserva diferencias de imagen para revisión y no las corrige artificialmente", () => {
  const record = source("110");
  const input = entry(record, 29);
  const report = analyzeCommercialPresentation([{ ...input, published: {
    ...input.published, image: "https://example.org/portada.jpg"
  } }]);
  assert.equal(report.withImage, 1);
  assert.deepEqual(report.signals.filter((item) => item.reason === "imagen-principal-fuera-de-galeria")
    .map((item) => item.affected), [1]);
  assert.equal(report.lostImages, 0);
  assert.equal(report.lostSpecifications, 0);
});

test("no inventa títulos, descripciones o identificadores a partir de metadata", () => {
  const record = { ...source("111"), brand: null, model: null };
  const input = { ...published(record), title: null, description_title: null,
    description: null, description_general: null, images: [], image: null, spec: {} };
  const projected = projectCommercialPresentation(record, input, null);
  assert.equal(projected.title, null);
  assert.equal(projected.description, null);
  assert.equal(projected.description_general, null);
  assert.deepEqual(projected.images, []);
  assert.deepEqual(projected.spec, {});
  assert.deepEqual(projected.metadata, { tags: ["maquinaria", "segunda-mano"], keywords: [], featured: false });
  const report = analyzeCommercialPresentation([{ ...entry(record, null), published: input }]);
  assert.equal(report.withTitle, 0);
  assert.ok(report.signals.some((item) => item.reason === "titulo-vacio"));
});
