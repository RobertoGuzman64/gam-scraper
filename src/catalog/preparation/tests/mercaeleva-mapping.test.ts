import assert from "node:assert/strict";
import test from "node:test";
import { prepareProduct } from "../prepare.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { catalog, source, attrVal, categorySlug, gamUrl, gomUrl, merUrl } from "./mapping-fixtures.js";

test("Mercaeleva: distingue las familias por el título adicional original sin usar IDs supuestos", () => {
  assert.equal(categorySlug(source("mercaeleva", merUrl("Toyota-6FBRE14-M547-2372"), "Toyota 6FBRE14", { "Título adicional": "CARRETILLA ELEVADORA RETRACTIL 1350 KG" })), "carretillas-elevadoras-retractiles-segunda-mano");
  assert.equal(categorySlug(source("mercaeleva", merUrl("Hollandlift-M140-0406"), "Hollandlift HL-220", { "Título adicional": "PLATAFORMA TIJERA ELECTRICA 22 MT" })), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(categorySlug(source("mercaeleva", merUrl("BT-M239-6301"), "BT LPE200/8", { "Título adicional": "TRANSPALET ELECTRICO" })), "transpaletas-electricas-segunda-mano");
  assert.equal(categorySlug(source("mercaeleva", merUrl("unknown"), "Máquina", { "Título adicional": "PLATAFORMA ARTICULADA" })), undefined);
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
  assert.ok(prepareProduct(contradictorySource, catalog).issues.some((issue) => issue.includes("Capacidad de carga")));
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
