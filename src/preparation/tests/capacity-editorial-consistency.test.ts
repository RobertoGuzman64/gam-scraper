import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../shared/classification/mapping/attribute-mapping.js";
import { gamConfirmedAbsentScalar } from "../gam/classification/mapping/unrepresentable.js";
import { prepareSourceProduct, prepareWithCatalog } from "../prepare-product.js";
import { reconcileGamVerifiedCapacityCoherence } from "../gam/technical/reconciliation/gam-verified-capacity-coherence.js";

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
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "450 KG");
  assert.match(prepared.product.description ?? "", /450 kg con restricciones/u);
  assert.match(prepared.product.description_general ?? "", /230 kg estándar y 450 kg restringido/u);
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

test("La CTE 18HD conserva el conflicto de modelo sin reproducir como vigente el resumen anterior", () => {
  const prepared = prepareSourceProduct(find("4650"));
  assert.equal(prepared.status, "ready");
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
