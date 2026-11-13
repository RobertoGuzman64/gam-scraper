import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../../../../../catalog/normalization/normalize-specs.js";
import { recoverGamLithiumBatteryType, recoverGamVerifiedMobilityBatteryType } from "../../../../../../preparation/gam/technical/energy/battery-chemistry-evidence.js";
import { prepareSourceProduct } from "../../../../../../preparation/prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = [
  "6218", "6477", "6635", "6636", "6262", "6478", "6479", "6813",
  "4780", "4798", "6419", "6420", "6421", "6425", "6424",
  "3799", "3800", "3801", "3803", "4623"
] as const;

const recordOf = (reference: string): ProductRecord => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("recupera veinte baterías de litio acreditadas sin modificar la fuente", () => {
  for (const reference of references) {
    const record = recordOf(reference);
    const original = structuredClone(record);
    const result = prepareSourceProduct(record);
    const normalized = normalizeSpecsObject(result.product.spec);
    assert.equal(result.product.spec["Tipo de batería"], "Litio", reference);
    assert.equal(normalized.normalized["Tipo de batería"], "Litio", reference);
    assert.ok(!normalized.unknownKeys.includes("Tipo de batería"), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.deepEqual(result.product.spec[key], reference === "6421" && key === "Capacidad de carga (kg)" ? "2000 KG" : value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, original, reference);
  }
});

test("rechaza identidades discordantes, URL manipuladas y química previa", () => {
  const record = recordOf("6419");
  const source = record.specs ?? {};
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "maquinaria" },
    { ...record, condition: "Segunda mano" },
    { ...record, brand: "YALE" },
    { ...record, model: "J1.8UTL" },
    { ...record, title: "Carretilla Hyster J1.8UTL" },
    { ...record, reference: "6418" },
    { ...record, url: `${record.url}?configuracion=otra` },
    { ...record, url: `${record.url}#variante` },
    { ...record, url: record.url.replace("6419-", "6420-") },
    { ...record, specs: { ...source, Marca: "YALE" } },
    { ...record, specs: { ...source, "Tipo de batería": "Plomo-ácido" } },
    { ...record, specs: { ...source, "Batería": "Plomo-ácido" } },
    { ...record, longDescription: "HYSTER J1.5UTL incorpora una batería de plomo-ácido." },
    { ...record, longDescription: `${record.longDescription} También puede montarse batería de plomo-ácido.` },
    { ...record, longDescription: "HYSTER J1.5UTL se ofrece con opción de batería de litio." },
    { ...record, longDescription: "HYSTER J1.5UTL utiliza batería de gel." },
    { ...record, longDescription: "HYSTER J1.5UTL no incorpora una batería de litio." },
    { ...record, longDescription: "HYSTER J1.5UTL usa una batería de litio opcional." }
  ];
  for (const variant of variants) {
    assert.deepEqual(recoverGamLithiumBatteryType(variant), variant.specs ?? {});
  }
});

test("excluye versiones de batería alternativas y fichas sin identidad firme", () => {
  for (const reference of ["6113", "6114", "6115", "6324", "4988", "6480", "6481", "3802", "6423", "6805"]) {
    const record = recordOf(reference);
    assert.deepEqual(recoverGamLithiumBatteryType(record), record.specs ?? {}, reference);
  }
});

test("solo modifica la cohorte acreditada y no aplica recuperaciones GAM a Gomariz", () => {
  const expected = new Set<string>([
    ...references, "6322", "6325", "6326", "6327", "2649", "2796", "2797", "3442"
  ]);
  const improved = gam.products.filter((record) =>
    Object.keys(recoverGamLithiumBatteryType(record)).length > Object.keys(record.specs ?? {}).length
  ).map((record) => record.reference);
  assert.equal(improved.length, expected.size);
  assert.deepEqual(new Set(improved), expected);
  for (const record of gomariz.products) {
    assert.deepEqual(recoverGamLithiumBatteryType(record), record.specs ?? {});
  }
});


test("recupera química identificada y excluye modelos cruzados y alternativas", () => {
  const used = recordOf("6803");
  assert.equal(recoverGamVerifiedMobilityBatteryType(used)["Tipo de batería"], "Litio");
  for (const invalid of [
    { ...used, brand: "OTRA" },
    { ...used, model: "Ibiza Titanium" },
    { ...used, reference: "5949" },
    { ...used, url: `${used.url}?version=otra` },
    { ...used, longDescription: `${used.longDescription} Esta variante monta batería de plomo-ácido.` },
    { ...used, specs: { ...used.specs, "Tipo de batería": "Plomo-ácido" } }
  ]) assert.deepEqual(recoverGamVerifiedMobilityBatteryType(invalid), invalid.specs ?? {});
  assert.deepEqual(recoverGamVerifiedMobilityBatteryType(recordOf("5949")), recordOf("5949").specs);
  assert.deepEqual(recoverGamVerifiedMobilityBatteryType(recordOf("2098")), recordOf("2098").specs);
  assert.equal(recoverGamVerifiedMobilityBatteryType(recordOf("2037"))["Tipo de batería"], "Litio");
});
