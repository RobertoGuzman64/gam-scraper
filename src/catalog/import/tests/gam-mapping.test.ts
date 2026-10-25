import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../preparation/prepare.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { catalog, source, attrVal, categorySlug, gamUrl, gomUrl, merUrl } from "./mapping-fixtures.js";

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
    assert.ok(prepared.issues.includes("Tipo de máquina de origen sin confirmar"), vehicle.reference);
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
  assert.ok(prepareProduct(incompatible, catalog).issues.includes("Tipo de máquina de origen sin confirmar"));
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

test("GAM: conserva la dimensión publicada con unidad inequívoca y sin pérdida de ejes", () => {
  const url = gamUrl("plataformas-elevadoras-articuladas-electricas-segunda-mano", "6934");
  const valid = source("gam", url, "Plataforma articulada", { "Dimensiones Cesta": "2,4X1,17 metros" });
  assert.equal(attrVal(valid, "Dimensiones de la cesta"), "2,4 x 1,17 m");
  assert.deepEqual(valid.specs, { "Dimensiones Cesta": "2,4X1,17 metros" });
  assert.equal(prepareProduct(valid, catalog).product.attributes.find((entry) => entry.attributeID === 6)?.value, "2,4 x 1,17 m");
  assert.equal(attrVal(source("gam", url, "Plataforma", { "Dimensiones Cesta": "1.83 x 0.76 m" }), "Dimensiones de la cesta"), "1,83 x 0,76 m");
  for (const raw of ["4 81 88x1 metros", "1 83X0 91 metros", "2,4x1,17", "0x1,17 metros", "1400x700x1100 metros"]) {
    assert.equal(attrVal(source("gam", url, "Plataforma", { "Dimensiones Cesta": raw }), "Dimensiones de la cesta"), null, raw);
  }
  assert.equal(attrVal(source("gam", url, "Plataforma", { "Dimensiones Cesta": "2,4X1,17 metros", "Dimensiones de la cesta": "3 x 1 m" }), "Dimensiones de la cesta"), null);
  assert.equal(attrVal(source("gomariz", gomUrl("elevador-tijera", "test"), "Plataforma", { "Dimensiones Cesta": "2,4X1,17 metros" }), "Dimensiones de la cesta"), null);
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
