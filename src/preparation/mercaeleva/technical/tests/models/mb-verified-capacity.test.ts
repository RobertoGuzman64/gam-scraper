import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../../../../shared/classification/mapping/attribute-mapping.js";
import { mercaelevaMbManufacturerCapacityEvidence, verifiedMercaelevaMbCapacity, verifiedMercaelevaMbCapacityProposal } from "../../../../../catalog/interventions/verified-mercaeleva-capacity.js";
import { validateInterventionProposals } from "../../../../../catalog/interventions/proposals.js";
import { readProposedField, writeProposedField } from "../../../../../catalog/interventions/values.js";
import { buildProductIdentity } from "../../../../../catalog/identity.js";
import { projectPresentableSpecifications, isAccreditedMercaelevaMbCapacityProjection } from "../../../../../commercial/projection/spec-projection.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { analyzePresentationConsistency } from "../../../../../commercial/diagnostics/presentation-consistency.js";
import { hasLoadCapacityDisagreement } from "../../../../../commercial/validation/technical-specifications.js";

const catalog = await loadImportCatalog();
const source = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const capacity = catalog.attributes.find((attribute) => attribute.name === "Capacidad de carga" && attribute.unit_option === "kg");
assert.ok(capacity);

const find = (reference: string): ProductRecord => {
  const record = source.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

for (const [reference, expected, original] of [
  ["M062-8951", 3000, "2500 kg"],
  ["M119-9334", 1800, "1500 kg"]
] as const) {
  test(`Mercaeleva: ${reference} reconoce capacidad MB confirmada y preserva la ficha original`, () => {
    const record = find(reference);
    const before = JSON.stringify(record);
    assert.equal(verifiedMercaelevaMbCapacity(record), expected);
    assert.deepEqual(resolveAttribute(record, capacity), { status: "resolved", value: expected });
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready");
    assert.deepEqual(prepared.issues, []);
    const loadAttributes = prepared.product.attributes.filter((item) =>
      catalog.attributes.some((definition) => definition.id === item.attributeID &&
        definition.name === "Capacidad de carga"));
    assert.deepEqual(loadAttributes.map((item) => item.value), [expected]);
    assert.equal(record.specs?.["Capacidad máxima de elevación"], original);
    assert.equal(prepared.product.spec["Capacidad máxima de elevación"], `${expected} kg`);
    const expectedSpecs = { ...record.specs };
    expectedSpecs["Capacidad máxima de elevación"] = `${expected} kg`;
    delete expectedSpecs[reference === "M062-8951" ? "Distancia del centro de gravedad" : "Horas laborales"];
    assert.deepEqual(prepared.product.spec, expectedSpecs);
    assert.equal(JSON.stringify(record), before);
  });

  test(`Mercaeleva: ${reference} no acepta falsos positivos de identidad, estado, batería o ficha`, () => {
    const record = find(reference);
    const changed: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, categoryKey: "otros" },
      { ...record, condition: "Segunda mano" },
      { ...record, year: "2024" },
      { ...record, reference: "OTRA" },
      { ...record, url: record.url.replace("sales.mercaeleva.com", "fake.example") },
      { ...record, url: `${record.url}-otro` },
      { ...record, brand: "EP" },
      { ...record, model: `${record.model}S` },
      { ...record, title: `${record.title} 2500 kg` },
      { ...record, shortDescription: "Capacidad alternativa 2500 kg" },
      { ...record, longDescription: "Capacidad de carga de 2500 kg" },
      { ...record, specs: { ...record.specs, Marca: "EP" } },
      { ...record, specs: { ...record.specs, Modelo: "EFL253" } },
      { ...record, specs: { ...record.specs, Estado: "Usado" } },
      { ...record, specs: { ...record.specs, "Tipo de Batería": "Plomo-ácido" } },
      { ...record, specs: { ...record.specs, "Título adicional": "Máquina sin capacidad" } },
      { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": "3000 kg" } },
      { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": ["1500 kg", "1800 kg"] } },
      { ...record, specs: { ...record.specs, "Voltaje de la batería": "24 V" } },
      { ...record, specs: { ...record.specs, "Capacidad de la batería": "150 Ah" } }
    ];
    for (const [index, variant] of changed.entries()) {
      assert.equal(verifiedMercaelevaMbCapacity(variant), null, String(index));
    }
  });
}

test("las dos correcciones utilizan las propuestas y campos del contrato de intervenciones", () => {
  for (const [reference, before, after] of [
    ["M062-8951", "2500 kg", "3000 kg"],
    ["M119-9334", "1500 kg", "1800 kg"]
  ] as const) {
    const record = find(reference);
    const proposal = verifiedMercaelevaMbCapacityProposal(record);
    assert.ok(proposal);
    assert.equal(proposal.identity, buildProductIdentity(record).key);
    assert.equal(proposal.field, "spec:Capacidad máxima de elevación");
    assert.equal(proposal.expected, before);
    assert.equal(proposal.next, after);
    assert.deepEqual(validateInterventionProposals([proposal], "mercaeleva"), [proposal]);
    assert.equal(readProposedField(record, proposal.field), before);
    const derived = writeProposedField(record, proposal);
    assert.equal(derived.specs?.["Capacidad máxima de elevación"], after);
    assert.equal(record.specs?.["Capacidad máxima de elevación"], before);
    assert.equal(verifiedMercaelevaMbCapacityProposal(derived), null);
  }
});

test("las dos capacidades nominales MB corrigen solo los derivados y preservan la detección", () => {
  const records = [find("M062-8951"), find("M119-9334")];
  const before = JSON.stringify(records);
  const products = records.map((record) => {
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.status, "ready", record.reference ?? "");
    assert.equal(hasLoadCapacityDisagreement(prepared.product), false, record.reference ?? "");
    return prepared.product;
  });
  const report = analyzePresentationConsistency(products);
  assert.deepEqual(report.findings, []);
  assert.equal(JSON.stringify(records), before);
  const conflicted = products.map((product, index) => ({ ...product,
    spec: { ...product.spec, "Capacidad máxima de elevación": records[index]?.specs?.["Capacidad máxima de elevación"] ?? "" } }));
  for (const product of conflicted) assert.equal(hasLoadCapacityDisagreement(product), true);
  const reopened = analyzePresentationConsistency(conflicted);
  assert.deepEqual(reopened.findings.map((finding) => [finding.reference, finding.code, finding.status]), [
    ["M062-8951", "capacidad-titulo-spec-discordante", "revisar"],
    ["M119-9334", "capacidad-titulo-spec-discordante", "revisar"]
  ]);
  for (const record of records) {
    const capacity = record.reference === "M062-8951" ? "3000 kg" : "1800 kg";
    const changed = { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": capacity } };
    assert.equal(verifiedMercaelevaMbCapacity(changed), null);
  }
});

test("la capacidad MB no se infiere para otras referencias Mercaeleva", () => {
  const corrected = new Set(["M062-8951", "M119-9334"]);
  for (const record of source.products) {
    if (corrected.has(record.reference ?? "")) continue;
    assert.equal(verifiedMercaelevaMbCapacity(record), null, record.reference ?? "sin referencia");
  }
});

for (const [reference, model, manufacturerCapacity] of [
  ["M062-8951", "EFL303", 3000],
  ["M119-9334", "EPL185", 1800]
] as const) {
  test(`la publicación heredada de ${reference} proyecta únicamente la capacidad oficial`, () => {
    const record = find(reference);
    const published = { ...record.specs };
    const projected = projectPresentableSpecifications(published, record);
    assert.equal(projected["Capacidad máxima de elevación"], `${manufacturerCapacity} kg`);
    assert.equal(isAccreditedMercaelevaMbCapacityProjection(record, published, projected), true);
    assert.equal(mercaelevaMbManufacturerCapacityEvidence[model].capacityKg, manufacturerCapacity);
    assert.match(mercaelevaMbManufacturerCapacityEvidence[model].url, /^https:\/\/ep-equipment\.com\/es\/product\//);
    const unrelatedDifference = { ...projected, "Tipo de Batería": "otra" };
    assert.equal(isAccreditedMercaelevaMbCapacityProjection(record, published, unrelatedDifference), false);
    const changed = { ...published, Modelo: `${model}S` };
    assert.equal(isAccreditedMercaelevaMbCapacityProjection(record, changed, projected), false);
    assert.deepEqual(record.specs, published);
  });
}
