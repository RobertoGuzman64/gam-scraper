import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../commercial-baseline.js";
import { decideCommercialAttributes, validateCommercialAttributeValue } from "../../projection/attribute-decision.js";
import { analyzeCommercialAttributes } from "../commercial-attributes.js";
import { projectCommercialAttributes } from "../../projection/attribute-projection.js";
import { observeCommercialAttributes } from "../../projection/attribute-observation.js";

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
  assert.equal(report.coverage.find((item) => item.attributeID === 115)?.accepted, 1);
  assert.equal(report.coverage.find((item) => item.attributeID === 1)?.accepted, 1);
  assert.equal(report.decisions.length, 4);
  assert.equal(report.decisions.find((item) => item.reference === "3")?.status, "excluded");
  assert.equal(report.decisions.find((item) => item.reference === "1")?.attributes.length, 2);
  assert.deepEqual(report.decisions.find((item) => item.reference === "2")?.unresolved, []);
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

test("required histórico no origina tareas por ausencia y mantiene comprobaciones de contrato", () => {
  const missing = entry("7", [], {});
  const flagged = analyzeCommercialAttributes([missing], catalog);
  const relaxed = analyzeCommercialAttributes([missing], {
    ...catalog, attributes: catalog.attributes.map((attribute) => ({ ...attribute, required: false }))
  });
  assert.deepEqual(flagged, relaxed);
  assert.deepEqual(flagged.decisions[0]?.unresolved, [{ attributeID: 115, status: "resuelto-no-asignado" }]);
  assert.equal(flagged.validationIssues[0]?.reason, "resuelto-no-asignado");
  assert.equal(flagged.acceptedAssignments, 0);
});

test("rechazos protectores por identidad contradictoria no crean una intervención sin valor recuperable", () => {
  const conflicting = {
    ...source("6622", { Marca: "GENIE", Modelo: "GS-5390", "Altura de elevación (m)": "18 metros" }),
    title: "JLG 1930ES | Plataforma Tijera Diésel 8M | GAM Online",
    model: "GS-5390", brand: "GENIE",
    categoryKey: "elevacion", url: "https://online.gamrentals.com/es/plataformas-tijera-diesel-segunda-mano/6622"
  };
  const item: CommercialBaselineInput = {
    source: conflicting, published: candidate(conflicting, [], null),
    mapped: { status: "ready", issues: [], product: candidate(conflicting, [], 29) }
  };
  const report = analyzeCommercialAttributes([item], catalog);
  assert.ok(report.validationIssues.every((issue) => issue.reason === "resuelto-no-asignado"));
  assert.ok(report.decisions[0]?.unresolved.every((item) => item.attributeID !== 1));
  assert.equal(report.coverage.find((value) => value.attributeID === 1)?.accepted, 0);
});


test("no exige atributos fuera de opciones válidas ni proyecta relaciones inexistentes", () => {
  const select = { ...catalog.attributes[0]!, type: "SELECT" as const, unit_option: "GENIE / CAT" };
  const contract: ImportCatalog = { ...catalog, attributes: [select], relations: [
    { categoryID: 29, attributeID: select.id },
    { categoryID: 29, attributeID: select.id }
  ] };
  const original = source("observacion", { Marca: "GENIE" });
  assert.deepEqual(observeCommercialAttributes(original, 29, [], contract), [
    { attributeID: select.id, status: "resuelto-no-asignado" }
  ]);
  const invalid = { ...original, brand: "JLG", specs: { Marca: "JLG" } };
  assert.deepEqual(observeCommercialAttributes(invalid, 29, [], contract), [
    { attributeID: select.id, status: "sin-intervencion" }
  ]);
  assert.deepEqual(observeCommercialAttributes(original, 29, [], { ...contract, relations: [] }), []);
  const record = entry("sin-relaciones", [{ attributeID: 115, value: "GENIE" }]);
  const report = analyzeCommercialAttributes([record], { ...catalog, relations: [] });
  assert.equal(report.acceptedAssignments, 0);
  assert.equal(report.invalidAssignments, 1);
  assert.deepEqual(report.decisions[0]?.attributes, []);
  assert.ok(report.validationIssues.some((issue) => issue.reason === "relacion-invalida"));
  assert.equal(report.validationIssues.some((issue) => issue.reason === "resuelto-no-asignado"), false);
});

test("distingue ausencia de relaciones directas de ausencia de valores admitidos", () => {
  const withoutRelations = entry("sin-relacion", [], { Marca: "GENIE" }, 67);
  const withoutValues = entry("sin-valor", [], {}, 29);
  const accepted = entry("con-atributos", [{ attributeID: 115, value: "GENIE" }]);
  const disabled: ImportCatalog = {
    ...catalog,
    relations: [...catalog.relations, { categoryID: 67, attributeID: 115, actived: false }]
  };
  const report = analyzeCommercialAttributes([withoutRelations, withoutValues, accepted], disabled);
  assert.deepEqual(report.decisions.map((item) => [item.reference, item.relatedAttributes, item.attributes.length]), [
    ["con-atributos", 4, 1], ["sin-relacion", 0, 0], ["sin-valor", 4, 0]
  ]);
  assert.equal(report.invalidAssignments, 0);
  assert.equal(report.validationIssues.find((issue) => issue.reason === "resuelto-no-asignado")?.affected, 1);
  assert.equal(report.productsWithAccepted, 1);
  assert.deepEqual(report.decisions.find((item) => item.reference === "sin-relacion")?.unresolved, []);
});

test("cuenta relaciones directas únicas y no confunde categorías excluidas o pendientes", () => {
  const duplicated: ImportCatalog = {
    ...catalog,
    relations: [...catalog.relations, { categoryID: 29, attributeID: 115 }]
  };
  const pending = entry("pendiente", [], {}, null);
  const excluded = entry("excluido", [], {}, null);
  const report = analyzeCommercialAttributes([
    pending,
    { ...excluded, source: { ...excluded.source, url: "https://online.gamrentals.com/es/lotes/excluido" } },
    entry("validado", [])
  ], duplicated);
  assert.equal(report.decisions.find((item) => item.reference === "validado")?.relatedAttributes, 4);
  assert.equal(report.decisions.find((item) => item.reference === "pendiente")?.relatedAttributes, 0);
  assert.equal(report.decisions.find((item) => item.reference === "excluido")?.relatedAttributes, 0);
});

test("conserva la primera asignación válida aunque llegue detrás de un duplicado inválido", () => {
  const selected = decideCommercialAttributes({ categorySellID: 29, attributes: [
    { attributeID: 12, value: "De bandaje" },
    { attributeID: 12, value: "Macizos" },
    { attributeID: 12, value: "No marcantes" },
    { attributeID: 115, value: "" },
    { attributeID: 115, value: "GENIE" },
    { attributeID: 1, value: -1 },
    { attributeID: 1, value: 12 }
  ] }, catalog);
  assert.deepEqual(selected.accepted, [
    { attributeID: 12, value: "Macizos" },
    { attributeID: 115, value: "GENIE" },
    { attributeID: 1, value: 12 }
  ]);
  assert.deepEqual(selected.issues.map((issue) => issue.reason), [
    "opcion-invalida", "atributo-duplicado", "tipo-invalido", "tipo-invalido"
  ]);
  assert.deepEqual(decideCommercialAttributes({ categorySellID: 29, attributes: [
    { attributeID: 12, value: "Macizos" },
    { attributeID: 12, value: "No marcantes" }
  ] }, catalog).issues.map((issue) => issue.reason), ["atributo-duplicado"]);
});

test("la recuperación de neumáticos exige identidad técnica completa", () => {
  const original = source("unidad-propia", { Ruedas: "MACIZAS" });
  const published = { ...candidate(original, [], null), spec: { Ruedas: "MACIZAS" } };
  const proposed = candidate(original, []);
  assert.deepEqual(projectCommercialAttributes(published, proposed, catalog).recovered,
    [{ attributeID: 24, value: "Macizos" }]);
  for (const foreign of [
    { ...proposed, reference: "otra-unidad" },
    { ...proposed, sourceUrl: "https://online.gamrentals.com/es/maquinaria/otra-unidad" },
    { ...proposed, providerId: "gomariz" }
  ]) {
    const projection = projectCommercialAttributes(published, foreign, catalog);
    assert.deepEqual(projection.recovered, []);
    assert.deepEqual(projection.accepted, []);
  }
  assert.deepEqual(published.spec, { Ruedas: "MACIZAS" });
});


test("no hereda relaciones comerciales del padre ni inventa atributos para categorías sin relación directa", () => {
  const original = source("sin-atributos", { Marca: "GENIE", Ruedas: "MACIZAS" });
  const published = candidate(original, [], null);
  const child = { ...candidate(original, [], 67), attributes: [] };
  const contract: ImportCatalog = { ...catalog, categories: [
    ...catalog.categories, { id: 67, parentId: 29, name: "Subcategoría", slug: "subcategoria" }
  ] };
  const projected = projectCommercialAttributes(published, child, contract);
  assert.deepEqual(projected.accepted, []);
  assert.deepEqual(projected.recovered, []);
  assert.deepEqual(projected.issues, []);
  assert.deepEqual(observeCommercialAttributes(original, 67, projected.accepted, contract), []);
  const direct: ImportCatalog = { ...contract, relations: [
    ...contract.relations, { categoryID: 67, attributeID: 24 }
  ] };
  assert.deepEqual(projectCommercialAttributes(published, child, direct).recovered, [
    { attributeID: 24, value: "Macizos" }
  ]);
  assert.deepEqual(published.spec, { Marca: "GENIE", Ruedas: "MACIZAS" });
});
