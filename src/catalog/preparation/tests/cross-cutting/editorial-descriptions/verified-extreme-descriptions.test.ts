import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readMercaelevaSource } from "../../../../../testing/builders/mercaeleva-source-fixture.js";
import { recoverGamDocumentedMobilityAndAccessSpecs } from "../../../evidence/providers/gam/verified-models/documented-mobility-and-access-specs.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { mbModelEditorialEvidence } from "../../../evidence/providers/mercaeleva/mb-model-description.js";
import { braviSkydeckEditorialEvidence } from "../../../evidence/providers/gam/editorial/bravi-skydeck-editorial.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const mercaeleva = await readMercaelevaSource();

const originalGam = gam.products.find((record) => record.reference === "2364");
assert.ok(originalGam);
const originalMb = ["M062-8951", "M119-9334"].map((reference) => {
  const original = mercaeleva.find((record) => record.reference === reference);
  assert.ok(original);
  return original;
});

test("completa primero las tres fichas sin descripciones mediante fuentes de modelo acreditadas", () => {
  assert.match(braviSkydeckEditorialEvidence.manufacturerSource, /^https:\/\/www\.bravi-platforms\.com\//u);
  for (const evidence of Object.values(mbModelEditorialEvidence)) {
    assert.match(evidence.manufacturerSource, /^https:\/\/mb-maquinaria\.com\//u);
    assert.ok(evidence.nominalCapacity > 0);
  }
  for (const original of [originalGam, ...originalMb]) {
    const snapshot = JSON.stringify(original);
    assert.equal(original.shortDescription, null);
    assert.equal(original.longDescription, null);
    const prepared = prepareSourceProduct(original);
    assert.ok(prepared.product.description && prepared.product.description.trim().length > 50);
    assert.ok(prepared.product.description_general && prepared.product.description_general.trim().length > 200);
    assert.deepEqual(prepared.product.spec, original.providerId === "gam" ? recoverGamDocumentedMobilityAndAccessSpecs(original, original.specs ?? {}) : original.specs);
    assert.equal(JSON.stringify(original), snapshot);
    if (original.providerId === "mercaeleva") {
      assert.ok(!prepared.issues.some((issue) => issue.includes("Capacidad contradictoria")));
      assert.match(`${prepared.product.description} ${prepared.product.description_general}`, /(?:1\.800|3\.000)\s*kg/iu);
      assert.doesNotMatch(`${prepared.product.description} ${prepared.product.description_general}`, /(?:1\.500|2\.500)\s*kg/iu);
    }
  }
});

test("no aplica textos del modelo a otras referencias, descripciones existentes ni fuentes alteradas", () => {
  for (const original of [originalGam, ...originalMb]) {
    const variants = [
      { ...original, providerId: "gomariz" },
      { ...original, url: original.url.replace("https://", "https://otro.") },
      { ...original, model: "MODELO DISTINTO" },
      { ...original, specs: { ...original.specs, Modelo: "MODELO DISTINTO" } },
      { ...original, shortDescription: "Descripción original conservada" },
      { ...original, longDescription: "Información original conservada" }
    ];
    for (const variant of variants) {
      const prepared = prepareSourceProduct(variant);
      assert.doesNotMatch(`${prepared.product.description} ${prepared.product.description_general}`, /soporte de paneles BRAVI SKY DECK|carretilla eléctrica MB EFL303 de cuatro ruedas|transpaleta eléctrica peatonal MB EPL185/iu);
    }
  }
});
