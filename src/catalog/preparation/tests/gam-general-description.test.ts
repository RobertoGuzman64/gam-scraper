import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamGeneralDescription } from "../mapping/providers/gam/general-description.js";
import { prepareSourceProduct } from "../prepare-product.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected = new Set([
  "6653", "6814", "6815", "4774", "2297", "2229", "2185", "2334", "2202", "2207",
  "2623", "2624", "2625", "2626", "2620", "2621", "2627", "2622"
]);

test("GAM: mejora únicamente las 18 generales con evidencia propia", () => {
  const changed: string[] = [];
  for (const record of catalog.products) {
    const before = JSON.stringify(record);
    const improved = resolveGamGeneralDescription(record);
    const prepared = prepareSourceProduct(record);
    if (improved) {
      assert.ok(record.reference);
      changed.push(record.reference);
      assert.equal(prepared.product.description_general, improved);
      assert.equal(prepared.product.description, record.shortDescription?.trim() ?? null);
      assert.ok(improved.length > (record.longDescription?.length ?? 0));
      assert.equal(improved.includes("Equipamiento Estándar:"), false);
    }
    assert.equal(JSON.stringify(record), before);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    if (improved) assert.deepEqual(prepared.product.spec, record.specs);
  }
  assert.equal(catalog.products.length, 983);
  assert.deepEqual(new Set(changed), expected);
});

test("GAM: portaféretros contrastan identidad, alturas, tracción y medidas antes de ampliar texto", () => {
  const record = find("2624");
  const text = resolveGamGeneralDescription(record);
  assert.ok(text);
  for (const token of ["Draco 45", "4,50 metros", "400 kg", "2300 mm", "1850 mm", "eléctrica"]) {
    assert.ok(text.includes(token), token);
  }
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "mercaeleva" },
    { ...record, categoryKey: "otros" },
    { ...record, condition: "Segunda mano" },
    { ...record, reference: "2625" },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, title: "Portaféretros Draco 36" },
    { ...record, model: "Draco 36" },
    { ...record, longDescription: "Equipamiento Estándar: Incluye accesorios" },
    { ...record, shortDescription: record.shortDescription?.replace("4,50", "5,50") ?? null },
    { ...record, specs: { ...record.specs, Modelo: "Draco 36" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo (m)": "5,5 metros" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "4000 KG" } },
    { ...record, specs: { ...record.specs, Longitud: "2'7' mm" } },
    { ...record, specs: { ...record.specs, Anchura: ["1850 mm", "1900 mm"] } },
    { ...record, specs: { ...record.specs, Tracción: "Manual, por empuje" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGamGeneralDescription(variant), null, String(index));
  }
  assert.equal(resolveGamGeneralDescription(find("2628")), null);
});

test("GAM: para manutención exige marca y modelo propios, carga e información dimensional coherentes", () => {
  const record = find("2334");
  const text = resolveGamGeneralDescription(record);
  assert.ok(text);
  for (const token of ["MS12X", "YALE", "1200 kg", "2009 mm", "790 mm", "2100 mm"]) {
    assert.ok(text.includes(token), token);
  }
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, categoryKey: "elevacion" },
    { ...record, condition: "Segunda mano" },
    { ...record, brand: "HYSTER" },
    { ...record, model: "MS12" },
    { ...record, title: "Apilador eléctrico 1200Kg Yale MS20X" },
    { ...record, title: "Apilador eléctrico 2000Kg Yale MS12X" },
    { ...record, shortDescription: record.shortDescription?.replace("1200 kg", "2000 kg") ?? null },
    { ...record, longDescription: "Descripción editorial propia" },
    { ...record, specs: { ...record.specs, Modelo: "MS20X" } },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2000 KG" } },
    { ...record, specs: { ...record.specs, Anchura: "2420 mm" } },
    { ...record, specs: { ...record.specs, Longitud: "N/D" } },
    { ...record, specs: { ...record.specs, Motorización: "Diésel" } },
    { ...record, specs: { ...record.specs, Altura: ["2100 mm", "2200 mm"] } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGamGeneralDescription(variant), null, String(index));
  }
  for (const reference of ["6617", "2305", "2311", "920", "6971", "6988", "921", "922", "4040"]) {
    assert.equal(resolveGamGeneralDescription(find(reference)), null, reference);
  }
});

test("GAM: los módulos permiten información general propia sin asignar marca ni modelo", () => {
  const record = find("6814");
  const text = resolveGamGeneralDescription(record);
  assert.ok(text);
  assert.match(text, /módulo de baño unitario/);
  for (const fragment of ["1300 mm", "1100 mm", "2400 mm", "200 kg"]) assert.ok(text.includes(fragment));
  for (const variant of [
    { ...record, title: "MÓDULO BAÑO DOBLE WC" },
    { ...record, shortDescription: "Descripción propia y suficiente" },
    { ...record, specs: { ...record.specs, Peso: "2000 libras" } },
    { ...record, specs: { ...record.specs, Anchura: "1600 mm" } },
    { ...record, brand: "Otra marca" },
    { ...record, model: "Otro modelo" }
  ]) assert.equal(resolveGamGeneralDescription(variant), null);
});

test("GAM: la regla no se aplica a las 143 fichas de Gomariz", async () => {
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  assert.equal(gomariz.products.length, 143);
  for (const record of gomariz.products) assert.equal(resolveGamGeneralDescription(record), null);
});

test("GAM: barredora y plataforma no mezclan horas, modelos, alturas ni baterías", () => {
  const sweeper = find("6653");
  const platform = find("4774");
  const one = resolveGamGeneralDescription(sweeper);
  const two = resolveGamGeneralDescription(platform);
  assert.ok(one);
  assert.ok(two);
  for (const token of ["EUREKA MAGNUM", "2766 horas", "2550 mm", "1540 mm", "1300 kg"]) {
    assert.ok(one.includes(token));
  }
  for (const token of ["XGA20ACK-LI", "20 m", "230 kg", "batería de litio", "9500 kg"]) {
    assert.ok(two.includes(token));
  }
  const changes: readonly ProductRecord[] = [
    { ...sweeper, reference: "6654" },
    { ...sweeper, model: "MAGNUM X" },
    { ...sweeper, horometer: "2767 horas" },
    { ...sweeper, specs: { ...sweeper.specs, Horómetro: "2767 horas" } },
    { ...sweeper, specs: { ...sweeper.specs, Peso: "s/d" } },
    { ...platform, reference: "4775" },
    { ...platform, model: "XGA20ACK" },
    { ...platform, title: platform.title?.replace("20M", "22M") ?? null },
    { ...platform, specs: { ...platform.specs, "Altura de elevación (m)": "22 metros" } },
    { ...platform, specs: { ...platform.specs, "Capacidad de carga (kg)": "250 KG" } },
    { ...platform, specs: { ...platform.specs, "Tipo de batería": "Diésel" } }
  ];
  for (const [index, changed] of changes.entries()) {
    assert.equal(resolveGamGeneralDescription(changed), null, String(index));
  }
});

test("GAM: recogepedidos mantiene identidad, carga y elevación documentadas", () => {
  const record = find("2185");
  const general = resolveGamGeneralDescription(record);
  assert.ok(general);
  for (const token of ["HYSTER LO1.2C", "1200 kg", "4500 mm", "1650 kg"]) {
    assert.ok(general.includes(token));
  }
  for (const changed of [
    { ...record, title: "Recogepedidos contrapesada 1500Kg Hyster LO1.2C" },
    { ...record, specs: { ...record.specs, "Altura de elevación (mm)": "4500 m" } },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "1500 KG" } },
    { ...record, specs: { ...record.specs, "Peso": "1650 libras" } },
    { ...record, url: record.url.replace("lo12c", "lo13c") },
    { ...record, categoryKey: "apiladores-nuevos" }
  ]) assert.equal(resolveGamGeneralDescription(changed), null);
});
