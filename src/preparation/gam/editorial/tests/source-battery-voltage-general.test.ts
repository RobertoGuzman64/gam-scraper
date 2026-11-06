import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeGamSourceBatteryVoltageInGeneral } from "../mapping/source-battery-voltage-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("incluye la tensión acreditada de plataformas y apiladores sin alterar la fuente ni las especificaciones", () => {
  for (const [reference, voltage] of [["4731", "24 V"], ["4780", "51,2 V"], ["4388", "24 V"]] as const) {
    const record = find(reference);
    const snapshot = structuredClone(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.spec["Voltaje batería (V)"], voltage, reference);
    assert.match(prepared.product.description_general ?? "", new RegExp(`tensión de batería de ${voltage.replace(",", "[,.]")}\\.`, "iu"), reference);
    assert.deepEqual(record, snapshot, reference);
    assert.equal(includeGamSourceBatteryVoltageInGeneral(record, prepared.product.description_general, prepared.product.spec),
      prepared.product.description_general, reference);
  }
});

test("rechaza variantes ajenas, valores inconsistentes, datos opcionales y texto duplicado", () => {
  const record = find("4731");
  const prepared = prepareSourceProduct(record);
  const general = "La plataforma XCMG XG0607DC permite tareas de elevación.";
  const specs = prepared.product.spec;
  assert.notEqual(includeGamSourceBatteryVoltageInGeneral(record, general, specs), general);
  for (const invalid of [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "99999" },
    { ...record, model: "XG0807DC" },
    { ...record, categoryName: "Plataformas elevadoras usadas" },
    { ...record, url: `${record.url}?other=1` },
    { ...record, longDescription: (record.longDescription ?? "").replace(/24V/iu, "48V") },
    { ...record, longDescription: (record.longDescription ?? "").replace(/baterías de litio de 24V/iu, "baterías opcionales de litio de 24V") },
    { ...record, longDescription: (record.longDescription ?? "").replace(/baterías de litio de 24V/iu, "sin baterías de litio de 24V") }
  ] as const) {
    assert.equal(includeGamSourceBatteryVoltageInGeneral(invalid, general, specs), general, invalid.reference ?? "sin referencia");
  }
  for (const value of ["48 V", "24-48 V", "sin confirmar", 24] as const) {
    assert.equal(includeGamSourceBatteryVoltageInGeneral(record, general, { ...specs, "Voltaje batería (V)": value }), general);
  }
  assert.equal(includeGamSourceBatteryVoltageInGeneral(record, `${general} Batería de 24 V.`, specs), `${general} Batería de 24 V.`);
  assert.equal(includeGamSourceBatteryVoltageInGeneral(record, null, specs), null);
  for (const reference of ["4656", "2151", "6480", "6481"] as const) {
    const optionalVariant = find(reference);
    const optionalPrepared = prepareSourceProduct(optionalVariant);
    assert.equal(includeGamSourceBatteryVoltageInGeneral(optionalVariant, general, optionalPrepared.product.spec), general, reference);
  }
});
