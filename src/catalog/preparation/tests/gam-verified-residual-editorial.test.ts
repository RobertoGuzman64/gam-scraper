import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { resolveGamVerifiedResidualEditorial } from "../mapping/providers/gam/verified-residual-editorial.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const selected = new Set(["2148", "6190", "6192", "6191", "6163", "2300", "5899", "2292", "2211", "6542", "2301", "2232", "4725", "2050", "3134", "2302", "2365", "52", "53", "5081"]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("las redacciones verificadas preservan el original y las especificaciones de la preparación", () => {
  for (const reference of selected) {
    const record = find(reference);
    const initial = JSON.stringify(record);
    const result = prepareSourceProduct(record).product;
    assert.ok(result.description_general && result.description_general.length >= 200 && result.description_general.length < 650, reference);
    assert.ok(record.longDescription && result.description_general.length < record.longDescription.length / 2, reference);
    assert.equal(JSON.stringify(record), initial, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) assert.equal(result.spec[key], value, `${reference}: ${key}`);
  }
  assert.doesNotMatch(prepareSourceProduct(find("2148")).product.description_general ?? "", /Hyster RP2\.5N/);
  assert.doesNotMatch(prepareSourceProduct(find("5899")).product.description_general ?? "", /CTE ZED 14/);
  assert.doesNotMatch(prepareSourceProduct(find("2292")).product.description ?? "", /apilador/i);
  assert.match(prepareSourceProduct(find("2050")).product.description_general ?? "", /Hyster H32XD-9/);
});

test("la evidencia editorial no se traslada a otra fuente, identidad ni versión de preparación", () => {
  const record = find("2148");
  const product = prepareSourceProduct(record).product;
  assert.equal(resolveGamVerifiedResidualEditorial(record, product.description, product.description_general), null);
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "2147" },
    { ...record, url: `${record.url}?revision=otra` },
    { ...record, title: "Otro producto" },
    { ...record, model: "RP2.5N" },
    { ...record, longDescription: "Descripción cambiada" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2500 KG" } }
  ];
  for (const changed of variants) assert.notEqual(prepareSourceProduct(changed).product.description_general, product.description_general);
});
