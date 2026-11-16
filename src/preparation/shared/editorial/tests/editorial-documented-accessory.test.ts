import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverGamDocumentedMobilityAndAccessSpecs } from "../../../gam/technical/models/documented-mobility-and-access-specs.js";
import { resolveDocumentedAccessoryEditorial } from "../mapping/documented-accessory.js";

const source = (): ProductRecord => accreditedSourceRecord("gam-original", "2364");

test("BRAVI SKY DECK utiliza solo el conocimiento documentado y mantiene sus límites de carga", () => {
  const original = source();
  const before = JSON.stringify(original);
  const specs = recoverGamDocumentedMobilityAndAccessSpecs(original, original.specs ?? {});
  const editorial = resolveDocumentedAccessoryEditorial(original, { ...original, specs });
  assert.ok(editorial);
  assert.match(editorial.short, /portapaneles/iu);
  assert.match(editorial.general, /4,2 kg/u);
  assert.match(editorial.general, /1\.500 × 750 × 120 mm/u);
  assert.match(editorial.general, /tres soportes/u);
  assert.match(editorial.general, /no representa su capacidad de carga/u);
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.product.description, editorial.short);
  assert.equal(prepared.product.description_general, editorial.general);
  assert.equal(JSON.stringify(original), before);
});

test("BRAVI SKY DECK no transfiere la evidencia a otra identidad, anuncio o ficha técnica", () => {
  const original = source();
  const variants: readonly ProductRecord[] = [
    { ...original, providerId: "gomariz" },
    { ...original, reference: "2364-OTRA" },
    { ...original, url: `${original.url}?revision=2` },
    { ...original, brand: "OTRA" },
    { ...original, model: "OTRO" },
    { ...original, title: "SKY DECK II" },
    { ...original, condition: "Segunda mano" },
    { ...original, shortDescription: "capacidad de 4,2 kg" },
    { ...original, specs: { ...original.specs, Modelo: "SKY DECK II" } },
    { ...original, specs: { ...original.specs, "Peso neto del portapaneles": "5 kg" } },
    { ...original, specs: { ...original.specs, "Nueva propiedad": "sin acreditar" } }
  ];
  for (const variant of variants) {
    const recovered = recoverGamDocumentedMobilityAndAccessSpecs(variant, variant.specs ?? {});
    assert.equal(resolveDocumentedAccessoryEditorial(variant, { ...variant, specs: recovered }), null);
  }
});
