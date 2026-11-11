import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";

const [gam, mercaeleva, gomariz] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json")
]);
const find = (products: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Las cuatro diferencias técnicas conservan transformaciones acreditadas del origen", () => {
  const battery = find(gam.products, "2219");
  const batteryBefore = JSON.stringify(battery);
  const batteryPrepared = prepareSourceProduct(battery);
  assert.equal(battery.specs?.["Ancho promedio"], "24V / 840-1000Ah(V/Ah)");
  assert.equal(batteryPrepared.product.spec["Ancho promedio"], undefined);
  assert.equal(batteryPrepared.product.spec["Voltaje batería (V)"], "24 V");
  assert.equal(batteryPrepared.product.spec["Capacidad de la batería (Ah)"], "840-1000 Ah");
  assert.equal(batteryPrepared.product.spec.Anchura, "1056 mm");
  assert.equal(JSON.stringify(battery), batteryBefore);

  const zero = find(gam.products, "6807");
  const musoshi = find(gam.products, "6806");
  const zeroBefore = JSON.stringify(zero);
  assert.equal(zero.specs?.["Nº de serie"], "NRXL3AALS10000101");
  assert.equal(musoshi.specs?.["Nº de serie"], "NRXL3AALS10000101");
  const zeroPrepared = prepareSourceProduct(zero);
  assert.equal(zeroPrepared.product.spec["Nº de serie"], undefined);
  assert.equal(zeroPrepared.product.spec.Matrícula, "2722MHH");
  assert.equal(zeroPrepared.product.spec.Kilómetros, "5837 KM");
  assert.equal(JSON.stringify(zero), zeroBefore);

  for (const [reference, wrongHours, mileage, statement] of [
    ["M329-6156", "73 883 h", "73 883 km", "KM 73883"],
    ["M502-4867", "42 922 h", "42 922 km", "KM 42922"]
  ] as const) {
    const original = find(mercaeleva.products, reference);
    const before = JSON.stringify(original);
    assert.equal(original.specs?.["Horas laborales"], wrongHours);
    assert.ok(original.longDescription?.includes(statement), reference);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec["Horas laborales"], undefined, reference);
    assert.equal(prepared.product.spec.Kilometraje, mileage, reference);
    assert.equal(prepared.product.spec["Altura de trabajo"], original.specs?.["Altura de trabajo"], reference);
    assert.equal(JSON.stringify(original), before, reference);
  }
});


test("B1–B4: procedencia y reconciliación de fichas contradictorias permanecen separadas", () => {
  const linde = find(mercaeleva.products, "M827-8304");
  const lindePrepared = prepareSourceProduct(linde);
  assert.equal(lindePrepared.product.spec["Capacidad máxima de elevación"], "4800 kg");
  assert.equal(lindePrepared.product.spec["Tipo de mástil"], "Dúplex/estándar");
  assert.match(lindePrepared.product.description_general ?? "", /reconciliación acreditada.*placa/u);

  const small = find(gam.products, "1210");
  const large = find(gam.products, "1218");
  const sharedKeys = ["Longitud", "Anchura", "Altura", "Peso", "Marca motor", "Potencia Motor (KW)", "Combustible", "Marca alternador"];
  for (const key of sharedKeys) assert.equal(large.specs?.[key], small.specs?.[key], key);
  assert.notEqual(large.model, small.model);
  assert.match(prepareSourceProduct(large).product.description_general ?? "", /no permiten atribuir una configuración única/u);

  const jlg = find(mercaeleva.products, "M050-6081");
  assert.equal(jlg.specs?.["Altura de plataforma"], undefined);
  assert.equal(jlg.specs?.["Alcance horizontal"], undefined);
  const jlgPrepared = prepareSourceProduct(jlg);
  assert.equal(jlgPrepared.product.spec["Altura de plataforma"], "13,72 m");
  assert.equal(jlgPrepared.product.spec["Alcance horizontal"], "7,47 m");
  assert.match(jlgPrepared.product.description_general ?? "", /referencias de fabricante.*no acreditan la configuración/u);

  const tennant = find(gam.products, "4028");
  const tennantPrepared = prepareSourceProduct(tennant);
  assert.equal(tennantPrepared.product.spec["Capacidad volumétrica de tolva"], "85 l");
  assert.equal(tennantPrepared.product.spec["Longitud del cepillo principal"], "560 mm");
  assert.match(tennantPrepared.product.description_general ?? "", /hasta 90 kg/u);
  assert.match(tennantPrepared.product.description_general ?? "", /prestaciones detalladas corresponden al barrido/u);
});

test("B5–B8: diferencias del anuncio se explican sin inventar una lectura unificada", () => {
  const lgmg = find(gomariz.products, "TE1858");
  assert.equal(lgmg.specs?.["Altura plataforma"], "14.30 m");
  const lgmgPrepared = prepareSourceProduct(lgmg);
  assert.equal(lgmgPrepared.product.spec["Altura plataforma"], "4,3 m");
  assert.match(lgmgPrepared.product.description_general ?? "", /14,30 m.*sin atribuir/u);

  const jcb = find(gomariz.products, "RE454");
  assert.equal(jcb.specs?.Motor, "Eléctrico");
  assert.match(prepareSourceProduct(jcb).product.description_general ?? "", /motor eléctrico.*no se traslada/u);

  const manitou = find(mercaeleva.products, "M106-1389");
  assert.equal(manitou.specs?.["Artículo No."], "689");
  assert.match(manitou.longDescription ?? "", /Ref\.?\s*686/u);
  assert.match(prepareSourceProduct(manitou).product.description_general ?? "", /Ref\.? 686.*Artículo No.*689/u);

  const ammann = find(gam.products, "6608");
  assert.equal(ammann.specs?.Peso, "680 KG");
  assert.match(ammann.shortDescription ?? "", /600 Kg/u);
  assert.match(prepareSourceProduct(ammann).product.description_general ?? "", /680 kg.*600 kg/u);
});
