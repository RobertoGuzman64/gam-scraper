import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { prepareProduct } from "../preparation/prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const source = (providerId: string, url: string, title: string, specs: ProductRecord["specs"], price: string | null = "12345"): ProductRecord => ({
  providerId, categoryKey: providerId === "gam" ? "manutencion" : "venta",
  categoryName: "Maquinaria de ocasión", url, title, shortDescription: "Ficha original", longDescription: "Ficha original",
  price, reference: "SAMPLE", brand: "LGMG", model: "S1413EII", year: "2018", location: null,
  country: null, horometer: null, serialNumber: null, condition: "Segunda mano", image: "https://example.com/image.jpg", specs: specs ?? {}
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
  const electricVan = source("gam", gamUrl("furgonetas-electricas-de-ocasion", "furgoneta"), "Furgoneta eléctrica de reparto", {});
  assert.equal(categorySlug(electricVan), "furgonetas-electricas-segunda-mano");
  assert.equal(categorySlug(source("gam", gamUrl("resto-maquinaria-segunda-mano", "5710"), "Plataforma de ejes", {})), undefined);
});

test("GAM: los cuatriciclos no se clasifican como furgonetas eléctricas", () => {
  const vehicles = [
    { reference: "5918", title: "Paxster Gen 2.2", description: "El Paxster Gen 2.2 es un cuatriciclo eléctrico diseñado para el reparto urbano." },
    { reference: "6806", title: "Musoshi PoP Up Mini", description: "La Musoshi PoP Up Mini es un cuatriciclo eléctrico compacto y ligero." }
  ];
  for (const vehicle of vehicles) {
    const record: ProductRecord = {
      ...source("gam", gamUrl("furgonetas-electricas-de-ocasion", vehicle.reference), vehicle.title, {}),
      reference: vehicle.reference,
      shortDescription: vehicle.description,
      condition: "Segunda mano"
    };
    assert.equal(categorySlug(record), undefined, vehicle.reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.product.categorySellID, null, vehicle.reference);
    assert.equal(prepared.status, "review", vehicle.reference);
    assert.ok(prepared.issues.includes("Categoría Equipzilla sin correspondencia inequívoca"), vehicle.reference);
    const direct = { ...record, categoryKey: "furgonetas-electricas-segunda-mano" };
    assert.equal(categorySlug(direct), undefined, vehicle.reference);
  }
});

test("GAM: un título eléctrico incompatible con la sección diésel requiere revisión", () => {
  const incompatible: ProductRecord = {
    ...source("gam", gamUrl("carretillas-elevadoras-diesel-segunda-mano", "6587"), "Carretilla elevadora eléctrica 5000Kg BT C4E500V", {}),
    reference: "6587",
    condition: "Segunda mano"
  };
  assert.equal(categorySlug(incompatible), undefined);
  assert.equal(prepareProduct(incompatible, catalog).product.categorySellID, null);
  assert.ok(prepareProduct(incompatible, catalog).issues.includes("Categoría Equipzilla sin correspondencia inequívoca"));
  assert.equal(categorySlug({ ...incompatible, categoryKey: "carretillas-elevadoras-diesel-segunda-mano" }), undefined);
  assert.equal(categorySlug(source("gam", gamUrl("carretillas-elevadoras-diesel-segunda-mano", "6024"), "Carretilla frontal diésel 2000Kg", {})), "carretillas-elevadoras-diesel-segunda-mano");
  assert.equal(categorySlug(source("gam", gamUrl("carretillas-elevadoras-electricas-segunda-mano", "6941"), "Carretilla elevadora eléctrica triciclo", {})), "carretillas-elevadoras-electricas-segunda-mano");
  assert.equal(categorySlug(source("gam", gamUrl("carretillas-elevadoras-electricas-segunda-mano", "incompatible"), "Carretilla elevadora diésel 2000Kg", {})), undefined);
  assert.equal(categorySlug(source("mercaeleva", merUrl("M100-1000"), "Carretilla elevadora diésel", { "Título adicional": "Carretilla elevadora diésel" })), "carretillas-elevadoras-diesel-segunda-mano");
});

test("GAM: recupera capacidades y alturas de los cuatro manipuladores telescópicos sin alterar unidades", () => {
  const machines = [
    { reference: "6857", slug: "6857-2006-jlg-3512", title: "Manipulador telescópico 11M 3500Kg JLG 3512", capacity: "3500 KG", height: "11,5 metros", expectedCapacity: 3500, expectedHeight: 11.5 },
    { reference: "6391", slug: "6391-2006-jlg-4013", title: "Manipulador telescópico 13M 4000Kg JLG 4013", capacity: "4000 KG", height: "13 metros", expectedCapacity: 4000, expectedHeight: 13 },
    { reference: "6893", slug: "6893-2018-haulotte-htl-4014", title: "Manipulador telescópico 14M 4000Kg HAULOTTE HTL 4014", capacity: "4000 KG", height: "14 metros", expectedCapacity: 4000, expectedHeight: 14 },
    { reference: "6502", slug: "6502-2022-magni-th-5515", title: "Manipulador telescópico 15M 5500Kg MAGNI TH 5.5.15", capacity: "5500 KG", height: "15 metros", expectedCapacity: 5500, expectedHeight: 15 }
  ] as const;
  for (const machine of machines) {
    const record: ProductRecord = {
      ...source("gam", `https://online.gamrentals.com/es/manipuladores-frontales-segunda-mano/${machine.slug}`, machine.title, {
        "Capacidad de carga (kg)": machine.capacity,
        "Altura de elevación (m)": machine.height
      }),
      reference: machine.reference,
      condition: "Segunda mano",
      shortDescription: "Ficha individual del manipulador telescópico",
      longDescription: "Características técnicas y descripción de la máquina de segunda mano"
    };
    assert.equal(attrVal(record, "Capacidad máxima"), machine.expectedCapacity, machine.reference);
    assert.equal(attrVal(record, "Altura máxima de elevación"), machine.expectedHeight, machine.reference);
    const prepared = prepareProduct(record, catalog);
    assert.equal(prepared.product.categorySellID, 113, machine.reference);
    assert.ok(prepared.product.attributes.some((item) => item.attributeID === 38 && item.value === machine.expectedCapacity), machine.reference);
    assert.ok(prepared.product.attributes.some((item) => item.attributeID === 39 && item.value === machine.expectedHeight), machine.reference);
    assert.ok(!prepared.issues.some((issue) => issue.startsWith("Atributo obligatorio ausente:")), machine.reference);
    assert.equal(prepared.status, "ready", machine.reference);
  }
});

test("GAM: las equivalencias técnicas del manipulador no se extienden a otros proveedores ni familias", () => {
  const specs = { "Capacidad de carga (kg)": "3500 KG", "Altura de elevación (m)": "11,5 metros" };
  for (const record of [
    source("gam", gamUrl("carretillas-elevadoras-diesel-segunda-mano", "6857"), "Carretilla", specs),
    source("gomariz", gomUrl("elevador-tijera", "te1620"), "Tijera", specs),
    source("mercaeleva", merUrl("JLG-M100-1000"), "Manipulador", specs),
    source("gam", "https://example.com/es/manipuladores-frontales-segunda-mano/6857", "Manipulador", specs)
  ]) {
    assert.equal(attrVal(record, "Capacidad máxima"), null, record.url);
    assert.equal(attrVal(record, "Altura máxima de elevación"), null, record.url);
  }
});

test("GAM: los valores conflictivos, ambiguos o con unidades incompatibles siguen en revisión", () => {
  const url = gamUrl("manipuladores-frontales-segunda-mano", "6857");
  const conflict = source("gam", url, "Manipulador", {
    "Capacidad máxima": "3000 kg", "Capacidad de carga (kg)": "3500 KG",
    "Altura máxima de elevación": "12 metros", "Altura de elevación (m)": "11,5 metros"
  });
  assert.equal(attrVal(conflict, "Capacidad máxima"), null);
  assert.equal(attrVal(conflict, "Altura máxima de elevación"), null);
  const invalid = source("gam", url, "Manipulador", {
    "Capacidad de carga (kg)": "3000 - 3500 KG", "Altura de elevación (m)": "11500 kg"
  });
  assert.equal(attrVal(invalid, "Capacidad máxima"), null);
  assert.equal(attrVal(invalid, "Altura máxima de elevación"), null);
  const matching = source("gam", url, "Manipulador", {
    "Capacidad máxima": "3500 kg", "Capacidad de carga (kg)": "3500 KG",
    "Altura máxima de elevación": "11,5 m", "Altura de elevación (m)": "11,5 metros"
  });
  assert.equal(attrVal(matching, "Capacidad máxima"), 3500);
  assert.equal(attrVal(matching, "Altura máxima de elevación"), 11.5);
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
  assert.equal(attrVal(gam, "Tipo de mástil"), "Tríplex");
  assert.equal(attrVal(gam, "Peso operativo"), 3220);
  assert.equal(attrVal(source("gam", gam.url, gam.title ?? "", { "Altura de elevación (m)": "4.9 metros" }), "Altura de elevación"), 4900);
  assert.equal(attrVal(source("gam", gam.url, "Plataforma", { "Altura de elevación (m)": "8 metros" }), "Altura de trabajo"), null);
  assert.equal(attrVal(source("gam", gam.url, "Carretilla", { "Altura mástil replegado": "2150 mm" }), "Tipo de mástil"), null);
  assert.equal(attrVal(source("gam", gam.url, "Plataforma", { "Altura de trabajo (mm)": "8000 mm" }), "Altura de trabajo"), 8);
  assert.equal(attrVal(source("gam", gam.url, "Carretilla", { "Capacidad de carga (kg)": "1.350 kg" }), "Capacidad de carga"), 1350);
  assert.equal(attrVal(source("gam", gam.url, "Carretilla", { "Capacidad de carga (kg)": "1200 - 1400 kg" }), "Capacidad de carga"), null);
});

test("GAM: incorpora pendientes publicadas con porcentaje sin confundir unidades", () => {
  const url = gamUrl("plataformas-elevadoras-articuladas-electricas-segunda-mano", "6934");
  for (const [raw, expected] of [["25%", 25], ["40 %", 40], ["45", 45], ["23,5 %", 23.5]] as const) {
    assert.equal(attrVal(source("gam", url, "Plataforma articulada", { "Pendiente superable": raw }), "Pendiente superable"), expected);
  }
  assert.equal(attrVal(source("gam", url, "Plataforma articulada", { "Pendiente superable (%)": "25%" }), "Pendiente superable"), 25);
  assert.equal(attrVal(source("gam", url, "Plataforma articulada", { "Pendiente superable": "25%", "Pendiente superable (%)": "40%" }), "Pendiente superable"), null);
  for (const raw of ["20 grados", "25-40%", "no disponible", "40 kg", "25%%"]) {
    assert.equal(attrVal(source("gam", url, "Plataforma articulada", { "Pendiente superable": raw }), "Pendiente superable"), null, raw);
  }
  assert.equal(attrVal(source("gam", url, "Plataforma articulada", { "Capacidad de carga (kg)": "25%" }), "Capacidad de carga"), null);
});

test("GAM: recupera exclusivamente dimensiones de cesta expresadas como dos medidas en metros", () => {
  const url = gamUrl("plataformas-elevadoras-articuladas-electricas-segunda-mano", "6934");
  const valid = source("gam", url, "Plataforma articulada", { "Dimensiones Cesta": "2,4X1,17 metros" });
  assert.equal(attrVal(valid, "Dimensiones de la cesta"), "2,4 x 1,17 m");
  assert.deepEqual(valid.specs, { "Dimensiones Cesta": "2,4X1,17 metros" });
  assert.equal(prepareProduct(valid, catalog).product.attributes.find((entry) => entry.attributeID === 6)?.value, "2,4 x 1,17 m");
  assert.equal(attrVal(source("gam", url, "Plataforma", { "Dimensiones Cesta": "1.83 x 0.76 m" }), "Dimensiones de la cesta"), "1,83 x 0,76 m");
  for (const raw of ["4 81 88x1 metros", "1 83X0 91 metros", "1,4 x 0,7 x 1,1 m", "2,4x1,17", "0x1,17 metros", "1400x700 mm"]) {
    assert.equal(attrVal(source("gam", url, "Plataforma", { "Dimensiones Cesta": raw }), "Dimensiones de la cesta"), null, raw);
  }
  assert.equal(attrVal(source("gam", url, "Plataforma", { "Dimensiones Cesta": "2,4X1,17 metros", "Dimensiones de la cesta": "3 x 1 m" }), "Dimensiones de la cesta"), null);
  assert.equal(attrVal(source("gomariz", gomUrl("elevador-tijera", "test"), "Plataforma", { "Dimensiones Cesta": "2,4X1,17 metros" }), "Dimensiones de la cesta"), null);
});

test("Gomariz: mapea alcance lateral positivo a alcance horizontal sin reutilizar ceros", () => {
  const platform = gomUrl("brazo-articulado", "jlg-450aj");
  assert.equal(attrVal(source("gomariz", platform, "Brazo articulado", { "Alcance lateral": "7.47 m" }), "Alcance horizontal"), 7.47);
  assert.equal(attrVal(source("gomariz", gomUrl("manipulador-telescopico", "jcb-540-140"), "Manipulador", { "Alcance lateral": "9.25 M" }), "Alcance máximo horizontal"), 9.25);
  for (const raw of ["0 m", "-5 m", "10 ft", "8 a 12 m", "2.500 m"]) {
    assert.equal(attrVal(source("gomariz", platform, "Brazo articulado", { "Alcance lateral": raw }), "Alcance horizontal"), null, raw);
  }
  assert.equal(attrVal(source("gomariz", platform, "Brazo articulado", { "Alcance lateral": "8 m", "Alcance horizontal": "9 m" }), "Alcance horizontal"), null);
  assert.equal(attrVal(source("gam", gamUrl("plataformas-elevadoras-articuladas-electricas-segunda-mano", "6934"), "Plataforma", { "Alcance lateral": "8 m" }), "Alcance horizontal"), null);
});

test("Mercaeleva: convierte longitud de tenedor al atributo real de horquillas", () => {
  const record = source("mercaeleva", merUrl("MB-M288-9739"), "MB ESL122 APILADOR ELECTRICO", {
    "Título adicional": "APILADOR ELECTRICO", "Longitud de tenedor": "1150 mm"
  });
  assert.equal(attrVal(record, "Longitud de horquillas"), 1150);
  assert.equal(prepareProduct(record, catalog).product.attributes.find((entry) => entry.attributeID === 32)?.value, 1150);
  assert.equal(attrVal(source("mercaeleva", merUrl("MB-M402-2703"), "MB EFL253 CARRETILLA ELEVADORA ELECTRICA", {
    "Título adicional": "CARRETILLA ELEVADORA ELECTRICA", "Longitud de tenedor": "1220 mm"
  }), "Longitud de horquillas"), 1220);
  assert.equal(attrVal(source("mercaeleva", record.url, record.title ?? "", { "Longitud de tenedor": "1150 mm", "Longitud de horquillas": "1200 mm" }), "Longitud de horquillas"), null);
  assert.equal(attrVal(source("mercaeleva", record.url, record.title ?? "", { "Longitud de tenedor": "1150 kg" }), "Longitud de horquillas"), null);
  assert.equal(attrVal(source("gam", gamUrl("carretillas-elevadoras-electricas-segunda-mano", "1"), "Carretilla", { "Longitud de tenedor": "1150 mm" }), "Longitud de horquillas"), null);
});

test("las fuentes secundarias no inventan precios y aprovechan capacidad declarada", () => {
  const gom = source("gomariz", "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-industrial/heli-cpd35/", "HELI CPD 35", { Motor: "Eléctrico", Capacidad: "3500 kg", "Altura de trabajo": "4.8 m" }, null);
  const prepared = prepareProduct(gom, catalog);
  assert.equal(categorySlug(gom), "carretillas-elevadoras-electricas-segunda-mano");
  assert.equal(attrVal(gom, "Capacidad de carga"), 3500);
  assert.equal(attrVal(gom, "Altura de elevación"), null);
  assert.equal(prepared.status, "review");
  assert.equal(prepared.product.price, null);
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

test("Mercaeleva: aprovecha capacidades explícitas de manipuladores sin aplicar equivalencias a otras familias", () => {
  for (const reference of ["M200-9533", "M005-5167"]) {
    const record = source("mercaeleva", merUrl(reference), "MANIPULADOR TELESCOPICO 14 MT", {
      "Título adicional": "MANIPULADOR TELESCOPICO 14 MT",
      "Capacidad máxima de elevación": "4000 kg",
      "Altura máxima de elevación": "14 m"
    });
    assert.equal(attrVal(record, "Capacidad máxima"), 4000, reference);
    assert.equal(attrVal(record, "Altura máxima de elevación"), 14, reference);
  }
  const other = source("mercaeleva", merUrl("M111-1111"), "PLATAFORMA TIJERA ELECTRICA", {
    "Título adicional": "PLATAFORMA TIJERA ELECTRICA",
    "Capacidad máxima de elevación": "4000 kg"
  });
  assert.equal(attrVal(other, "Capacidad máxima"), null);
  assert.equal(attrVal(source("mercaeleva", merUrl("M111-1112"), "MANIPULADOR TELESCOPICO", {
    "Título adicional": "MANIPULADOR TELESCOPICO",
    "Capacidad máxima de elevación": "14 m"
  }), "Capacidad máxima"), null);
  assert.equal(attrVal(source("mercaeleva", merUrl("M111-1113"), "MANIPULADOR TELESCOPICO", {
    "Título adicional": "MANIPULADOR TELESCOPICO",
    "Capacidad máxima": "3500 kg", "Capacidad máxima de elevación": "4000 kg"
  }), "Capacidad máxima"), null);
});

test("Mercaeleva: convierte solo alturas y cargas expresas de apiladores", () => {
  const machines = [
    ["M288-9739", "1200 kg", "3600 mm", 1200, 3600],
    ["M373-1421", "1600 kg", "4800 mm", 1600, 4800],
    ["M346-8712", "1600 kg", "4800 mm", 1600, 4800]
  ] as const;
  for (const [reference, load, height, expectedLoad, expectedHeight] of machines) {
    const record = source("mercaeleva", merUrl(reference), `Apilador Eléctrico ${load}`, {
      "Título adicional": `APILADOR ELECTRICO ${load}`,
      "Capacidad máxima de elevación": load,
      "Altura máxima de elevación": height
    });
    assert.equal(attrVal(record, "Capacidad de carga"), expectedLoad, reference);
    assert.equal(attrVal(record, "Altura de elevación"), expectedHeight, reference);
  }
  const used = source("mercaeleva", merUrl("M958-0132"), "BT SWE160 APILADOR ELECTRICO 1600 KG", {
    "Título adicional": "APILADOR ELECTRICO 1600 KG"
  });
  assert.equal(attrVal(used, "Capacidad de carga"), 1600);
  assert.equal(attrVal(used, "Altura de elevación"), null);
  const conflict = source("mercaeleva", merUrl("M999-1111"), "APILADOR ELECTRICO 1600 KG", {
    "Título adicional": "APILADOR ELECTRICO 1600 KG",
    "Capacidad máxima de elevación": "1200 kg"
  });
  assert.equal(attrVal(conflict, "Capacidad de carga"), null);
  assert.equal(attrVal(source("mercaeleva", merUrl("M999-1112"), "APILADOR ELECTRICO", {
    "Título adicional": "APILADOR ELECTRICO",
    "Altura máxima de elevación": "1600 kg"
  }), "Altura de elevación"), null);
});

test("Mercaeleva: transpaletas usan capacidad declarada y mantienen las contradicciones en revisión", () => {
  for (const [reference, capacity] of [
    ["M035-8084", "1500"], ["M168-3277", "2000"], ["M141-6536", "1500"]
  ] as const) {
    const record = source("mercaeleva", merUrl(reference), `TRANSPALET ELECTRICO ${capacity} kg`, {
      "Título adicional": `TRANSPALET ELECTRICO ${capacity} kg`, "Capacidad máxima de elevación": `${capacity} kg`
    });
    assert.equal(attrVal(record, "Capacidad de carga"), Number(capacity), reference);
  }
  const conflicting = source("mercaeleva", merUrl("M119-9334"), "TRANSPALET ELECTRICO 1800 kg", {
    "Título adicional": "TRANSPALET ELECTRICO 1800 kg", "Capacidad máxima de elevación": "1500 kg"
  });
  assert.equal(attrVal(conflicting, "Capacidad de carga"), null);
  const absent = source("mercaeleva", merUrl("M239-6301"), "BT LPE200/8 TRANSPALET ELECTRICO", {
    "Título adicional": "TRANSPALET ELECTRICO"
  });
  assert.equal(attrVal(absent, "Capacidad de carga"), null);
  assert.equal(attrVal(absent, "Altura de elevación"), null);
  assert.equal(attrVal(source("mercaeleva", merUrl("M913-0641"), "MINIEXCAVADORA ORUGA 2700 KG", {
    "Título adicional": "MINIEXCAVADORA ORUGA 2700 KG"
  }), "Peso operativo"), null);
});

test("Mercaeleva: descarta tipo de mástil contradictorio en ficha individual", () => {
  const carretilla = source("mercaeleva", merUrl("M827-8304"), "LINDE E48P CARRETILLA ELEVADORA", {
    "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 4800 KG",
    "Tipo de mástil": "Triple"
  });
  assert.equal(attrVal({ ...carretilla, longDescription: "Ref. MER0798 MASTIL DUPLEX LINDE E48P" }, "Tipo de mástil"), null);
  assert.equal(attrVal({ ...carretilla, longDescription: "Ref. MER0798 MASTIL TRIPLEX LINDE E48P" }, "Tipo de mástil"), "Tríplex");
  assert.equal(attrVal(carretilla, "Tipo de mástil"), "Tríplex");
  const noInference = source("mercaeleva", merUrl("M488-5646"), "TOYOTA 02-8FDF25 CARRETILLA", {
    "Título adicional": "CARRETILLA ELEVADORA DIESEL 2500 KG",
    "Tipo de mástil": "Triple"
  });
  assert.equal(attrVal({ ...noInference, longDescription: "Ref. MER0655 Tríplex 4700 mm" }, "Altura de elevación"), null);
});

test("Mercaeleva: admite dúplex/estándar sin perder el tipo de mástil válido", () => {
  const record = source("mercaeleva", merUrl("M701-5459"), "CARRETILLA ELEVADORA ELECTRICA", {
    "Título adicional": "CARRETILLA ELEVADORA ELECTRICA 1600 KG",
    "Tipo de mástil": "Dúplex/estándar"
  });
  assert.equal(attrVal({ ...record, longDescription: "Ref. 100 MASTIL DUPLEX" }, "Tipo de mástil"), "Dúplex");
  assert.equal(attrVal({ ...record, longDescription: "Ref. 100 MASTIL TRIPLEX" }, "Tipo de mástil"), null);
  assert.equal(attrVal({ ...record, specs: { ...record.specs, "Tipo de mástil": "Dúplex/Tríplex" }, longDescription: "Ref. 100 MASTIL DUPLEX" }, "Tipo de mástil"), null);
});

test("GAM: recupera la altura de trabajo explícita en descripciones, sin equipararla a elevación", () => {
  const examples = [
    { reference: "6910", family: "plataformas-elevadoras-tijera-electricas-segunda-mano", title: "Plataforma tijera eléctrica 12M JLG 10RS", description: "Gracias a su altura de trabajo de 12 metros, esta plataforma es perfecta para trabajos que requieran un acceso considerable a altura.", expected: 12 },
    { reference: "4731", family: "plataformas-de-tijera-electricas-xcmg", title: "Plataforma elevadora de tijera eléctrica 6M XCMG XG0607DC", description: "Esta máquina elevadora de tijera permite alcanzar una altura máxima de trabajo de 5,9 metros, soportando una capacidad de carga de 240 kg.", expected: 5.9 },
    { reference: "6542", family: "plataforma-articulada-diesel-xcmg", title: "Plataforma articulada diésel 43M XCMG XGA43K", description: "Con 43,2 m de altura de trabajo y 21,6 m de alcance horizontal, es una solución ideal para mantenimiento industrial.", expected: 43.2 }
  ] as const;
  for (const example of examples) {
    const record: ProductRecord = {
      ...source("gam", gamUrl(example.family, example.reference), example.title, { "Altura de elevación (m)": "10 metros" }),
      reference: example.reference,
      longDescription: example.description,
      shortDescription: null
    };
    assert.equal(attrVal(record, "Altura de trabajo"), example.expected, example.reference);
    assert.equal(attrVal({ ...record, longDescription: "Solo se publica la altura de elevación de 10 metros." }, "Altura de trabajo"), null);
  }
});

test("GAM: no deduce alturas ambiguas, contradictorias ni sustituye la especificación explícita", () => {
  const base: ProductRecord = {
    ...source("gam", gamUrl("plataformas-elevadoras-tijera-electricas-segunda-mano", "6910"), "Plataforma tijera eléctrica 12M JLG 10RS", {}),
    reference: "6910",
    shortDescription: null
  };
  assert.equal(attrVal({ ...base, longDescription: "Las plataformas tienen alturas de trabajo de entre 6 y 20 metros." }, "Altura de trabajo"), null);
  assert.equal(attrVal({ ...base, longDescription: "Altura de trabajo de 12 metros y altura de trabajo de 14 metros." }, "Altura de trabajo"), null);
  assert.equal(attrVal({ ...base, longDescription: "Altura de trabajo de 12 metros. Altura de trabajo: 12 m." }, "Altura de trabajo"), 12);
  assert.equal(attrVal({ ...base, longDescription: "Altura de trabajo de 12 metros.", specs: { "Altura de trabajo": "14 metros" } }, "Altura de trabajo"), 14);
  assert.equal(attrVal({ ...base, longDescription: "Altura de trabajo de 12 metros.", url: "https://example.com/es/elevadoras/6910" }, "Altura de trabajo"), null);
  assert.equal(attrVal({ ...base, longDescription: "Altura de trabajo de 12 metros.", providerId: "gomariz" }, "Altura de trabajo"), null);
});
