import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../preparation/prepare.js";

const catalog = await loadImportCatalog();
const attribute = (name: string) => {
  const found = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(found, name);
  return found;
};
const machine = (overrides: Partial<ProductRecord> = {}, specs: SpecsMap = {}): ProductRecord => ({
  providerId: "gam",
  categoryKey: "carretillas-elevadoras-electricas-segunda-mano",
  categoryName: "Manutención",
  url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/2285-carretilla-frontal-electrica-yale-erp15ux",
  title: "Carretilla elevadora eléctrica 1500Kg Yale ERP15UX",
  shortDescription: "Carretilla eléctrica Yale ERP15UX",
  longDescription: "La carretilla Yale ERP15UX cuenta con una capacidad de carga de 1500 kg.",
  reference: "2285",
  brand: "YALE",
  model: "ERP15UX",
  condition: "Segunda mano",
  price: null,
  year: null,
  country: null,
  location: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs,
  ...overrides
});

const resolution = (record: ProductRecord, name: string) => resolveAttribute(record, attribute(name));

test("GAM: NA y horómetro sustituido son lectura ausente, no horas numéricas inválidas", () => {
  for (const value of ["NA horas", "Horometro sustituido horas", "Horómetro sustituido horas", "  nA  horas  "]) {
    const record = machine({ horometer: value });
    assert.deepEqual(resolution(record, "Horas de uso"), { status: "not_observed", value: null });
    assert.equal(record.horometer, value);
  }
  assert.deepEqual(resolution(machine({}, { "Horas (h)": "NA horas" }), "Horas de uso"),
    { status: "not_observed", value: null });
});

test("GAM: no ignora horas dudosas, observadas ni inconsistentes", () => {
  for (const value of ["NA V72309090022 horas", "Horometro sustituido 300 horas", "desconocido horas", "300/500 horas"]) {
    assert.equal(resolution(machine({ horometer: value }), "Horas de uso").status, "invalid");
  }
  assert.deepEqual(resolution(machine({ horometer: "385 horas" }), "Horas de uso"),
    { status: "resolved", value: 385 });
  assert.deepEqual(resolution(machine({ horometer: "NA horas" }, { "Horas (h)": "385 horas" }), "Horas de uso"),
    { status: "resolved", value: 385 });
  assert.equal(resolution(machine({ horometer: "385 horas" }, { "Horas (h)": "390 horas" }), "Horas de uso").status,
    "contradiction");
  assert.equal(resolution(machine({ providerId: "gomariz", horometer: "NA horas" }), "Horas de uso").status,
    "invalid");
});

test("GAM: elevación libre SI/NO no implica distancia en milímetros", () => {
  for (const value of ["SI", "NO", "Sí", " no "]) {
    assert.deepEqual(resolution(machine({}, { "Elevación libre": value }), "Elevación libre"),
      { status: "not_observed", value: null });
  }
  assert.deepEqual(resolution(machine({}, { "Elevación libre": "1600" }), "Elevación libre"),
    { status: "resolved", value: 1600 });
  assert.deepEqual(resolution(machine({}, { "Elevación libre": "2500 mm" }), "Elevación libre"),
    { status: "resolved", value: 2500 });
  assert.deepEqual(resolution(machine({}, { "Elevación libre (mm)": "1600 mm" }), "Elevación libre"),
    { status: "resolved", value: 1600 });
  assert.equal(resolution(machine({}, { "Elevación libre": "1600/2500" }), "Elevación libre").status,
    "invalid");
  assert.equal(resolution(machine({ providerId: "gomariz" }, { "Elevación libre": "SI" }), "Elevación libre").status,
    "invalid");
  assert.equal(resolution(machine({}, { "Elevación libre": "NO", "Elevación libre (mm)": "1500 mm" }),
    "Elevación libre").status, "contradiction");
  assert.deepEqual(resolution(machine({}, { "Elevación libre": "SI", "Elevación libre (mm)": "1500 mm" }),
    "Elevación libre"), { status: "resolved", value: 1500 });
});

test("GAM: centro de carga recupera solo unidades mm duplicadas idénticas", () => {
  for (const [raw, expected] of [["500mm mm", 500], ["600mm mm", 600], ["1200mm mm", 1200]] as const) {
    assert.deepEqual(resolution(machine({}, { "Centro de carga": raw }), "Centro de carga"),
      { status: "resolved", value: expected });
  }
  assert.deepEqual(resolution(machine({}, { "Centro de carga (mm)": "500 mm" }), "Centro de carga"),
    { status: "resolved", value: 500 });
  for (const raw of ["500-600 mm", "500 mm cm", "500mm mm extra", "500/600 mm", "500 kg mm"]) {
    assert.equal(resolution(machine({}, { "Centro de carga": raw }), "Centro de carga").status, "invalid");
  }
  assert.equal(resolution(machine({ providerId: "gomariz" }, { "Centro de carga": "500mm mm" }), "Centro de carga").status,
    "invalid");
});

test("GAM: no elige radios de giro entre configuraciones incompatibles", () => {
  for (const raw of ["3580 / 3780", "3879 / 4009", "389 / 4009", "3.8 / 6.0", "24V / 400Ah(V/Ah)"]) {
    assert.equal(resolution(machine({}, { "Radio de giro": raw }), "Radio de giro").status, "invalid");
  }
  assert.deepEqual(resolution(machine({}, { "Radio de giro": "1955 mm" }), "Radio de giro"),
    { status: "resolved", value: 1955 });
  assert.deepEqual(resolution(machine({}, { "Radio de giro (mm)": "1955 mm" }), "Radio de giro"),
    { status: "resolved", value: 1955 });
  assert.deepEqual(resolution(machine({}, { "Radio de giro": "1,98 m" }), "Radio de giro"),
    { status: "resolved", value: 1980 });
});

test("GAM: preparación conserva origen y omite mediciones que no están publicadas", () => {
  const record = machine({ horometer: "Horometro sustituido horas" }, { "Elevación libre": "SI", "Centro de carga": "500mm mm" });
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.issues.includes("Atributo no normalizable: Horas de uso"), false);
  assert.equal(prepared.issues.includes("Atributo no normalizable: Elevación libre"), false);
  assert.equal(prepared.issues.includes("Atributo no normalizable: Centro de carga"), false);
  assert.equal(record.horometer, "Horometro sustituido horas");
  assert.ok(record.specs);
  assert.equal(record.specs["Elevación libre"], "SI");
  assert.equal(record.specs["Centro de carga"], "500mm mm");
});
