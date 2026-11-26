import assert from "node:assert/strict";

import test from "node:test";

import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";

import { resolveAttribute, resolveAttributeValue } from "../../../preparation/classification/attribute-mapping.js";

import { productAttributes } from "../../../preparation/product/product-attributes.js";

import { prepareProduct } from "../../../commercial/legacy-export/prepare-product.js";

import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";
import { reviewedModelAttributeSpecs } from "../../../preparation/technical/evidence/documented-technical-evidence.js";
import { recoveredUnitAttributeSpecs } from "../../../preparation/provenance/technical-provenance.js";
import type { ProductTechnicalProvenance } from "../../../contracts/technical-provenance.js";

import { gamSourceYear } from "../../../catalog/normalization/gam/year.js";

const catalog = await loadImportCatalog();

const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};

const gamRecord = (specs: SpecsMap = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion", categoryName: "Elevación",
  url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5845-2015-jlg-10rs",
  reference: "5845", title: "Plataforma tijera eléctrica JLG 10RS",
  shortDescription: "Ficha técnica JLG 10RS", longDescription: "Información técnica JLG 10RS",
  price: null, brand: "JLG", model: "10RS", year: null, location: null, country: null,
  horometer: null, serialNumber: null, condition: "Segunda mano", image: null, specs
});

const mercaelevaRecord = (specs: SpecsMap, longDescription: string): ProductRecord => ({
  providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/M827-8304",
  reference: "M827-8304", title: "Carretilla elevadora de ocasión",
  shortDescription: "Carretilla elevadora", longDescription, price: null,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, condition: "Segunda mano", image: null, specs
});

test("atributos: distingue dato no observado de valor válido", () => {
  const target = attribute("Altura de trabajo");
  assert.deepEqual(resolveAttribute(gamRecord(), target), { status: "not_observed", value: null });
  assert.deepEqual(resolveAttribute(gamRecord({ "Altura de trabajo (m)": "12 m" }), target), { status: "resolved", value: 12 });
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (m)": "12 m" }), target), 12);
});

test("atributos: distingue formato incompatible de medidas contradictorias", () => {
  const target = attribute("Altura de trabajo");
  const invalid = gamRecord({ "Altura de trabajo (mm)": "12 m" });
  const contradictory = gamRecord({ "Altura de trabajo (m)": "12 m", "Altura de trabajo (mm)": "13000 mm" });
  assert.deepEqual(resolveAttribute(invalid, target), { status: "invalid", value: null });
  assert.deepEqual(resolveAttribute(contradictory, target), { status: "contradiction", value: null });
  assert.equal(resolveAttributeValue(invalid, target), null);
  assert.equal(resolveAttributeValue(contradictory, target), null);
});

test("atributos: las lecturas múltiples sin candidato inequívoco se rechazan, no se presentan como ausencias", () => {
  const record = gamRecord({ "Altura de trabajo (m)": ["12 m", "13 m"] });
  assert.deepEqual(resolveAttribute(record, attribute("Altura de trabajo")), { status: "rejected", value: null });
  assert.equal(resolveAttributeValue(record, attribute("Altura de trabajo")), null);
});

test("GAM: protege la identidad de modelo sin confundirla con la falta de dato", () => {
  const record = {
    ...gamRecord({ "Altura de trabajo (m)": "12 m" }), model: "JLG10RS",
    title: "Plataforma elevadora JLG12RS", shortDescription: "Equipo JLG12RS"
  };
  assert.deepEqual(resolveAttribute(record, attribute("Altura de trabajo")), { status: "rejected", value: null });
  assert.equal(resolveAttributeValue(record, attribute("Altura de trabajo")), null);
});

test("Mercaeleva: la contradicción entre mástil declarado y descrito sigue vetando el valor", () => {
  const record = mercaelevaRecord({ "Tipo de mástil": "Triple" }, "Carretilla con mástil dúplex instalado");
  assert.deepEqual(resolveAttribute(record, attribute("Tipo de mástil")), { status: "contradiction", value: null });
  assert.equal(resolveAttributeValue(record, attribute("Tipo de mástil")), null);
});

test("Mercaeleva: la capacidad publicada como alternativas sigue siendo no asignable", () => {
  const record = mercaelevaRecord({}, "Capacidad de carga: 2.500 kg / 3.000 kg según configuración");
  assert.deepEqual(resolveAttribute(record, attribute("Capacidad de carga")), { status: "rejected", value: null });
  assert.equal(resolveAttributeValue(record, attribute("Capacidad de carga")), null);
});

test("preparación: conserva las ausencias antiguas y expone su clasificación independiente", () => {
  const target = attribute("Altura de trabajo");
  const relation = catalog.relations.find((item) => item.attributeID === target.id && item.actived !== false);
  assert.ok(relation);
  const category = catalog.categories.find((item) => item.id === relation.categoryID);
  assert.ok(category);
  const result = productAttributes(gamRecord(), category, catalog);
  assert.ok(result.missingRequired.includes(target.name));
  assert.ok(result.missingRequiredDetails.some((item) => item.attributeID === target.id && item.name === target.name && item.status === "not_observed"));
  assert.deepEqual(result.missingRequiredDetails.map((item) => item.name), result.missingRequired);
  assert.ok(result.missingRequiredDetails.every((item) => !result.attributes.some((entry) => entry.attributeID === item.attributeID)));
});

test("GAM: recupera solo un voltaje y una capacidad de batería explícitos", () => {
  const target = attribute("Batería (V / Ah)");
  assert.deepEqual(resolveAttribute(gamRecord({ "Capacidad de la batería": "48V / 420Ah(V/Ah)" }), target),
    { status: "resolved", value: "48 V / 420 Ah" });
  assert.deepEqual(resolveAttribute(gamRecord({ "Capacidad de la batería": " 80 V / 205 Ah ( V / Ah ) " }), target),
    { status: "resolved", value: "80 V / 205 Ah" });
  for (const raw of ["24V / 735-875Ah(V/Ah)", "48V / 420Ah(V/Ah)(V/Ah)",
    "Li-ion 48V / 420Ah(V/Ah)", "48V / 420Ah", "0V / 420Ah(V/Ah)", "48V / 0Ah(V/Ah)"]) {
    assert.deepEqual(resolveAttribute(gamRecord({ "Capacidad de la batería": raw }), target),
      { status: "not_observed", value: null }, raw);
  }
  assert.deepEqual(resolveAttribute(gamRecord({ "Capacidad de la batería": ["48V / 420Ah(V/Ah)", "80V / 205Ah(V/Ah)"] }), target),
    { status: "not_observed", value: null });
});

test("GAM: el dato directo de batería conserva prioridad y el candidato no afecta a otros proveedores", () => {
  const target = attribute("Batería (V / Ah)");
  const specs = { "Batería (V / Ah)": "72 V / 300 Ah", "Capacidad de la batería": "48V / 420Ah(V/Ah)" };
  assert.deepEqual(resolveAttribute(gamRecord(specs), target), { status: "resolved", value: "72 V / 300 Ah" });
  assert.deepEqual(resolveAttribute(mercaelevaRecord({ "Capacidad de la batería": "48V / 420Ah(V/Ah)" }, ""), target),
    { status: "not_observed", value: null });
});

test("GAM: la batería recuperada solo se publica en categorías compatibles sin nuevas revisiones", () => {
  const batteryIds = new Set(catalog.attributes.filter((item) => item.name === "Batería (V / Ah)").map((item) => item.id));
  const eligible: ProductRecord = {
    ...gamRecord(),
    categoryKey: "manutencion", categoryName: "Manutención",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/carretilla-electrica",
    title: "Carretilla elevadora eléctrica de ocasión", condition: "Segunda mano"
  };
  const before = prepareProduct(eligible, catalog);
  const after = prepareProduct({ ...eligible, specs: { "Capacidad de la batería": "48V / 420Ah(V/Ah)" } }, catalog);
  assert.notEqual(after.product.categorySellID, null);
  assert.equal(before.status, "ready");
  assert.equal(after.status, before.status);
  assert.deepEqual(after.issues, before.issues);
  assert.ok(!before.product.attributes.some((item) => batteryIds.has(item.attributeID)));
  assert.ok(after.product.attributes.some((item) => batteryIds.has(item.attributeID) && item.value === "48 V / 420 Ah"));
  const excluded = prepareProduct({ ...eligible, specs: { "Capacidad de la batería": "48V / 420-460Ah(V/Ah)" } }, catalog);
  assert.equal(excluded.status, before.status);
  assert.deepEqual(excluded.issues, before.issues);
  assert.ok(!excluded.product.attributes.some((item) => batteryIds.has(item.attributeID)));
  const incompatible = prepareProduct({ ...eligible,
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5845-2015-jlg-10rs",
    title: "Plataforma tijera eléctrica JLG 10RS", categoryKey: "elevacion",
    specs: { "Capacidad de la batería": "48V / 420Ah(V/Ah)" }
  }, catalog);
  assert.notEqual(incompatible.product.categorySellID, null);
  assert.equal(incompatible.status, "ready");
  assert.ok(!incompatible.product.attributes.some((item) => batteryIds.has(item.attributeID)));
});

test("preparación: no emite opciones incompatibles ni oculta atributos obligatorios inválidos", () => {
  const category = catalog.categories[0];
  const brand = attribute("Marca");
  assert.ok(category);
  const restricted = { ...brand, type: "SELECT" as const, required: true, unit_option: "GENIE / CAT" };
  const contract = { categories: [category], attributes: [restricted], relations: [
    { categoryID: category.id, attributeID: restricted.id }
  ] };
  const invalid = productAttributes(gamRecord(), category, contract);
  assert.deepEqual(invalid.attributes, []);
  assert.deepEqual(invalid.missingRequiredDetails, [
    { attributeID: brand.id, name: "Marca", status: "invalid" }
  ]);
  assert.ok(invalid.qualityIssues.some((item) => item.includes("opcion-invalida")));
  assert.deepEqual(productAttributes({ ...gamRecord(), brand: "GENIE" }, category, contract).attributes,
    [{ attributeID: brand.id, value: "GENIE" }]);
  assert.deepEqual(productAttributes(gamRecord(), category, { ...contract, relations: [] }).attributes, []);
  assert.deepEqual(productAttributes(gamRecord(), category, { ...contract, relations: [] }).missingRequiredDetails, []);
});

test("GAM: preserva años acreditados en descripción y ficha y los declarados explícitamente en título", () => {
  const year = attribute("Año de fabricación");
  const title = { ...gamRecord(), year: "2018", yearSource: "titulo" as const,
    title: "Carretilla de ocasión · Año 2018 · Capacidad 2000 kg" };
  assert.equal(gamSourceYear(title), "2018");
  assert.deepEqual(resolveAttribute(title, year), { status: "resolved", value: 2018 });
  for (const yearSource of ["ficha", "descripcion", "url"] as const) {
    const valid = { ...title, yearSource, title: "Carretilla de ocasión · 2000 kg",
      ...(yearSource === "url" ? {
        url: "https://online.gamrentals.com/es/carretillas-segunda-mano/100-2018-modelo",
        reference: "100"
      } : {}) };
    assert.equal(gamSourceYear(valid), "2018");
    assert.deepEqual(resolveAttribute(valid, year), { status: "resolved", value: 2018 });
  }
  const spec = { ...title, title: "Carretilla 2000 kg", specs: { "Año de fabricación": "2018" } };
  assert.deepEqual(resolveAttribute(spec, year), { status: "resolved", value: 2018 });
});


test("la geometría de modelo acreditada completa únicamente atributos sin evidencia directa", () => {
  const record = { ...gamRecord(), reference: "SYNTHETIC", brand: "EQUIPTEST", model: "X1", title: "Plataforma de tijera", shortDescription: null, longDescription: null };
  const height = attribute("Altura de plataforma");
  const extension = attribute("Extensión de plataforma");
  const reach = attribute("Alcance horizontal");
  const energy = attribute("Motorización / Energía");
  const evidence: SpecsMap = { [height.name]: "5,8 m", [extension.name]: "0,9 m", [reach.name]: "2,5 m", [energy.name]: "Eléctrico" };
  assert.deepEqual(resolveAttribute(record, height, evidence), { status: "resolved", value: 5.8 });
  assert.deepEqual(resolveAttribute(record, extension, evidence), { status: "resolved", value: 0.9 });
  assert.deepEqual(resolveAttribute(record, reach, evidence), { status: "resolved", value: 2.5 });
  assert.equal(resolveAttribute(record, energy, evidence).status, "not_observed");
  assert.equal(resolveAttribute(record, height).status, "not_observed");
  for (const raw of ["5,8 kg", "5,8/6 m", "0 m", "5,8", "5,8 m opcional"]) {
    assert.equal(resolveAttribute(record, height, { [height.name]: raw }).status, "not_observed");
  }
  assert.deepEqual(resolveAttribute({ ...record, specs: { "Altura plataforma": "6 m" } }, height, evidence), { status: "resolved", value: 6 });
  assert.equal(resolveAttribute({ ...record, specs: { "Altura plataforma": "6 kg" } }, height, evidence).status, "invalid");
  assert.equal(resolveAttribute({ ...record, specs: { "Altura plataforma": ["6 m", "7 m"] } }, height, evidence).status, "rejected");
  assert.equal(resolveAttribute({ ...record, specs: { "Altura plataforma": "n/a" } }, height, evidence).status, "not_observed");
  assert.equal(resolveAttribute(record, { ...height, unit_option: "mm" }, evidence).status, "not_observed");
  const category = catalog.categories[0];
  assert.ok(category);
  const contract = { categories: [category], attributes: [height, extension], relations: [{ categoryID: category.id, attributeID: height.id }] };
  assert.deepEqual(productAttributes(record, category, contract, evidence).attributes, [{ attributeID: height.id, value: 5.8 }]);
});


test("los atributos recuperados de unidad conservan el ámbito, las unidades y las precedencias", () => {
  const record = { ...gamRecord(), reference: "SYNTHETIC", brand: "EQUIPTEST", model: "X1", title: "Equipo X1", shortDescription: null,
    longDescription: "Depósito de solución de 35 litros. Neumáticos no marcantes." };
  const tank = attribute("Depósito de solución");
  const tyres = attribute("Neumáticos");
  const angle = attribute("Rotación de torreta");
  const evidence: SpecsMap = { [tank.name]: "35", [tyres.name]: "No marcantes", [angle.name]: "345°" };
  assert.deepEqual(resolveAttribute(record, tank, {}, evidence), { status: "resolved", value: 35 });
  assert.deepEqual(resolveAttribute(record, tyres, {}, evidence), { status: "resolved", value: "No marcantes" });
  assert.deepEqual(resolveAttribute(record, angle, {}, evidence), { status: "resolved", value: 345 });
  assert.equal(resolveAttribute(record, tank, evidence).status, "not_observed");
  assert.equal(resolveAttribute(record, { ...tank, unit_option: "kg / l" }, {}, evidence).status, "not_observed");
  assert.equal(resolveAttribute(record, { ...tyres, unit_option: "Macizos / Superelásticos" }, {}, evidence).status, "not_observed");
  assert.equal(resolveAttribute(record, angle, {}, { [angle.name]: "180° / 360°" }).status, "not_observed");
  assert.equal(resolveAttribute(record, angle, {}, { [angle.name]: "720°" }).status, "not_observed");
  assert.deepEqual(resolveAttribute({ ...record, specs: { [tank.name]: 40 } }, tank, {}, evidence), { status: "resolved", value: 40 });
  assert.equal(resolveAttribute({ ...record, specs: { [tank.name]: [40, 45] } }, tank, {}, evidence).status, "rejected");
  assert.equal(resolveAttribute({ ...record, specs: { [tank.name]: "n/a" } }, tank, {}, evidence).status, "not_observed");
  const provenance: ProductTechnicalProvenance = { originalRecordSha256: originalRecordFingerprint(record), entries: [
    { field: tank.name, value: "35", mechanism: "src/preparation/gam/technical/operations/cleaning-tank-evidence.ts",
      scope: "unit", sourceField: "longDescription", sourceValue: record.longDescription },
    { field: tyres.name, value: "No marcantes", mechanism: "src/preparation/gam/technical/mobility/non-marking-tyres-evidence.ts",
      scope: "unit", sourceField: "longDescription", sourceValue: "Otra descripción" },
    { field: "Capacidad de la tolva", value: "90", mechanism: "src/preparation/technical/example.ts",
      scope: "unit", sourceField: "longDescription", sourceValue: record.longDescription },
    { field: angle.name, value: "345°", mechanism: "src/preparation/technical/example.ts", scope: "unknown", sourceField: null, sourceValue: null }
  ] };
  assert.deepEqual(recoveredUnitAttributeSpecs(record, provenance), { [tank.name]: "35" });
  assert.deepEqual(recoveredUnitAttributeSpecs({ ...record, longDescription: "Otro equipo" }, provenance), {});
});

test("los atributos de unidad aprovechan motorización y medidas explícitas sin sustituir datos de origen", () => {
  const record: ProductRecord = { ...gamRecord(), reference: "SYNTHETIC", brand: "EQUIPTEST", model: "X1",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/synthetic-equipment",
    title: "Equipo eléctrico EQUIPTEST X1", shortDescription: "Equipo eléctrico", longDescription: "Radio de giro 1500 mm." };
  const energy = attribute("Motorización / Energía");
  const centre = attribute("Centro de carga");
  const radius = attribute("Radio de giro");
  const height = attribute("Altura de elevación");
  const slope = attribute("Pendiente superable");
  const evidence: SpecsMap = { Motorización: "Eléctrico", "Centro de carga (mm)": "600 mm", "Radio de giro (mm)": "1500 mm",
    "Altura de elevación (mm)": "4500 mm", "Pendiente superable (%)": "25 %" };
  assert.deepEqual(resolveAttribute(record, energy, {}, evidence), { status: "resolved", value: "Eléctrico" });
  for (const [target, value] of [[centre, 600], [radius, 1500], [height, 4500], [slope, 25]] as const) {
    assert.deepEqual(resolveAttribute(record, target, {}, evidence), { status: "resolved", value });
    assert.equal(resolveAttribute(record, target, evidence).status, "not_observed");
  }
  assert.equal(resolveAttribute(record, energy, evidence).status, "not_observed");
  assert.equal(resolveAttribute({ ...record, specs: { Motor: "Diésel" } }, energy, {}, evidence).status, "not_observed");
  assert.equal(resolveAttribute(record, energy, {}, { ...evidence, "Tipo motor": "Diésel" }).status, "not_observed");
  assert.equal(resolveAttribute({ ...record, title: "Equipo diésel" }, energy, {}, evidence).status, "not_observed");
  assert.equal(resolveAttribute(record, { ...energy, unit_option: "Diésel" }, {}, evidence).status, "not_observed");
  assert.deepEqual(resolveAttribute({ ...record, specs: { "Centro de carga": "500 mm" } }, centre, {}, evidence), { status: "resolved", value: 500 });
  assert.equal(resolveAttribute({ ...record, specs: { "Centro de carga": "n/a" } }, centre, {}, evidence).status, "not_observed");
  assert.equal(resolveAttribute({ ...record, specs: { "Centro de carga": ["500 mm", "600 mm"] } }, centre, {}, evidence).status, "rejected");
  for (const raw of ["1500", "1500 kg", "1500 / 1600 mm", "1500 mm opcional", "15000 mm"]) {
    assert.equal(resolveAttribute(record, radius, {}, { "Radio de giro (mm)": raw }).status, "not_observed");
  }
  assert.equal(resolveAttribute(record, radius, {}, { ...evidence, "Radio de giro": "1600 mm" }).status, "not_observed");
  assert.equal(resolveAttribute(record, { ...radius, unit_option: "m" }, {}, evidence).status, "not_observed");
});

test("las prestaciones operativas de unidad se proyectan sin inferir configuraciones ni sustituir medidas", () => {
  const source: ProductRecord = { ...gamRecord(), reference: "SYNTHETIC", brand: "EQUIPTEST", model: "X1", title: "Equipo X1",
    shortDescription: null, longDescription: "Equipo eléctrico", categoryKey: "manutencion", specs: {} };
  const position = { name: "Posición del operario", type: "SELECT", unit_option: "Acompañante / Plataforma / Sentado" } as const;
  const power = { name: "Potencia del motor", type: "NUMBER", unit_option: "kW" } as const;
  const coverage = { name: "Rendimiento teórico", type: "NUMBER", unit_option: "m²/h" } as const;
  const speed = { name: "Velocidad máxima", type: "NUMBER", unit_option: "km/h" } as const;
  const towing = { name: "Capacidad de arrastre", type: "NUMBER", unit_option: "kg" } as const;
  const handling = { ...source, categoryKey: "carretillas-nuevas" };
  const cleaning = { ...source, categoryKey: "limpieza-fregadoras" };
  const road = { ...source, categoryKey: "maquinaria", longDescription: "Scooter eléctrico. Velocidad máxima de 45 km/h." };
  const evidence: SpecsMap = { "Posición de conducción": "Operador a pie", "Potencia (kW)": "55 kW",
    "Rendimiento de limpieza (m²/h)": "1500", "Velocidad de desplazamiento (km/h)": "45 km/h", "Capacidad de arrastre (kg)": "2500 kg" };
  assert.equal(resolveAttribute(source, position, {}, evidence).value, "Acompañante");
  assert.equal(resolveAttribute(handling, power, {}, evidence).value, 55);
  assert.equal(resolveAttribute(cleaning, coverage, {}, evidence).value, 1500);
  assert.equal(resolveAttribute(road, speed, {}, evidence).value, 45);
  assert.equal(resolveAttribute(source, towing, {}, evidence).value, 2500);
  assert.equal(resolveAttribute(source, position, evidence).value, null);
  assert.equal(resolveAttribute(source, position, {}, { "Posición de conducción": "Operador a bordo" }).value, null);
  assert.equal(resolveAttribute({ ...source, specs: { "Tipo de conducción": "Sentado" } }, position, {}, evidence).value, null);
  assert.equal(resolveAttribute({ ...handling, specs: { "Potencia de tracción (kW)": "15 kW" } }, power, {}, evidence).value, null);
  assert.equal(resolveAttribute(handling, power, {}, { ...evidence, "Potencia nominal del motor": "60 kW" }).value, null);
  assert.equal(resolveAttribute(handling, power, {}, { "Potencia (kW)": "2 x 15 kW" }).value, null);
  assert.equal(resolveAttribute(cleaning, coverage, {}, { "Rendimiento de limpieza (m²/h)": "1500 / 2000" }).value, null);
  assert.equal(resolveAttribute({ ...cleaning, specs: { "Productividad": "n/a" } }, coverage, {}, evidence).value, null);
  assert.equal(resolveAttribute({ ...road, longDescription: "Equipo industrial" }, speed, {}, evidence).value, null);
  assert.equal(resolveAttribute(road, speed, {}, { "Velocidad de desplazamiento (km/h)": "45 km/h sin carga" }).value, null);
  assert.equal(resolveAttribute(source, towing, {}, { "Capacidad de arrastre (kg)": "2500 N" }).value, null);
  assert.equal(resolveAttribute({ ...source, providerId: "manain" }, towing, {}, evidence).value, null);
});


test("la rodadura acreditada se proyecta sin seleccionar neumáticos opcionales", () => {
  const source: ProductRecord = { ...gamRecord(), reference: "SYNTHETIC", brand: "EQUIPTEST", model: "X1", title: "Plataforma EQUIPTEST X1",
    shortDescription: null, longDescription: "Plataforma con tracción en las cuatro ruedas.", categoryKey: "elevacion-nueva", specs: {} };
  const traction = { name: "Tipo de tracción", type: "SELECT", unit_option: "Ruedas / Orugas / Sobre camión / Empuje manual" } as const;
  const tyres = { name: "Neumáticos", type: "SELECT", unit_option: "Macizos / Superelásticos / Neumáticos" } as const;
  assert.equal(resolveAttribute(source, traction, {}, { "Tracción 4x4": "true" }).value, "Ruedas");
  assert.equal(resolveAttribute({ ...source, longDescription: "Tracción 4x4 opcional." }, traction, {}, { "Tracción 4x4": "true" }).value, null);
  assert.equal(resolveAttribute({ ...source, longDescription: "Tracción 4x4 sobre orugas." }, traction, {}, { "Tracción 4x4": "true" }).value, null);
  assert.equal(resolveAttribute(source, traction, {}, { "Tracción 4x4": "false" }).value, null);
  for (const value of ["Sólidos", "Bandaje macizo"]) assert.equal(resolveAttribute(source, tyres, {}, { Neumáticos: value }).value, "Macizos");
  assert.equal(resolveAttribute(source, tyres, {}, { Neumáticos: "8.25x15-14PR (ruedas neumáticas)" }).value, "Neumáticos");
  for (const value of ["Sólidos anti-marcado", "Macizos o neumáticos", "8.25x15-14PR (configuración estándar)"]) {
    assert.equal(resolveAttribute(source, tyres, {}, { Neumáticos: value }).value, null);
  }
  assert.equal(resolveAttribute({ ...source, specs: { Ruedas: "n/a" } }, tyres, {}, { Neumáticos: "Sólidos" }).value, null);
});


test("la geometría acreditada reconoce el alcance con unidad y conserva precedencias y alternativas", () => {
  const record = { ...gamRecord(), reference: "SYNTHETIC", brand: "EQUIPTEST", model: "X1", title: "Equipo X1", shortDescription: null, longDescription: null };
  const reach = attribute("Alcance horizontal");
  const evidence = { "Alcance horizontal (m)": "7,25 m" };
  assert.deepEqual(resolveAttribute(record, reach, evidence), { status: "resolved", value: 7.25 });
  assert.deepEqual(resolveAttribute(record, reach, {}, evidence), { status: "resolved", value: 7.25 });
  assert.equal(resolveAttribute(record, reach, { ...evidence, "Alcance horizontal": "8 m" }).status, "not_observed");
  for (const value of ["0 m", "7/8 m", "7 kg", "7 m opcional", "7.250 m"]) {
    assert.equal(resolveAttribute(record, reach, { "Alcance horizontal (m)": value }).status, "not_observed");
  }
  assert.deepEqual(resolveAttribute({ ...record, specs: { "Alcance horizontal": "6 m" } }, reach, evidence), { status: "resolved", value: 6 });
  assert.equal(resolveAttribute({ ...record, specs: { "Alcance horizontal": "n/a" } }, reach, evidence).status, "not_observed");
  assert.equal(resolveAttribute({ ...record, specs: { "Alcance horizontal máximo": "6 m" } }, reach, evidence).value === 7.25, false);
});

test("las dimensiones de modelo no se combinan sin acreditación conjunta y no sustituyen geometría de unidad", () => {
  const record = { ...mercaelevaRecord({}, "Equipo X1"), reference: "SYNTHETIC", brand: "EQUIPTEST", model: "X1", title: "Plataforma de tijera", shortDescription: null };
  const dimensions = attribute("Dimensiones de la cesta");
  const reviewed = { "Longitud de plataforma": "2,4 m", "Anchura de plataforma": "1,2 m" };
  const provenance: ProductTechnicalProvenance = { originalRecordSha256: originalRecordFingerprint(record), entries: [] };
  assert.deepEqual(reviewedModelAttributeSpecs(record, provenance, reviewed), reviewed);
  assert.equal(resolveAttribute(record, dimensions, reviewed).status, "not_observed");
  const projected = { ...reviewed, "Dimensiones de la cesta": "2,4 x 1,2 m" };
  assert.deepEqual(resolveAttribute(record, dimensions, projected), { status: "resolved", value: "2,4 x 1,2 m" });
  assert.equal(resolveAttribute({ ...record, specs: { "Anchura de plataforma": "1,5 m" } }, dimensions, projected).status, "not_observed");
  assert.equal(resolveAttribute(record, dimensions, { "Dimensiones de la cesta": "2,4 x 1,2 kg" }).status, "not_observed");
});
