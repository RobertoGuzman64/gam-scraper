import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../normalization/normalize-specs.js";
import { recoverGamSourceGradeabilitySpecs } from "../../../../evidence/providers/gam/movilidad/source-gradeability-evidence.js";
import { recoverGamSweepingBrushSpecs } from "../../../../evidence/providers/gam/operacion-seguridad/sweeping-brush-evidence.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");

const main = "Anchura del cepillo principal (mm)";
const side = "Anchura del cepillo lateral (mm)";
const single = "Anchura de barrido con un cepillo lateral (mm)";
const double = "Anchura de barrido con dos cepillos laterales (mm)";
const grade = "Pendiente superable (%)";

const expected: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "4657": { [grade]: 31 },
  "4019": { [main]: 915 },
  "4020": { [main]: 915 },
  "4022": { [main]: 1220 },
  "4025": { [main]: 650, [side]: 460 },
  "4026": { [main]: 680, [side]: 520 },
  "4027": { [main]: 680, [side]: 460 },
  "4030": { [main]: 810, [side]: 510 },
  "4031": { [single]: 1270, [double]: 1570 },
  "4032": { [single]: 1270, [double]: 1570 },
  "4033": { [main]: 1145, [side]: 660 },
  "4034": { [main]: 1270, [side]: 660 }
};

const original = (reference: string): ProductRecord => {
  const record = gam.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

const recover = (record: ProductRecord) => recoverGamSourceGradeabilitySpecs({
  ...record, specs: recoverGamSweepingBrushSpecs(record)
});

test("incorpora medidas de cepillos y pendientes acreditadas, con normalización y origen inmutables", () => {
  for (const [reference, fields] of Object.entries(expected)) {
    const source = original(reference);
    const initial = structuredClone(source);
    const product = prepareSourceProduct(source).product;
    const normalized = normalizeSpecsObject(product.spec);
    for (const [key, value] of Object.entries(fields)) {
      assert.equal(product.spec[key], value, `${reference}: ${key}`);
      assert.equal(normalized.normalized[key], value, `${reference}: normalización ${key}`);
      assert.ok(!normalized.unknownKeys.includes(key), `${reference}: ${key}`);
    }
    for (const [key, value] of Object.entries(source.specs ?? {})) {
      assert.deepEqual(product.spec[key], value, `${reference}: origen ${key}`);
    }
    assert.deepEqual(source, initial, reference);
  }
});

test("únicamente recupera estas medidas cuando está acreditada la identidad y la configuración", () => {
  const observed = gam.products.flatMap((record) => {
    const result = recover(record);
    const gained = Object.keys(result).filter((key) => !Object.hasOwn(record.specs ?? {}, key));
    return gained.length > 0 ? [{ reference: record.reference, fields: gained }] : [];
  });
  assert.deepEqual(new Set(observed.map(({ reference }) => reference)), new Set(Object.keys(expected)));
  assert.equal(observed.reduce((total, { fields }) => total + fields.length, 0),
    Object.values(expected).reduce((total, fields) => total + Object.keys(fields).length, 0));
  for (const record of gomariz.products) {
    assert.deepEqual(recover(record), record.specs ?? {});
  }
});

test("excluye modelos cruzados, valores contradictorios y medidas ya existentes", () => {
  const crossed = original("4029");
  assert.deepEqual(recover(crossed), crossed.specs ?? {});
  const source = original("4025");
  const variants: ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, condition: "Segunda mano" },
    { ...source, categoryKey: "limpieza-fregadoras" },
    { ...source, brand: "Hyster" },
    { ...source, model: "BCS S780" },
    { ...source, reference: "4026" },
    { ...source, url: `${source.url}?variante=otra` },
    { ...source, title: "Barredora Tennant BCS S780" },
    { ...source, specs: { ...source.specs, Modelo: "BCS S780" } }
  ];
  for (const variant of variants) {
    assert.deepEqual(recover(variant), variant.specs ?? {});
  }
  const contradiction = {
    ...source,
    longDescription: `${source.longDescription ?? ""} Cepillo principal de 999 mm y cepillo lateral de 777 mm.`
  };
  assert.deepEqual(recover(contradiction), contradiction.specs ?? {});
  const previouslyKnown = { ...source, specs: { ...source.specs, [main]: 650, [side]: 460 } };
  assert.equal(recover(previouslyKnown)[main], 650);
  assert.equal(recover(previouslyKnown)[side], 460);
});

test("no inventa pendientes cuando se contradice la fuente o la motorización de la ficha", () => {
  const cte = original("4657");
  assert.equal(recover(cte)[grade], 31);
  for (const variant of [
    { ...cte, categoryKey: "carretillas-nuevas" },
    { ...cte, model: "TRACCESS 200E" },
    { ...cte, url: `${cte.url}#motor` },
    { ...cte, specs: { ...cte.specs, "Pendiente superable": "25%" } },
    { ...cte, longDescription: `${cte.longDescription ?? ""} También supera pendientes del 29%.` }
  ]) {
    assert.deepEqual(recover(variant), variant.specs ?? {});
  }
  const yale = original("6745");
  assert.deepEqual(recover(yale), yale.specs ?? {});
});
