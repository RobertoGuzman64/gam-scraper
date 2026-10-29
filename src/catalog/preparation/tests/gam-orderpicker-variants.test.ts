import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { SOURCE_TECHNICAL_FIELDS } from "../source/technical-fields.js";
import { prepareSourceProduct } from "../prepare-product.js";

const attribute = (name: string) => {
  const found = SOURCE_TECHNICAL_FIELDS.find((value) => value.name === name);
  assert.ok(found, name);
  return found;
};

const source = (specs: SpecsMap, family = "recogepedidos-yale"): ProductRecord => ({
  providerId: "gam", categoryKey: "carretillas-nuevas", categoryName: "Carretillas nuevas",
  url: `https://online.gamrentals.com/es/${family}/2238-preparapedidos-yale-mo20`,
  title: "Preparapedidos 2000 Kg Yale MO20", shortDescription: "Yale MO20 preparapedidos eléctrico",
  longDescription: "El preparapedidos Yale MO20 permite diferentes configuraciones de plataforma",
  reference: "2238", price: null, brand: "YALE", model: "MO20", year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  condition: "Nuevo", image: null, specs: { Modelo: "MO20", ...specs }
});

test("GAM: las variantes opcionales de peso y plataforma se conservan sin inventar un escalar", () => {
  for (const family of ["recogepedidos-yale", "yale"]) {
    const record = source({ Peso: "1050 / 1195 / 1225 KG", "Altura Plataforma": "-/980 metros" }, family);
    for (const name of ["Peso", "Peso operativo", "Altura de plataforma"]) {
      assert.deepEqual(resolveAttribute(record, attribute(name)), { status: "not_observed", value: null }, name);
      assert.ok(!prepareSourceProduct(record).issues.includes(`Atributo no normalizable: ${name}`), name);
    }
    assert.equal(record.specs?.["Peso"], "1050 / 1195 / 1225 KG");
    assert.equal(record.specs?.["Altura Plataforma"], "-/980 metros");
  }
});

test("GAM: una variante sin evidencia, una fuente distinta o una medida escalar no se ocultan", () => {
  const record = source({ Peso: "1050 / 1195 / 1225 KG", "Altura Plataforma": "-/980 metros" });
  const incompatible = [
    { ...record, url: record.url.replace("recogepedidos-yale", "transpaletas-yale") },
    { ...record, model: "MO25" },
    { ...record, specs: { ...record.specs, "Altura Plataforma": "980 metros" } },
    { ...record, longDescription: "Recogepedidos Yale MO20 con peso de 1195 kg" },
    { ...record, specs: { ...record.specs, Peso: "1195 KG" } }
  ];
  for (const item of incompatible) {
    const unchanged = resolveAttribute(item, attribute("Peso"));
    const platform = resolveAttribute(item, attribute("Altura de plataforma"));
    assert.ok(unchanged.status !== "not_observed" || platform.status !== "not_observed");
  }
});
