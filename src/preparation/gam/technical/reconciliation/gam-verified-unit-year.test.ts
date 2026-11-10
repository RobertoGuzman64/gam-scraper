import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reconcileGamVerifiedUnitYear } from "./gam-verified-unit-year.js";
import { projectCommercialPresentation } from "../../../../commercial/projection/presentation-projection.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const years = new Map([
  ["6797", "2016"], ["6869", "2008"], ["6870", "2008"], ["6930", "2014"],
  ["6909", "2008"], ["6911", "2014"]
]);

const source = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("las seis unidades acreditadas corrigen únicamente los datos derivados respaldados por su identidad", () => {
  const affected: string[] = [];
  for (const record of gam.products) {
    const before = JSON.stringify(record);
    const reconciled = reconcileGamVerifiedUnitYear(record);
    const expectedYear = years.get(record.reference ?? "");
    if (!expectedYear) {
      assert.strictEqual(reconciled, record, record.reference ?? "sin referencia");
      continue;
    }
    assert.equal(reconciled.year, expectedYear, record.reference ?? "");
    assert.equal(reconciled.shortDescription?.endsWith(`Año ${expectedYear}`), true, record.reference ?? "");
    const unchanged = { ...reconciled, year: record.year, shortDescription: record.shortDescription,
      longDescription: record.longDescription };
    assert.deepEqual(unchanged, record);
    if (record.reference === "6909" || record.reference === "6911") {
      assert.notEqual(reconciled.longDescription, record.longDescription);
      assert.doesNotMatch(reconciled.longDescription ?? "", /fabricada en (?:el año )?(?:2006|2007)\b/iu);
    } else {
      assert.equal(reconciled.longDescription, record.longDescription);
    }
    assert.strictEqual(reconcileGamVerifiedUnitYear(reconciled), reconciled);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference ?? "");
    assert.equal(prepared.product.description?.includes(`Año ${expectedYear}`), true, record.reference ?? "");
    if (record.reference === "6909" || record.reference === "6911") {
      assert.doesNotMatch(prepared.product.description_general ?? "", /fabricada en (?:el año )?(?:2006|2007)\b/iu);
      const presentation = projectCommercialPresentation(record, prepared.product, null);
      assert.match(presentation.description ?? "", new RegExp(`Año ${expectedYear}\\b`, "u"));
      assert.doesNotMatch(presentation.description_general ?? "", /fabricada en (?:el año )?(?:2006|2007)\b/iu);
    }
    assert.equal(JSON.stringify(record), before, record.reference ?? "");
    affected.push(record.reference ?? "");
  }
  assert.deepEqual(affected.sort(), [...years.keys()].sort());
});

test("no aplica el año acreditado a otra identidad ni a evidencia alterada", () => {
  for (const reference of years.keys()) {
    const record = source(reference);
    const invalid = [
      { ...record, reference: "otro" },
      { ...record, providerId: "gomariz" },
      { ...record, url: `${record.url}?variant=1` },
      { ...record, externalReference: "otra-unidad" },
      { ...record, serialNumber: "otra-serie" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO" },
      { ...record, title: `${record.title} otro modelo` },
      { ...record, year: "2020" },
      { ...record, yearSource: "url" as const },
      { ...record, condition: "Nuevo" as const },
      { ...record, shortDescription: `${record.shortDescription} texto añadido` },
      { ...record, longDescription: `${record.longDescription} Año de fabricación 2020.` },
      { ...record, specs: { ...record.specs, "Nº de serie": "otra-serie" } }
    ];
    for (const altered of invalid) {
      assert.strictEqual(reconcileGamVerifiedUnitYear(altered), altered, `${reference}: identidad o evidencia`);
    }
  }
});
