import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { reconcileGamForPreparation } from "./gam.js";
import { presentGamVerifiedRestrictedCapacity, reconcileGamVerifiedCapacityCoherence } from "./gam-verified-capacity-coherence.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { analyzePresentationConsistency } from "../../../../commercial/diagnostics/presentation-consistency.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");

for (const [reference, capacity] of [["4792", "450"], ["5902", "460"]] as const) {
  const original = products.find((item) => item.reference === reference);
  assert.ok(original);
  test(`GAM ${reference} conserva la capacidad numérica y solo cualifica su presentación`, () => {
    const snapshot = JSON.stringify(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.status, "ready");
    assert.deepEqual(prepared.issues, []);
    assert.equal(prepared.product.spec["Capacidad de carga (kg)"], `${capacity} kg con limitación`);
    assert.deepEqual(analyzePresentationConsistency([prepared.product]).findings, []);
    const unqualified = { ...prepared.product,
      spec: { ...prepared.product.spec, "Capacidad de carga (kg)": `${capacity} KG` } };
    assert.deepEqual(analyzePresentationConsistency([unqualified]).findings.map((item) => item.code),
      ["capacidad-no-cualificada-en-campo"]);
    const corrected = reconcileGamVerifiedCapacityCoherence(reconcileGamForPreparation(original));
    assert.equal(corrected.specs?.["Capacidad de carga (kg)"], `${capacity} KG`);
    assert.equal(JSON.stringify(original), snapshot);
  });

  test(`GAM ${reference} no presenta capacidades condicionadas ante evidencia diferente`, () => {
    const corrected = reconcileGamVerifiedCapacityCoherence(reconcileGamForPreparation(original));
    const specifications = corrected.specs ?? {};
    assert.notStrictEqual(presentGamVerifiedRestrictedCapacity(corrected, specifications), specifications);
    for (const candidate of [
      { ...corrected, providerId: "otro" },
      { ...corrected, reference: "otra" },
      { ...corrected, categoryKey: "otra" },
      { ...corrected, condition: "Segunda mano" },
      { ...corrected, url: `${corrected.url}?revision=2` },
      { ...corrected, brand: "OTRA" },
      { ...corrected, model: "OTRO" },
      { ...corrected, shortDescription: "Resumen modificado" },
      { ...corrected, longDescription: "Descripción sin acreditación" },
      { ...corrected, specs: { ...corrected.specs, Modelo: "OTRO" } },
      { ...corrected, specs: { ...corrected.specs, "Capacidad de carga (kg)": "300 KG" } }
    ] satisfies readonly ProductRecord[]) {
      assert.strictEqual(presentGamVerifiedRestrictedCapacity(candidate, specifications), specifications);
    }
    assert.strictEqual(presentGamVerifiedRestrictedCapacity(corrected,
      { ...specifications, "Capacidad de carga (kg)": "300 KG" })["Capacidad de carga (kg)"], "300 KG");
  });
}
