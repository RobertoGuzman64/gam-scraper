import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { reconcileGamSourceTechnicalUnits } from "../reconciliation/gam-source-technical-units.js";
import { normalizeMercaelevaAusaHeightText } from "../reconciliation/mercaeleva-ausa-height.js";

const [gam, mercaeleva, gomariz] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json")
]);

const recordOf = (products: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("normaliza alturas publicadas con unidades duplicadas sin convertir las magnitudes", () => {
  const heights = [
    ["2110", "6085 mm"],
    ["2111", "9225 mm"],
    ["2112", "9225 mm"],
    ["2113", "10725 mm"],
    ["2130", "- / 980 mm"],
    ["2237", "- / 980 / 1500 mm"],
    ["2128", "4807 mm"],
    ["2129", "4920 mm"],
    ["2127", "5420 mm"],
    ["2131", "- / 980 / 1500 mm"],
    ["2132", "- / 980 / 1500 mm"],
    ["2133", "- / 980 / 1500 mm"],
  ] as const;
  for (const [reference, height] of heights) {
    const original = recordOf(gam.products, reference);
    const snapshot = structuredClone(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec["Altura Plataforma"], height, reference);
    assert.deepEqual(original, snapshot, reference);
  }
  for (const reference of ["6873", "6874"]) {
    const original = recordOf(gam.products, reference);
    assert.equal(prepareSourceProduct(original).product.spec["Alcance Lateral"], "8,5 m", reference);
  }
});

test("conserva únicamente el voltaje acreditado cuando la capacidad se expresa incorrectamente en horas", () => {
  for (const reference of ["2108", "2109", "920"]) {
    const original = recordOf(gam.products, reference);
    assert.equal(original.specs?.["Capacidad de la batería"], "24V / 240h(V/Ah)", reference);
    const before = structuredClone(original);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec["Capacidad de la batería"], undefined, reference);
    assert.equal(prepared.product.spec["Capacidad de la batería (Ah)"], undefined, reference);
    assert.equal(prepared.product.spec["Voltaje batería (V)"], "24 V", reference);
    assert.deepEqual(original, before, reference);
  }
});

test("traslada datos eléctricos tipados fuera del campo de anchura sin alterar dimensiones", () => {
  const original = recordOf(gam.products, "2218");
  const before = structuredClone(original);
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.product.spec["Ancho promedio"], undefined);
  assert.equal(prepared.product.spec["Voltaje batería (V)"], "24 V");
  assert.equal(prepared.product.spec["Capacidad de la batería (Ah)"], "735-875 Ah");
  assert.equal(prepared.product.spec.Anchura, "1056 mm");
  assert.deepEqual(original, before);
});

test("solo normaliza los valores malformados identificables sin pisar medidas contradictorias", () => {
  const record = recordOf(gam.products, "2218");
  const battery = recordOf(gam.products, "2109");
  const height = recordOf(gam.products, "2110");
  const otherProvider = recordOf(gomariz.products, gomariz.products[0]?.reference ?? "");
  assert.equal(reconcileGamSourceTechnicalUnits(recordOf(gam.products, "2219")).specs?.["Capacidad de la batería (Ah)"], "840-1000 Ah");
  assert.deepEqual(reconcileGamSourceTechnicalUnits(otherProvider), otherProvider);
  assert.deepEqual(reconcileGamSourceTechnicalUnits({ ...record, specs: { ...record.specs, "Voltaje batería (V)": "48 V" } }).specs,
    { ...record.specs, "Voltaje batería (V)": "48 V" });
  assert.deepEqual(reconcileGamSourceTechnicalUnits({ ...battery, specs: { ...battery.specs, "Voltaje batería (V)": "48 V" } }).specs,
    { ...battery.specs, "Voltaje batería (V)": "48 V" });
  assert.deepEqual(reconcileGamSourceTechnicalUnits({ ...height, specs: { ...height.specs, "Altura Plataforma": "6085 metros" } }).specs,
    { ...height.specs, "Altura Plataforma": "6085 metros" });
});

test("sanea dos resúmenes de Ausa solo con altura de elevación acreditada", () => {
  for (const reference of ["M855-6850", "M640-1938"]) {
    const original = recordOf(mercaeleva.products, reference);
    const before = structuredClone(original);
    const prepared = prepareSourceProduct(original);
    assert.match(prepared.product.description ?? "", /ALTURA DE ELEVACION 4\.300 mm/u, reference);
    assert.doesNotMatch(prepared.product.description_general ?? "", /4\.30mm/u, reference);
    assert.doesNotMatch(`${prepared.product.description} ${prepared.product.description_general}`, /4\.30mm|ALTURA DE TRABAJO 4\.300 mm/u, reference);
    assert.equal(prepared.product.spec["Altura máxima de elevación"], "4300 mm", reference);
    assert.deepEqual(original, before, reference);
    assert.equal(normalizeMercaelevaAusaHeightText({ ...original, specs: { ...original.specs, "Altura máxima de elevación": "3900 mm" } },
      original.longDescription), original.longDescription, reference);
    assert.equal(normalizeMercaelevaAusaHeightText({ ...original, model: "C250HX4-otra" }, original.longDescription),
      original.longDescription, reference);
  }
});

test("omite alturas de plataforma que no se pueden acreditar sin convertir unidades", () => {
  const original = recordOf(gam.products, "1714");
  const before = structuredClone(original);
  const prepared = prepareSourceProduct(original);
  assert.equal(prepared.product.spec["Altura Plataforma"], undefined);
  assert.equal(prepared.status, "ready");
  assert.equal(reconcileGamSourceTechnicalUnits({ ...original, model: "MS20X" }).specs?.["Altura Plataforma"],
    "4.8mm metros");
  assert.deepEqual(original, before);
});

test("normaliza la altura de plataforma acreditada de tres recogepedidos Yale", () => {
  for (const reference of ["2238", "2239", "2240"]) {
    const original = recordOf(gam.products, reference);
    const before = structuredClone(original);
    assert.equal(original.specs?.["Altura Plataforma"], "-/980 metros", reference);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec["Altura Plataforma"], "- / 980 mm", reference);
    assert.equal(reconcileGamSourceTechnicalUnits({ ...original, model: "Otro" }).specs?.["Altura Plataforma"],
      "-/980 metros", reference);
    assert.deepEqual(original, before, reference);
  }
});

test("elimina etiquetas duplicadas de batería sin perder voltaje ni amperios-hora", () => {
  const values = [
    ["2237", "24V / 465Ah(V/Ah)"],
    ["2238", "24V / 500Ah(V/Ah)"],
    ["2239", "24V / 465Ah(V/Ah)"],
    ["2240", "24V / 620Ah(V/Ah)"]
  ] as const;
  for (const [reference, battery] of values) {
    const original = recordOf(gam.products, reference);
    const before = structuredClone(original);
    assert.equal(original.specs?.["Capacidad de la batería"], `${battery}(V/Ah)`, reference);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec["Capacidad de la batería"], battery, reference);
    assert.deepEqual(original, before, reference);
  }
});

test("la salida técnica de los tres proveedores no reintroduce unidades duplicadas", () => {
  for (const products of [gam.products, gomariz.products, mercaeleva.products]) {
    for (const original of products) {
      const prepared = prepareSourceProduct(original).product;
      for (const [key, value] of Object.entries(prepared.spec)) {
        if (typeof value !== "string") continue;
        assert.doesNotMatch(value, /\bmm\s+metros?\b|\bm\s+metros?\b|\(V\/Ah\)\s*\(V\/Ah\)/iu,
          `${original.providerId}:${original.reference}:${key}`);
      }
    }
  }
});

test("no publica tensiones de batería como potencia de motor en arrastradores", () => {
  for (const [reference, key, value] of [
    ["2573", "Potencia Motor (CV)", "48"],
    ["2737", "Potencia Motor (KW)", "36"]
  ] as const) {
    const original = recordOf(gam.products, reference);
    const snapshot = structuredClone(original);
    assert.equal(original.specs?.[key], value, reference);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec[key], undefined, reference);
    assert.equal(prepared.product.spec.Baterías, original.specs?.Baterías, reference);
    assert.equal(prepared.product.spec["Capacidad de arrastre"], original.specs?.["Capacidad de arrastre"], reference);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(original, snapshot, reference);
    for (const modified of [
      { ...original, model: "OTRO" },
      { ...original, specs: { ...original.specs, Baterías: "Batería sin voltaje" } },
      { ...original, specs: { ...original.specs, [key]: "12" } },
      { ...original, url: original.url.replace("/bts/", "/otro/") },
      { ...original, providerId: "gomariz" }
    ]) assert.equal(reconcileGamSourceTechnicalUnits(modified).specs?.[key], modified.specs?.[key]);
  }
  for (const reference of ["2572", "2738"]) {
    const original = recordOf(gam.products, reference);
    const prepared = prepareSourceProduct(original);
    assert.equal(prepared.product.spec["Potencia Motor (CV)"], original.specs?.["Potencia Motor (CV)"], reference);
    assert.equal(prepared.product.spec["Potencia Motor (KW)"], original.specs?.["Potencia Motor (KW)"], reference);
  }
});
