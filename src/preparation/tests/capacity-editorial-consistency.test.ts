import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../shared/classification/mapping/attribute-mapping.js";
import { gamConfirmedAbsentScalar } from "../gam/classification/mapping/unrepresentable.js";
import { prepareSourceProduct, prepareWithCatalog } from "../prepare-product.js";
import { projectCommercialPresentation } from "../../commercial/projection/presentation-projection.js";
import { hasLoadCapacityDisagreement } from "../../commercial/validation/technical-specifications.js";
import { analyzePresentationConsistency } from "../../commercial/diagnostics/presentation-consistency.js";
import { reconcileGamVerifiedCapacityCoherence } from "../gam/technical/reconciliation/gam-verified-capacity-coherence.js";
import { reconcileGamHandlingCapacityEditorial } from "../gam/editorial/models/handling-capacity-editorial.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");

const find = (reference: string): ProductRecord => {
  const record = products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("La capacidad restringida XGS58E1 no se presenta como carga universal", () => {
  const record = find("4792");
  const original = JSON.stringify(record);
  const prepared = prepareSourceProduct(record);
  assert.equal(JSON.stringify(record), original);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "450 kg con limitación");
  assert.match(prepared.product.description ?? "", /450 kg con restricciones/u);
  assert.match(prepared.product.description_general ?? "", /230 kg/u);
  assert.match(prepared.product.description_general ?? "", /450 kg con restricciones/u);
  assert.doesNotMatch(prepared.product.description ?? "", /Capacidad de la cesta 450 kg$/u);
});

test("Una capacidad contradictoria no adquiere certeza por aparecer en el resumen", () => {
  for (const [reference, sourceCapacity, technicalCapacity] of [
    ["4807", "200", "159"],
    ["6934", "230", "220"]
  ] as const) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(JSON.stringify(record), original, reference);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], `${technicalCapacity} KG`, reference);
    assert.match(prepared.product.description ?? "", /pendiente de verificar/u, reference);
    assert.ok(prepared.product.description?.includes(`${sourceCapacity} kg en anuncio`), reference);
    assert.ok(prepared.product.description?.includes(`${technicalCapacity} kg en ficha técnica`), reference);
    assert.ok(prepared.product.description_general?.includes(`${technicalCapacity} kg`), reference);
    assert.ok(prepared.product.description_general?.includes(`${sourceCapacity} kg`), reference);
    assert.match(prepared.product.description_general ?? "", /placa/u, reference);
  }
  const jlg = prepareSourceProduct(find("6934"));
  assert.equal(jlg.product.spec.Modelo, "E300AJ");
  assert.match(jlg.product.description_general ?? "", /E300AJP.*E300AJ/u);
  assert.doesNotMatch(jlg.product.description_general ?? "", /capacidad nominal de 230 kg/u);
});

test("Las reconciliaciones de capacidad requieren identidad y evidencia técnica exactas", () => {
  for (const reference of ["4792", "4807", "6934"]) {
    const record = find(reference);
    const reconciled = reconcileGamVerifiedCapacityCoherence(record);
    assert.notEqual(reconciled, record, reference);
    for (const altered of [
      { ...record, providerId: "otro" },
      { ...record, reference: "otra" },
      { ...record, brand: "OTRO" },
      { ...record, model: "OTRO" },
      { ...record, url: `${record.url}?variante=2` },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "999 KG" } },
      { ...record, shortDescription: "Resumen alternativo" },
      { ...record, longDescription: "Texto técnico alternativo" }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(reconcileGamVerifiedCapacityCoherence(altered), altered, reference);
    }
  }
});

test("ERP25VL corrige el título y descripción técnicos desde evidencia de unidad, sin tocar el original", () => {
  const source = find("6837");
  const snapshot = JSON.stringify(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.title, "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL");
  assert.match(prepared.product.description_general ?? "", /capacidad de carga indicada de 2500 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /3500 kg/u);
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "2500 KG");
  const commercial = projectCommercialPresentation(source, prepared.product, null);
  assert.equal(commercial.title, "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL");
  assert.match(commercial.description_general ?? "", /capacidad de carga indicada de 2500 kg/u);
  assert.doesNotMatch(commercial.description_general ?? "", /3500 kg/u);
  assert.equal(commercial.spec["Capacidad de carga (kg)"], "2500 KG");
  assert.equal(hasLoadCapacityDisagreement({ title: commercial.title, spec: commercial.spec }), false);
  assert.equal(JSON.stringify(source), snapshot);
});

test("ERP25VL no reconcilia unidades o evidencias que hayan cambiado", () => {
  const original = find("6837");
  const expected = reconcileGamHandlingCapacityEditorial(original);
  assert.notStrictEqual(expected, original);
  assert.equal(expected.title, "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL");
  for (const changed of [
    { ...original, providerId: "otro" },
    { ...original, reference: "otro" },
    { ...original, url: `${original.url}?variante=2` },
    { ...original, externalReference: "OTRA" },
    { ...original, serialNumber: "OTRO" },
    { ...original, year: "2016" },
    { ...original, brand: "OTRA" },
    { ...original, model: "OTRO" },
    { ...original, title: "Otra capacidad 3500 kg" },
    { ...original, shortDescription: "Otro resumen" },
    { ...original, longDescription: `${original.longDescription} Datos nuevos` },
    { ...original, specs: { ...original.specs, "Capacidad de carga (kg)": "3500 KG" } },
    { ...original, specs: { ...original.specs, "Nº de serie": "OTRA" } }
  ] satisfies readonly ProductRecord[]) {
    assert.strictEqual(reconcileGamHandlingCapacityEditorial(changed), changed);
  }
  assert.equal(JSON.stringify(original), JSON.stringify(find("6837")));
});

test("XGA43K conserva la diferencia entre capacidad sin restricción y capacidad condicionada", () => {
  const source = find("5902");
  const snapshot = JSON.stringify(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "460 kg con limitación");
  assert.match(prepared.product.description ?? "", /300 kg sin limitación \/ 460 kg con limitación/u);
  assert.match(prepared.product.description_general ?? "", /300 kg de capacidad de cesta sin limitación y hasta 460 kg con limitación/u);
  const findings = analyzePresentationConsistency([prepared.product]).findings;
  assert.deepEqual(findings, []);
  const unqualified = { ...prepared.product,
    spec: { ...prepared.product.spec, "Capacidad de carga (kg)": "460 KG" } };
  assert.deepEqual(analyzePresentationConsistency([unqualified]).findings.map((item) => item.code),
    ["capacidad-no-cualificada-en-campo"]);
  assert.equal(JSON.stringify(source), snapshot);
});

test("La CTE 18HV corrige el título sin borrar la discrepancia histórica de la descripción", () => {
  const prepared = prepareSourceProduct(find("4650"));
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.title, "Plataforma elevadora sobre camión telescópica CTE B-LIFT 18HV");
  assert.match(prepared.product.description ?? "", /B-LIFT 18HV/u);
  assert.match(prepared.product.description ?? "", /300 kg/u);
  assert.match(prepared.product.description_general ?? "", /resumen original del anuncio indicaba 360 kg/u);
  assert.match(prepared.product.description_general ?? "", /B-LIFT 18HD.*B-LIFT 18HV/u);
  assert.equal(prepared.product.spec.Modelo, "B-LIFT 18HV");
});


test("El filtro numérico de carga no anuncia capacidades condicionadas o contradictorias", async () => {
  const catalog = await loadImportCatalog();
  const capacity = catalog.attributes.find((entry) => entry.name === "Capacidad de la cesta");
  assert.ok(capacity);
  for (const reference of ["4792", "4807", "6934"]) {
    const record = find(reference);
    const technical = prepareSourceProduct(record);
    const commercial = prepareWithCatalog(record, catalog);
    assert.deepEqual(resolveAttribute(record, capacity), { status: "not_observed", value: null }, reference);
    assert.equal(commercial.status, "ready", reference);
    assert.equal(commercial.product.spec["Capacidad de carga (kg)"], technical.product.spec["Capacidad de carga (kg)"], reference);
    assert.ok(commercial.product.attributes.every((entry) => entry.attributeID !== capacity.id), reference);
  }
  const sample = find("4807");
  const modified = { ...sample, longDescription: "Ficha alternativa sin contradicción de carga" };
  assert.equal(gamConfirmedAbsentScalar(modified, capacity), false);
});
