import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";

const originals = {
  gamSweeper: {
    "providerId": "gam",
    "categoryKey": "manutencion",
    "categoryName": "Manutención",
    "url": "https://online.gamrentals.com/es/barredoras/6653-eureka-magnum",
    "title": "Barredora EUREKA MAGNUM",
    "shortDescription": "➨ EUREKA MAGNUM de segunda mano ➨ Venta barredora a pie",
    "longDescription": "➨ EUREKA MAGNUM de segunda mano ➨ Venta barredora a pie",
    "price": "2000",
    "condition": null,
    "reference": "6653",
    "brand": "EUREKA",
    "model": "MAGNUM",
    "year": null,
    "location": "BARCELONA",
    "country": "ESPAÑA",
    "horometer": "2766 horas",
    "serialNumber": "90000126/A1006Z",
    "image": "https://online.gamrentals.com/56900-product_main_2x/eureka-magnum.jpg",
    "specs": {
      "Marca": "EUREKA",
      "Modelo": "MAGNUM",
      "Horómetro": "2766 horas",
      "Nº de serie": "90000126/A1006Z",
      "Ubicación": "BARCELONA",
      "País": "ESPAÑA",
      "Longitud": "2550 mm",
      "Anchura": "1540 mm",
      "Altura": "1601 mm",
      "Peso": "1300 KG"
    }
  },
  gomarizSweeper: {
    "providerId": "gomariz",
    "categoryKey": "venta",
    "categoryName": "Maquinaria de ocasión",
    "url": "https://www.gomarizrent.com/limpieza/barredora/eureka-compact-1150-1/",
    "title": "Eureka Compact 1150",
    "shortDescription": null,
    "longDescription": "Tenemos diferentes modelos de barredoras de varias",
    "price": null,
    "condition": "Segunda mano",
    "reference": "BR901",
    "brand": "Eureka",
    "model": "Compact 1150",
    "year": "2005",
    "location": null,
    "country": null,
    "horometer": null,
    "serialNumber": null,
    "image": "https://www.gomarizrent.com/wp-content/uploads/2024/06/BR901-EUREKA-C1150-9.jpg",
    "specs": {
      "Altura almacenaje": "1.25 m",
      "Longitud": "1.54 m",
      "Anchura": "1.15 m",
      "Peso": "396 kg",
      "Motor": "Eléctrico",
      "Anchura limpieza": "1.15 m"
    }
  },
  gomarizScrubber: {
    "providerId": "gomariz",
    "categoryKey": "venta",
    "categoryName": "Maquinaria de ocasión",
    "url": "https://www.gomarizrent.com/venta/limpieza/fregadora/nilfisk-br850-s-fregadora/",
    "title": "Nilfisk BR850-S",
    "shortDescription": null,
    "longDescription": "Las fregadoras son máquinas que limpian suelos con agua, detergente y cepillos, aspirando el agua sucia para dejar la superficie seca. Se usan en grandes espacios y pueden ser manuales o motorizadas.",
    "price": null,
    "condition": "Segunda mano",
    "reference": "FR1077",
    "brand": "Nilfisk",
    "model": "BR850-S",
    "year": null,
    "location": null,
    "country": null,
    "horometer": null,
    "serialNumber": null,
    "image": "https://www.gomarizrent.com/wp-content/uploads/2024/09/FR1077-NILFISK-BR850-S-5.jpg",
    "specs": {
      "Altura": "1.35 m",
      "Longitud": "1.55 m",
      "Anchura": "0.88 m",
      "Peso": "705 kg",
      "Motor": "Eléctrico",
      "Anchura limpieza": "0.81 m"
    }
  }
} satisfies Readonly<Record<string, ProductRecord>>;

const historical = [
  { source: originals.gamSweeper, family: "barredora", width: null, noun: "barredora" },
  { source: originals.gomarizSweeper, family: "barredora", width: 1.15, noun: "barredora" },
  { source: originals.gomarizScrubber, family: "fregadora", width: 0.81, noun: "fregadora" }
] as const;

const nextUnit = (source: ProductRecord, width: string): ProductRecord => ({
  ...source,
  reference: `${source.reference}-OTRA-UNIDAD`,
  url: `${source.url.replace(/\/$/u, "")}-otra-unidad/`,
  year: null,
  horometer: null,
  serialNumber: null,
  specs: { ...source.specs, "Anchura limpieza": width }
});

test("barredoras y fregadoras históricas conservan familia, medidas y consumo en preparación", () => {
  for (const { source, family, width, noun } of historical) {
    const before = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, family, source.reference ?? "");
    assert.equal(facts.cleaningWidthM, width, source.reference ?? "");
    const composed = resolveReusableEditorial(source);
    assert.match(composed.short ?? "", new RegExp(noun, "iu"));
    assert.match(composed.general ?? "", new RegExp(noun, "iu"));
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", source.reference ?? "");
    assert.match(prepared.product.description_general ?? "", new RegExp(noun, "iu"));
    assert.equal(JSON.stringify(source), before);
  }
});

test("otra unidad compatible reutiliza la regla y solo redacta sus propias medidas", () => {
  for (const [source, width, expected, forbidden] of [
    [originals.gomarizSweeper, "1.20 m", "1,2 m", "1,15 m"],
    [originals.gomarizScrubber, "0.85 m", "0,85 m", "0,81 m"]
  ] as const) {
    const next = nextUnit(source, width);
    const before = JSON.stringify([source, next]);
    assert.equal(resolveEditorialFacts(next)?.family, resolveEditorialFacts(source)?.family);
    const composed = resolveReusableEditorial(next);
    assert.ok(composed.general?.includes(`anchura de trabajo de limpieza de ${expected}`));
    assert.ok(!(composed.general ?? "").includes(`anchura de trabajo de limpieza de ${forbidden}`));
    const prepared = prepareSourceProduct(next);
    assert.equal(prepared.status, "ready");
    assert.ok((prepared.product.description_general ?? "").includes(`anchura de trabajo de limpieza de ${expected}`));
    assert.equal(prepared.product.reference, next.reference);
    assert.equal(prepared.product.sourceUrl, next.url);
    if (source.year) assert.doesNotMatch(prepared.product.description_general ?? "", /año de fabricación 2005/u);
    assert.equal(JSON.stringify([source, next]), before);
  }
});

test("identidad, procedencia y contradicciones de familia impiden reutilizar hechos de limpieza", () => {
  for (const { source, family } of historical) {
    const incompatible = family === "barredora" ? "Fregadora" : "Barredora";
    for (const changed of [
      { ...source, providerId: "otro-proveedor" },
      { ...source, url: "https://example.invalid/limpieza/maquina/" },
      { ...source, model: "MODELO-AJENO" },
      { ...source, brand: "MARCA-AJENA" },
      { ...source, specs: { ...source.specs, "Título adicional": incompatible } },
      { ...source, specs: {} }
    ]) {
      assert.equal(resolveEditorialFacts(changed), null, `${source.reference}: ${changed.url}`);
      assert.deepEqual(resolveReusableEditorial(changed), { short: null, general: null });
    }
  }
});
