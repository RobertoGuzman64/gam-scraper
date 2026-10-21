import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareProduct } from "../prepare.js";
import { loadImportCatalog } from "../catalog-loader.js";
import { resolveAttributeValue } from "../attribute-mapping.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const source = (providerId: string, url: string, title: string, specs: ProductRecord["specs"], price: string | null = "12345"): ProductRecord => ({
  providerId, categoryKey: providerId === "gam" ? "manutencion" : "venta",
  categoryName: "Maquinaria de ocasión", url, title, shortDescription: "Ficha original", longDescription: "Ficha original",
  price, reference: "SAMPLE", brand: "LGMG", model: "S1413EII", year: "2018", location: null,
  country: null, horometer: null, serialNumber: null, image: "https://example.com/image.jpg", specs: specs ?? {}
});
const attr = (name: string) => {
  const result = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(result, name);
  return result;
};
const attrVal = (record: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(record, attr(name));
const categorySlug = (record: ProductRecord): string | undefined => {
  const prepared = prepareProduct(record, catalog);
  return catalog.categories.find((category) => category.id === prepared.product.categorySellID)?.slug;
};
const gamUrl = (family: string, id: string) => `https://online.gamrentals.com/es/${family}/${id}-jlg`;
const gomUrl = (family: string, id: string) => `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/${family}/${id}/`;
const merUrl = (id: string) => `https://sales.mercaeleva.com/es/for-sale/machine/${id}`;

test("GAM: resuelve categorías por subfamilias reales, incluyendo excepciones evidentes", () => {
  assert.equal(categorySlug(source("gam", gamUrl("carretillas-elevadoras-glp-segunda-mano", "6644"), "Carretilla elevadora GLP", {})), "carretillas-elevadoras-glp-segunda-mano");
  assert.equal(categorySlug(source("gam", gamUrl("carretillas-elevadoras-electricas-segunda-mano", "6584"), "Carretilla elevadora trilateral", {})), "carretillas-elevadoras-trilaterales-segunda-mano");
  assert.equal(categorySlug(source("gam", gamUrl("mini-cargadoras-segunda-mano", "6599"), "Miniexcavadora de cadenas JCB", {})), "miniexcavadoras-segunda-mano");
  assert.equal(categorySlug(source("gam", gamUrl("transpaletas-elevadoras-manuales-segunda-mano", "6123"), "Transpaleta eléctrica", {})), "transpaletas-electricas-segunda-mano");
  assert.equal(categorySlug(source("gam", gamUrl("vehiculos-segunda-mano", "6217"), "Land Rover", {})), undefined);
  assert.equal(categorySlug(source("gam", gamUrl("dumpers-segunda-mano", "6559"), "Dumper Crawler", {})), "dumpers-segunda-mano");
});

test("GAM: asigna manipuladores y furgonetas eléctricas a categorías existentes del catálogo", () => {
  for (const reference of ["6857", "6391", "6893", "6502"]) {
    const record = source("gam", gamUrl("manipuladores-frontales-segunda-mano", reference), "Manipulador telescópico", {});
    assert.equal(categorySlug(record), "manipulador-teñescopico-segunda-mano");
  }
  for (const reference of ["5918", "6806"]) {
    const record = source("gam", gamUrl("furgonetas-electricas-de-ocasion", reference), "Vehículo eléctrico de carga", {});
    assert.equal(categorySlug(record), "furgonetas-electricas-segunda-mano");
  }
  assert.equal(categorySlug(source("gam", gamUrl("resto-maquinaria-segunda-mano", "5710"), "Plataforma de ejes", {})), undefined);
});

test("Gomariz: utiliza tipo fuente y motor, sin adjudicar categorías inexistentes", () => {
  assert.equal(categorySlug(source("gomariz", gomUrl("elevador-tijera", "te1620"), "LGMG S1413EII", { Motor: "Eléctrico" }, null)), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug(source("gomariz", gomUrl("brazo-articulado", "ba1335"), "Skyjack SJ85AJ", { Motor: "Diésel" }, null)), "plataformas-articuladas-diesel-segunda-mano");
  assert.equal(categorySlug(source("gomariz", gomUrl("elevador-tijera", "indefinido"), "Tijera", { Motor: "Eléctrico, Gasolina" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/venta/manipulacion-de-materiales/manipulador-telescopico/jcb-540/", "JCB 540", { Motor: "Diésel" }, null)), "manipulador-teñescopico-segunda-mano");
  assert.equal(categorySlug(source("gomariz", gomUrl("elevador-mastil-vertical", "sla15"), "Genie SLA15", {}, null)), undefined);
});

test("Gomariz: la ficha identifica tijeras eléctricas aunque omita Motor, sin forzar tipos ambiguos", () => {
  const electricScissor = gomUrl("elevador-tijera", "lgmg-as0607we-tijera-electrica-electric-scissor-2");
  assert.equal(categorySlug(source("gomariz", electricScissor, "LGMG AS0607WE", {}, null)), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug(source("gomariz", electricScissor, "LGMG AS0607WE", { Motor: "Diésel" }, null)), undefined);
  assert.equal(categorySlug(source("gomariz", gomUrl("brazo-articulado", "jlg-340aj"), "JLG 340AJ", {}, null)), undefined);
  assert.equal(categorySlug(source("gomariz", "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/dynapac-cc142-2/", "Dynapac CC142", { Motor: "Diésel" }, null)), undefined);
});

test("Mercaeleva: distingue las familias por el título adicional original sin usar IDs supuestos", () => {
  assert.equal(categorySlug(source("mercaeleva", merUrl("Toyota-6FBRE14-M547-2372"), "Toyota 6FBRE14", { "Título adicional": "CARRETILLA ELEVADORA RETRACTIL 1350 KG" })), "carretillas-elevadoras-retractiles-segunda-mano");
  assert.equal(categorySlug(source("mercaeleva", merUrl("Hollandlift-M140-0406"), "Hollandlift HL-220", { "Título adicional": "PLATAFORMA TIJERA ELECTRICA 22 MT" })), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug(source("mercaeleva", merUrl("BT-M239-6301"), "BT LPE200/8", { "Título adicional": "TRANSPALET ELECTRICO" })), "transpaletas-electricas-segunda-mano");
  assert.equal(categorySlug(source("mercaeleva", merUrl("unknown"), "Máquina", { "Título adicional": "PLATAFORMA ARTICULADA" })), undefined);
});

test("asocia atributos requeridos y convierte unidades explícitas sin confundir alturas", () => {
  const gam = source("gam", gamUrl("carretillas-elevadoras-glp-segunda-mano", "6644"), "Carretilla GLP", {
    "Capacidad de carga (kg)": "3500 KG", "Altura de elevación (mm)": "4900 mm", "Tipo Mástil": "TRIPLEX", "Peso": "3220 KG"
  });
  assert.equal(attrVal(gam, "Capacidad de carga"), 3500);
  assert.equal(attrVal(gam, "Altura de elevación"), 4900);
  assert.equal(attrVal(gam, "Tipo de mástil"), "TRIPLEX");
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
  assert.equal(prepared.status, "review");
  assert.ok(prepared.issues.includes("Precio no disponible o inválido"));
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

test("Mercaeleva: utiliza alturas máximas y cargas máximas explícitas solo en carretillas", () => {
  const merca = source("mercaeleva", merUrl("Nissan-Q02L20CU-M121-6486"), "Nissan Q02L20CU CARRETILLA ELEVADORA ELECTRICA", {
    "Altura máxima de elevación": "6000 mm", "Capacidad máxima de elevación": "2000 kg",
    "Tipo de mástil": "Triple", "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 2000 KG"
  });
  assert.equal(attrVal(merca, "Altura de elevación"), 6000);
  assert.equal(attrVal(merca, "Capacidad de carga"), 2000);
  const prepared = prepareProduct(merca, catalog);
  const contradictorySource = source("mercaeleva", merUrl("UniCarriers-M582-1882"),
    "UniCarriers E2D2A30 CARRETILLA ELEVADORA DIESEL 3000 KG", {
      "Título adicional": "CARRETILLA ELEVADORA DIESEL 3000 KG", "Capacidad máxima de elevación": "2500 kg"
    });
  assert.equal(attrVal(contradictorySource, "Capacidad de carga"), null);
  assert.ok(prepareProduct(contradictorySource, catalog).issues.includes("Atributo obligatorio ausente: Capacidad de carga"));
  assert.ok(!prepared.issues.includes("Atributo obligatorio ausente: Altura de elevación"));
  assert.ok(!prepared.issues.includes("Atributo obligatorio ausente: Capacidad de carga"));
  const conflict = source("mercaeleva", merca.url, merca.title ?? "", {
    "Altura de elevación": "4500 mm", "Altura máxima de elevación": "6000 mm",
    "Capacidad de carga": "1500 kg", "Capacidad máxima de elevación": "2000 kg"
  });
  assert.equal(attrVal(conflict, "Altura de elevación"), null);
  assert.equal(attrVal(conflict, "Capacidad de carga"), null);
  assert.equal(attrVal(source("gam", gamUrl("carretillas-elevadoras-electricas-segunda-mano", "6500"), "Carretilla", {
    "Altura máxima de elevación": "6000 mm", "Capacidad máxima de elevación": "2000 kg"
  }), "Altura de elevación"), null);
  assert.equal(attrVal(source("mercaeleva", merUrl("JLG-M123-4567"), "JLG PLATAFORMA TIJERA", {
    "Altura máxima de elevación": "6000 mm"
  }), "Altura de elevación"), null);
});

test("Mercaeleva: categorías expresas solo cuando coincide una familia existente", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["Ausa D450AHG DUMPER GIRATORIO 4500 KG", "dumpers-segunda-mano"],
    ["Kubota U10.3 MINIEXCAVADORA ORUGA", "miniexcavadoras-segunda-mano"],
    ["Oil & Steel SCORPION CAMION CESTA TELESCOPICO", "plataformas-elevadoras-sobre-camion-segunda-mano"],
    ["Manitou MT1440 MANIPULADOR TELESCOPICO", "manipulador-teñescopico-segunda-mano"],
    ["BT SWE160 APILADOR ELECTRICO", "apiladores-electricos-segunda-mano"]
  ];
  for (const [title, expected] of cases) {
    const record = source("mercaeleva", merUrl("machine-M888-8888"), title, { "Título adicional": title });
    assert.equal(categorySlug(record), expected, title);
  }
  assert.equal(categorySlug(source("mercaeleva", merUrl("MB-M373-1421"), "MB RSL161 APILADOR DE ELEVACION INICIAL", {
    "Título adicional": "Apilador de Elevación Inicial con mástil tríplex de 1.600kg", "Tipo de Batería": "Li-ion"
  })), "apiladores-electricos-segunda-mano");
  assert.equal(categorySlug(source("mercaeleva", merUrl("Iveco-M928-9933"), "Camión porta-vehículos", {})), undefined);
  assert.equal(categorySlug(source("mercaeleva", merUrl("Container-M294-4678"), "MODULO CASETA DIAFANA", {})), undefined);
  assert.equal(categorySlug(source("mercaeleva", merUrl("Apilador-M111-1111"), "APILADOR", {})), undefined);
  assert.equal(categorySlug(source("mercaeleva", merUrl("Apilador-M111-1112"), "APILADOR MANUAL", {
    "Título adicional": "APILADOR MANUAL", "Tipo de Batería": "Li-ion"
  })), undefined);
});
