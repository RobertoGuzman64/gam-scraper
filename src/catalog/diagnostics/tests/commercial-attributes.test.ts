import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../commercial-baseline.js";
import { decideCommercialAttributes, validateCommercialAttributeValue } from "../../commercial/attribute-decision.js";
import { analyzeCommercialAttributes } from "../commercial-attributes.js";
import { projectCommercialAttributes } from "../../commercial/attribute-projection.js";

const catalog: ImportCatalog = {
  categories: [{ id: 29, parentId: null, name: "Máquinas", slug: "maquinas" }],
  attributes: [
    { id: 115, name: "Marca", type: "TEXT", required: true, unit_option: "" },
    { id: 12, name: "Neumáticos", type: "SELECT", required: false, unit_option: "Macizos / No marcantes / Todoterreno" },
    { id: 24, name: "Neumáticos", type: "SELECT", required: false, unit_option: "Macizos / Superelásticos / Neumáticos" },
    { id: 1, name: "Altura de trabajo", type: "NUMBER", required: true, unit_option: "m" },
    { id: 101, name: "Bandera", type: "BOOLEAN", required: false, unit_option: "" }
  ],
  relations: [
    { categoryID: 29, attributeID: 115 }, { categoryID: 29, attributeID: 12 },
    { categoryID: 29, attributeID: 24 },
    { categoryID: 29, attributeID: 1 }
  ]
};

const source = (reference: string, specs: ProductRecord["specs"] = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "maquinaria", categoryName: "Maquinaria",
  url: `https://online.gamrentals.com/es/maquinaria/${reference}`, reference,
  title: `Máquina GENIE ${reference}`, shortDescription: "Ficha", longDescription: "Texto acreditado",
  price: null, brand: "GENIE", model: reference, year: null, location: null, country: null,
  horometer: null, serialNumber: null, condition: "Segunda mano", image: null, specs
});

const candidate = (record: ProductRecord, attrs: ImportCandidate["attributes"], categorySellID: number | null = 29): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference, title: record.title,
  categorySellID, category: "Máquinas", condition: "Segunda_Mano", price: null,
  description_title: record.title, description: record.shortDescription,
  description_general: record.longDescription, image: null, images: [], spec: record.specs ?? {}, attributes: attrs
});

const entry = (
  reference: string, attrs: ImportCandidate["attributes"], specs: ProductRecord["specs"] = {}, categorySellID: number | null = 29
): CommercialBaselineInput => {
  const original = source(reference, specs);
  return { source: original, published: candidate(original, [], null),
    mapped: { status: "ready", issues: [], product: candidate(original, attrs, categorySellID) } };
};

test("proyecta solo pares con ID, categoría, tipo y opción compatibles", () => {
  const selected = decideCommercialAttributes({ categorySellID: 29, attributes: [
    { attributeID: 115, value: "GENIE" }, { attributeID: 12, value: "Macizos" },
    { attributeID: 12, value: "No marcantes" }, { attributeID: 12, value: "De bandaje" },
    { attributeID: 1, value: "12 m" }, { attributeID: 101, value: true },
    { attributeID: 999, value: "Falso" }
  ] }, catalog);
  assert.deepEqual(selected.accepted, [{ attributeID: 115, value: "GENIE" }, { attributeID: 12, value: "Macizos" }]);
  assert.deepEqual(selected.issues.map((issue) => issue.reason), [
    "atributo-duplicado", "atributo-duplicado", "tipo-invalido", "relacion-invalida", "atributo-desconocido"
  ]);
  const invalidOption = decideCommercialAttributes({ categorySellID: 29, attributes: [
    { attributeID: 12, value: "De bandaje" }
  ] }, catalog);
  assert.equal(invalidOption.issues[0]?.reason, "opcion-invalida");
});

test("valida opciones explícitas sin equiparar neumáticos no equivalentes", () => {
  const select = catalog.attributes[1];
  assert.ok(select);
  assert.equal(validateCommercialAttributeValue(select, "macizos"), null);
  assert.equal(validateCommercialAttributeValue(select, "Todoterreno"), null);
  assert.equal(validateCommercialAttributeValue(select, "De bandaje"), "opcion-invalida");
  assert.equal(validateCommercialAttributeValue(select, 0), "tipo-invalido");
  assert.equal(validateCommercialAttributeValue({ ...select, unit_option: "" }, "Macizos"), "opciones-no-definidas");
  assert.equal(validateCommercialAttributeValue({ ...select, type: "NUMBER" }, Number.NaN), "tipo-invalido");
  assert.equal(validateCommercialAttributeValue({ ...select, type: "DECIMAL" }, -1), "tipo-invalido");
  assert.equal(validateCommercialAttributeValue({ ...select, type: "BOOLEAN" }, false), null);
  assert.equal(validateCommercialAttributeValue({ ...select, type: "MULTISELECT" }, "Macizos"), "tipo-invalido");
});

test("auditoría distingue exclusiones, ausencias, contradicciones y validación comercial", () => {
  const included = entry("1", [
    { attributeID: 115, value: "GENIE" }, { attributeID: 12, value: "De bandaje" },
    { attributeID: 1, value: 12 }
  ], { "Altura de trabajo": "12 m", "Neumáticos": "De bandaje" });
  const conflicting = entry("2", [], { Marca: "JLG" });
  const batch = entry("3", [], {}, null);
  const excluded: CommercialBaselineInput = {
    ...batch, source: { ...batch.source, url: "https://online.gamrentals.com/es/lotes/3" },
    published: { ...batch.published, sourceUrl: "https://online.gamrentals.com/es/lotes/3" },
    mapped: { ...batch.mapped, product: { ...batch.mapped.product, sourceUrl: "https://online.gamrentals.com/es/lotes/3" } }
  };
  const report = analyzeCommercialAttributes([included, conflicting, excluded, entry("4", [], {}, null)], catalog);
  assert.deepEqual([report.eligible, report.categorized, report.pendingCategory, report.excluded], [3, 2, 1, 1]);
  assert.equal(report.invalidAssignments, 1);
  assert.equal(report.validationIssues.find((issue) => issue.reason === "opcion-invalida")?.affected, 1);
  assert.ok(report.coverage.find((item) => item.attributeID === 115)?.contradiction === 1);
  assert.ok(report.coverage.find((item) => item.attributeID === 1)?.notObserved === 1);
  assert.ok(report.requiredMissingInSnapshot >= 2);
  assert.equal(report.decisions.length, 4);
  assert.equal(report.decisions.find((item) => item.reference === "3")?.status, "excluded");
  assert.equal(report.decisions.find((item) => item.reference === "1")?.attributes.length, 2);
  assert.ok(report.decisions.find((item) => item.reference === "2")?.unresolved.some((item) =>
    item.attributeID === 115 && item.status === "contradiction" && item.requiredInSnapshot));
});

test("recupera neumáticos GAM de evidencia literal publicada sin alterar la ficha técnica", () => {
  const original = source("5", { Ruedas: "MACIZAS" });
  const published = { ...candidate(original, [], null), spec: { Ruedas: "MACIZAS" } };
  const proposed = candidate(original, [{ attributeID: 115, value: "GENIE" }]);
  const projection = projectCommercialAttributes(published, proposed, catalog);
  assert.deepEqual(projection.recovered, [{ attributeID: 24, value: "Macizos" }]);
  assert.deepEqual(projection.accepted, [
    { attributeID: 115, value: "GENIE" }, { attributeID: 24, value: "Macizos" }
  ]);
  assert.deepEqual(proposed.attributes, [{ attributeID: 115, value: "GENIE" }]);
  assert.deepEqual(published.spec, { Ruedas: "MACIZAS" });
  assert.deepEqual(projectCommercialAttributes({ ...published, spec: { Ruedas: "Super elásticas" } }, proposed, catalog).recovered,
    [{ attributeID: 24, value: "Superelásticos" }]);
});

test("rechaza neumáticos ambiguos, medidas, categorías sin relación y sobrescrituras", () => {
  const original = source("6");
  const published = candidate(original, [], null);
  const proposed = candidate(original, []);
  for (const ruedas of ["De bandaje", "28X9-15/7.0 6 5X10/5.0", "Neumáticas/Superelásticas", ""] ) {
    assert.deepEqual(projectCommercialAttributes({ ...published, spec: { Ruedas: ruedas } }, proposed, catalog).recovered, []);
  }
  assert.deepEqual(projectCommercialAttributes({ ...published, spec: { Ruedas: "MACIZAS", Neumáticos: "Otra" } }, proposed, catalog).recovered, []);
  assert.deepEqual(projectCommercialAttributes({ ...published, spec: { Ruedas: "MACIZAS" } },
    { ...proposed, attributes: [{ attributeID: 24, value: "Neumáticos" }] }, catalog).recovered, []);
  assert.deepEqual(projectCommercialAttributes({ ...published, spec: { Ruedas: "MACIZAS" } }, proposed,
    { ...catalog, relations: catalog.relations.filter((relation) => relation.attributeID !== 24) }).recovered, []);
  assert.deepEqual(projectCommercialAttributes({ ...published, providerId: "gomariz", spec: { Ruedas: "MACIZAS" } }, proposed, catalog).recovered, []);
});

test("la auditoría cuenta la recuperación comercial sin contaminar los campos técnicos", () => {
  const example = entry("5", [{ attributeID: 115, value: "GENIE" }]);
  const published = { ...example.published, spec: { Ruedas: "Superelásticas" } };
  const report = analyzeCommercialAttributes([{ ...example, published }], catalog);
  assert.equal(report.mappedAssignments, 1);
  assert.equal(report.recoveredAssignments, 1);
  assert.equal(report.acceptedAssignments, 2);
  assert.equal(report.invalidAssignments, 0);
  assert.equal(report.coverage.find((item) => item.attributeID === 24)?.accepted, 1);
  assert.ok(report.decisions[0]?.attributes.some((item) => item.attributeID === 24 && item.value === "Superelásticos"));
  assert.deepEqual(report.decisions[0]?.recovered, [{ attributeID: 24, value: "Superelásticos" }]);
  assert.equal(example.mapped.product.attributes.length, 1);
});
