import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reconcileGamVerifiedCteBLift18HvIdentity } from "./cte-b-lift-18hv-identity.js";

const { products } = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const source = products.find((item) => item.reference === "4650");
assert.ok(source);

test("GAM 4650 reconcilia la variante CTE 18HV respaldada por ficha y catálogo del fabricante", () => {
  const snapshot = JSON.stringify(source);
  const corrected = reconcileGamVerifiedCteBLift18HvIdentity(source);
  assert.notStrictEqual(corrected, source);
  assert.equal(corrected.title, "Plataforma elevadora sobre camión telescópica CTE B-LIFT 18HV");
  assert.match(corrected.shortDescription ?? "", /CTE B-LIFT 18HV Nueva/u);
  assert.deepEqual(corrected.specs, source.specs);
  assert.deepEqual(corrected.images, source.images);
  assert.equal(corrected.url, source.url);
  assert.equal(corrected.externalReference, source.externalReference);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.title, corrected.title);
  assert.equal(prepared.product.description_title, corrected.title);
  assert.equal(prepared.product.spec.Modelo, "B-LIFT 18HV");
  assert.equal(prepared.product.spec["Capacidad de carga (kg)"], "300 KG");
  assert.equal(JSON.stringify(source), snapshot);
});

test("GAM 4650 no reconcilia modelos, variantes ni evidencias modificadas", () => {
  for (const candidate of [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "4651" },
    { ...source, condition: "Segunda mano" },
    { ...source, categoryKey: "elevacion" },
    { ...source, url: `${source.url}?variante=2` },
    { ...source, brand: "OTRO" },
    { ...source, model: "B-LIFT 18HD" },
    { ...source, externalReference: "B-LIFT 18HV" },
    { ...source, title: source.title?.replace("18HD", "18HV") ?? null },
    { ...source, shortDescription: source.shortDescription?.replace("18HD", "18HV") ?? null },
    { ...source, specs: { ...source.specs, Modelo: "B-LIFT 18HD" } },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "230 KG" } },
    { ...source, image: "https://online.gamrentals.com/otra-portada.jpg" },
    { ...source, longDescription: "Descripción distinta" }
  ] satisfies readonly ProductRecord[]) {
    assert.strictEqual(reconcileGamVerifiedCteBLift18HvIdentity(candidate), candidate);
  }
  for (const record of products) {
    if (record.reference !== "4650") {
      assert.strictEqual(reconcileGamVerifiedCteBLift18HvIdentity(record), record, record.reference ?? "");
    }
  }
});
