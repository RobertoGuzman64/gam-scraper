import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGomarizEditorialFamily } from "../../../gomariz/editorial/mapping/source-family.js";
import { sourceEditorialMeasurement } from "../domain/source-measurement.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const get = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("articuladas: composición desde hechos de dos proveedores, sin copiar alcance o carga inexistentes", () => {
  const outside = get(gomariz.products, "BA1346");
  const listing = get(mercaeleva.products, "M921-0545");
  const before = JSON.stringify([outside, listing]);
  const gomarizFacts = resolveEditorialFacts(outside);
  const mercaelevaFacts = resolveEditorialFacts(listing);
  assert.equal(gomarizFacts?.family, "plataforma-articulada");
  assert.equal(mercaelevaFacts?.family, "plataforma-articulada");
  assert.equal(gomarizFacts?.lateralReachM, 17.07);
  assert.equal(mercaelevaFacts?.lateralReachM, null);
  const a = resolveReusableEditorial(outside);
  const b = resolveReusableEditorial(listing);
  assert.match(a.short ?? "", /altura de trabajo de 27,74 m, alcance lateral de 17,07 m y capacidad de 227 kg/u);
  assert.match(b.short ?? "", /altura de trabajo de 15 m/u);
  assert.doesNotMatch(b.short ?? "", /alcance lateral|capacidad de/u);
  assert.equal(prepareSourceProduct(outside).product.description, a.short);
  assert.equal(JSON.stringify([outside, listing]), before);
});

test("articuladas: se rechazan conflictos y magnitudes ajenas a la fuente", () => {
  const verified = get(gomariz.products, "BA1346");
  const discrepant = get(mercaeleva.products, "M887-9469");
  const gamHeight = get(gam.products, "6607");
  assert.equal(resolveEditorialFacts(discrepant), null);
  assert.equal(resolveEditorialFacts(gamHeight), null);
  for (const changed of [
    { ...verified, specs: { ...verified.specs, "Alcance lateral": "17 kg" } },
    { ...verified, specs: { ...verified.specs, "Altura de trabajo": "27 kg" } },
    { ...verified, specs: { ...verified.specs, Capacidad: "227 litros" } },
    { ...verified, specs: { ...verified.specs, Motor: "Eléctrico" } },
    { ...verified, model: "OTRA VARIANTE" },
    { ...verified, url: verified.url.replace("gomarizrent.com", "otra-fuente.com") }
  ]) {
    assert.equal(resolveEditorialFacts(changed), null, changed.reference ?? undefined);
    assert.deepEqual(resolveReusableEditorial(changed), { short: null, general: null });
  }
});

test("Gomariz: una única interpretación de ruta histórica, independiente de la composición", () => {
  const venta = get(gomariz.products, "BA1551");
  const producto = get(gomariz.products, "BA1346");
  assert.deepEqual(resolveGomarizEditorialFamily(venta), {
    section: "elevacion-y-trabajos-en-altura", key: "brazo-articulado"
  });
  assert.equal(resolveGomarizEditorialFamily(producto), null);
  assert.equal(resolveGomarizEditorialFamily({ ...venta, providerId: "gam" }), null);
  assert.equal(resolveGomarizEditorialFamily({ ...venta, url: "https://example.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/a" }), null);
});

test("magnitudes: parser único, semántica de unidad y precisión estricta", () => {
  assert.equal(sourceEditorialMeasurement("12.30 m", "m"), "12,30");
  assert.equal(sourceEditorialMeasurement("450 kg", "kg"), "450");
  assert.equal(sourceEditorialMeasurement("15 kVA", "kVA"), "15");
  assert.equal(sourceEditorialMeasurement("220 V", "V"), "220");
  for (const value of ["0 m", "12 kg", "12.300 m", "12m extra", "NaN m", "-1 m", 12]) {
    assert.equal(sourceEditorialMeasurement(value, "m"), null);
  }
});
