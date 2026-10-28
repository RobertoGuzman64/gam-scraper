import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareProduct } from "../prepare.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { catalog, source, attrVal, categorySlug, gamUrl, gomUrl, merUrl } from "./mapping-fixtures.js";

test("asocia atributos requeridos y convierte unidades explícitas sin confundir alturas", () => {
  const gam = source("gam", gamUrl("carretillas-elevadoras-glp-segunda-mano", "6644"), "Carretilla GLP", {
    "Capacidad de carga (kg)": "3500 KG", "Altura de elevación (mm)": "4900 mm", "Tipo Mástil": "TRIPLEX", "Peso": "3220 KG"
  });
  assert.equal(attrVal(gam, "Capacidad de carga"), 3500);
  assert.equal(attrVal(gam, "Altura de elevación"), 4900);
  assert.equal(attrVal(gam, "Tipo de mástil"), "Tríplex");
  assert.equal(attrVal(gam, "Peso operativo"), 3220);
  assert.equal(attrVal(source("gam", gam.url, gam.title ?? "", { "Altura de elevación (m)": "4.9 metros" }), "Altura de elevación"), 4900);
  assert.equal(attrVal(source("gam", gam.url, "Plataforma", { "Altura de elevación (m)": "8 metros" }), "Altura de trabajo"), null);
  assert.equal(attrVal(source("gam", gam.url, "Carretilla", { "Altura mástil replegado": "2150 mm" }), "Tipo de mástil"), null);
  assert.equal(attrVal(source("gam", gam.url, "Plataforma", { "Altura de trabajo (mm)": "8000 mm" }), "Altura de trabajo"), 8);
  assert.equal(attrVal(source("gam", gam.url, "Carretilla", { "Capacidad de carga (kg)": "1.350 kg" }), "Capacidad de carga"), 1350);
  assert.equal(attrVal(source("gam", gam.url, "Carretilla", { "Capacidad de carga (kg)": "1200 - 1400 kg" }), "Capacidad de carga"), null);
});

test("las fuentes secundarias no inventan precios y aprovechan capacidad declarada", () => {
  const gom = source("gomariz", "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-industrial/heli-cpd35/", "HELI CPD 35", { Motor: "Eléctrico", Capacidad: "3500 kg", "Altura de trabajo": "4.8 m" }, null);
  const prepared = prepareProduct(gom, catalog);
  assert.equal(categorySlug(gom), "carretillas-elevadoras-electricas-segunda-mano");
  assert.equal(attrVal(gom, "Capacidad de carga"), 3500);
  assert.equal(attrVal(gom, "Altura de elevación"), null);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.price, null);
  assert.ok(prepared.importIssues?.createMany.includes("Atributo obligatorio ausente: Altura de elevación"));
  const merca = source("mercaeleva", merUrl("Toyota-6FBRE14-M547-2372"), "Toyota", { "Título adicional": "CARRETILLA ELEVADORA RETRACTIL 1350 KG", "Horas laborales": "14 696 h" });
  assert.equal(attrVal(merca, "Capacidad de carga"), 1350);
  assert.equal(attrVal(merca, "Horas de uso"), 14696);
  const conflicting = source("mercaeleva", merca.url, "Toyota", { "Título adicional": "CARRETILLA RETRACTIL 1350 KG", "Capacidad de carga (kg)": "1600 kg" });
  assert.equal(attrVal(conflicting, "Capacidad de carga"), null);
});

test("contratos: los slugs resueltos existen en el catálogo Equipzilla, sin mutar metadatos", async () => {
  const path = fileURLToPath(new URL("../../../../data/category/categorySell-flat.json", import.meta.url));
  const original: unknown = JSON.parse(await readFile(path, "utf8"));
  assert.equal(Array.isArray(original), true);
  const ids = new Set(catalog.categories.map((entry) => entry.id));
  assert.equal(ids.size, catalog.categories.length);
  assert.equal(catalog.categories.find((category) => category.id === 9)?.slug, "dumpers-segunda-mano");
  assert.equal(catalog.categories.find((category) => category.id === 113)?.slug, "manipulador-teñescopico-segunda-mano");
  assert.equal(catalog.categories.find((category) => category.id === 114)?.slug, "plataforma-sobre-camion");
});
