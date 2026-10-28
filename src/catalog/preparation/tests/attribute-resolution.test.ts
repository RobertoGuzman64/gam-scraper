import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute, resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { productAttributes } from "../product-attributes.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

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
