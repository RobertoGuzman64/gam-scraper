import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();

const record = (title: string, specs: ProductRecord["specs"]): ProductRecord => ({
  providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/MB-EFL253-M402-2703",
  title, shortDescription: null, longDescription: null, price: "4950", condition: "Nuevo",
  reference: "M402-2703", brand: "MB", model: "EFL253", year: "2025", location: null,
  country: null, horometer: null, serialNumber: null, image: "https://example.com/photo.jpg",
  images: ["https://example.com/photo.jpg"], specs: specs ?? {}
});

const attribute = (name: string, unitOption?: string) => {
  const found = catalog.attributes.find((item) => item.name === name &&
    (unitOption === undefined || item.unit_option === unitOption));
  assert.ok(found, name);
  return found;
};

const value = (source: ProductRecord, name: string, unitOption?: string): string | number | boolean | null =>
  resolveAttributeValue(source, attribute(name, unitOption));

test("Mercaeleva: recupera motorización solo con energía eléctrica acreditada", () => {
  const electric = record("LGMG S1012E-2 NUEVA PLATAFORMA TIJERA ELECTRICA 12 MT", {
    "Tipo de motor": "Eléctrico", "Título adicional": "PLATAFORMA TIJERA ELECTRICA"
  });
  assert.equal(value(electric, "Motorización / Energía"), "Eléctrico");
  assert.equal(value({ ...electric, specs: { ...electric.specs, "Tipo de motor": "Diesel" } }, "Motorización / Energía"), null);
  assert.equal(value({ ...electric, title: "PLATAFORMA TIJERA ELECTRICA DIESEL" }, "Motorización / Energía"), null);
  assert.equal(value({ ...electric, specs: { "Tipo de motor": "Diesel" } }, "Motorización / Energía"), null);
  assert.equal(value({ ...electric, specs: {} }, "Motorización / Energía"), null);
  assert.equal(value({ ...electric, providerId: "gam" }, "Motorización / Energía"), null);
  assert.equal(value({ ...electric, url: "https://unknown.example/machine/1" }, "Motorización / Energía"), null);
});

test("Mercaeleva: la batería publicada confirma carretillas eléctricas sin motor explícito", () => {
  const source = record("MB EFL253 Carretilla eléctrica de 2.500kg con batería de Litio", {
    "Tipo de Batería": "Li-ion", "Voltaje de la batería": "80 V", "Capacidad de la batería": "205 Ah"
  });
  assert.equal(value(source, "Motorización / Energía"), "Eléctrico");
  assert.equal(value(source, "Batería (V / Ah)"), "80 V / 205 Ah");
  assert.equal(value({ ...source, specs: { "Tipo de Batería": "Li-ion", "Voltaje del cargador": "80 V", "Corriente del cargador": "60 A" } }, "Batería (V / Ah)"), null);
  assert.equal(value({ ...source, specs: { "Voltaje de la batería": "−1 V", "Capacidad de la batería": "205 Ah" } }, "Batería (V / Ah)"), null);
  assert.equal(value({ ...source, specs: { "Voltaje de la batería": "80 V", "Capacidad de la batería": "205 Ah / 300 Ah" } }, "Batería (V / Ah)"), null);
  assert.equal(value({ ...source, title: "CARRETILLA DIESEL CON BATERIA", specs: { "Tipo de Batería": "Li-ion" } }, "Motorización / Energía"), null);
});

test("Mercaeleva: mapea posición del operario y rechaza posiciones incompatibles", () => {
  const walk = record("MB F4 Transpaleta Eléctrica 1.500 kg", { "Posición del conductor": "Peatonal" });
  const standing = record("MB RPL201 Transpaleta Eléctrica de Conductor Montado", { "Posición del conductor": "Plataforma" });
  assert.equal(value(walk, "Posición del operario", "Acompañante / Plataforma / Sentado"), "Acompañante");
  assert.equal(value(standing, "Posición del operario", "Acompañante / Plataforma / Sentado"), "Plataforma");
  assert.equal(value({ ...walk, title: "TRANSPALET ELECTRICO DE CONDUCTOR MONTADO" }, "Posición del operario", "Acompañante / Plataforma / Sentado"), null);
  assert.equal(value({ ...standing, specs: { "Posición del conductor": "Peatonal" } }, "Posición del operario", "Sentado / De pie / Acompañante"), null);
  assert.equal(value({ ...walk, specs: { "Posición del conductor": "Peatonal" } }, "Posición del operario", "Sentado / De pie / Acompañante"), "Acompañante");
  assert.equal(value(standing, "Posición del operario", "Sentado / De pie / Acompañante"), null);
});

test("Mercaeleva: normaliza mástiles a valores de catálogo, sin decidir ante contradicciones", () => {
  const source = record("MB EFL253 Carretilla eléctrica de 2.500kg", { "Tipo de mástil": "Triple" });
  assert.equal(value(source, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...source, specs: { "Tipo de mástil": "Dúplex/estándar" } }, "Tipo de mástil"), "Dúplex");
  assert.equal(value({ ...source, longDescription: "MÁSTIL DÚPLEX" }, "Tipo de mástil"), null);
  assert.equal(value({ ...source, longDescription: "MÁSTIL TRÍPLEX" }, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...source, longDescription: "DÚPLEX TRÍPLEX" }, "Tipo de mástil"), null);
  assert.equal(value({ ...source, specs: { "Tipo de mástil": "Triple o Dúplex" } }, "Tipo de mástil"), null);
});

test("Mercaeleva: datos técnicos explícitos sin confundir capacidad, peso o centro de carga", () => {
  const forklift = record("MB EFL253 Carretilla eléctrica de 2.500kg", {
    "Tipo de cabina": "Guardia superior", "Distancia del centro de gravedad": "540 mm"
  });
  assert.equal(value(forklift, "Cabina", "Abierta / Cerrada / Techo protector"), "Techo protector");
  assert.equal(value(forklift, "Centro de carga"), null);
  assert.equal(value({ ...forklift, specs: { "Distancia del centro de gravedad": "−1 mm" } }, "Centro de carga"), null);
  const excavator = record("Kubota U27.4 MINIEXCAVADORA ORUGA 2700 KG", {
    "Título adicional": "MINIEXCAVADORA ORUGA 2700 KG", "Tipo de motor": "Diesel"
  });
  assert.equal(value(excavator, "Tipo de tracción", "Orugas / Ruedas"), "Orugas");
  assert.equal(value(excavator, "Peso operativo"), null);
  assert.equal(value({ ...excavator, specs: { "Título adicional": "MINIEXCAVADORA DE RUEDAS" } }, "Tipo de tracción", "Orugas / Ruedas"), null);
});

test("Mercaeleva: solo publica certificación CE cuando está expresada en la ficha", () => {
  const source = record("Ausa D450AHG DUMPER GIRATORIO 4500 KG", { "Certificación CE": "Yes" });
  assert.equal(value(source, "Certificación / Marcado CE"), true);
  assert.equal(value({ ...source, specs: { "Certificación CE": "No" } }, "Certificación / Marcado CE"), false);
  assert.equal(value({ ...source, specs: { "Certificación CE": "Pendiente" } }, "Certificación / Marcado CE"), null);
  assert.equal(value({ ...source, specs: {} }, "Certificación / Marcado CE"), null);
});

test("Mercaeleva: mantiene bloqueadas capacidades contradictorias, pesos y mástiles ausentes", () => {
  const source = record("MB EFL303 Carretilla eléctrica de 3.000 kg", {
    "Capacidad máxima de elevación": "2500 kg", "Tipo de mástil": "Triple", "Altura máxima de elevación": "4800 mm"
  });
  assert.equal(value(source, "Capacidad de carga"), null);
  assert.equal(value(source, "Altura de elevación"), 4800);
  const prep = prepareProduct(source, catalog);
  assert.ok(prep.importIssues?.createMany.includes("Atributo obligatorio ausente: Capacidad de carga"));
  assert.ok(prep.issues.some((issue) => issue.includes("Capacidad de carga")));
  const dumper = record("Ausa D450AHG DUMPER GIRATORIO 4500 KG", {});
  assert.equal(value(dumper, "Peso operativo"), null);
});


test("Mercaeleva: solo rescata capacidad de carga nominada y concordante", () => {
  const source = record("Toyota 6FBRE14 CARRETILLA RETRACTIL", {});
  assert.equal(value({ ...source, longDescription: "Capacidad de carga: 1.350 kg, batería eléctrica" }, "Capacidad de carga"), 1350);
  assert.equal(value({ ...source, longDescription: "Capacidad de carga: 1.500 kg" }, "Capacidad de carga"), 1500);
  assert.equal(value({ ...source, longDescription: "Capacidad de carga: 1350 kg o 1500 kg" }, "Capacidad de carga"), null);
  assert.equal(value({ ...source, longDescription: "Capacidad de carga: 1350 kg; capacidad nominal 1500 kg" }, "Capacidad de carga"), null);
  assert.equal(value({ ...source, longDescription: "Capacidad de carga: 1350 kg", specs: { "Capacidad máxima de elevación": "1500 kg" } }, "Capacidad de carga"), null);
  assert.equal(value({ ...source, longDescription: "CAPACIDAD 1350 KG" }, "Capacidad de carga"), null);
  assert.equal(value({ ...source, specs: { "Capacidad nominal": "1350 kg" } }, "Capacidad de carga"), 1350);
  assert.equal(value({ ...source, specs: { "Capacidad nominal": "1350 Ah" } }, "Capacidad de carga"), null);
});

test("Mercaeleva: solo recupera alturas expresamente identificadas como elevación", () => {
  const forklift = record("Toyota 02-7FD18 CARRETILLA ELEVADORA DIESEL 1800 KG", {});
  assert.equal(value({ ...forklift, longDescription: "Altura máxima de elevación 4.700 mm" }, "Altura de elevación"), 4700);
  assert.equal(value({ ...forklift, longDescription: "Altura de elevación 4,7 m" }, "Altura de elevación"), 4700);
  assert.equal(value({ ...forklift, longDescription: "ALTURA DE TRABAJO 4.700 mm" }, "Altura de elevación"), null);
  assert.equal(value({ ...forklift, longDescription: "Altura de elevación 4.700 mm o 5.200 mm" }, "Altura de elevación"), null);
  assert.equal(value({ ...forklift, longDescription: "Altura de elevación 4.700 mm y altura máxima de elevación 5.200 mm" }, "Altura de elevación"), null);
  assert.equal(value({ ...forklift, longDescription: "Altura de elevación 4.700 mm", specs: { "Altura máxima de elevación": "4800 mm" } }, "Altura de elevación"), null);
});

test("Mercaeleva: distingue el peso operativo de capacidad y peso comercial", () => {
  const excavator = record("Kubota U27.4 MINIEXCAVADORA ORUGA 2700 KG", {});
  assert.equal(value({ ...excavator, longDescription: "PESO OPERATIVO 2.650 KG" }, "Peso operativo"), 2650);
  assert.equal(value({ ...excavator, longDescription: "PESO EN SERVICIO: 2.650 KG" }, "Peso operativo"), 2650);
  assert.equal(value({ ...excavator, longDescription: "CAPACIDAD 2700 KG" }, "Peso operativo"), null);
  assert.equal(value({ ...excavator, longDescription: "Peso operativo 2.650 KG / 2.800 KG" }, "Peso operativo"), null);
  assert.equal(value({ ...excavator, longDescription: "Peso operativo 2650 kg; peso en servicio 2800 kg" }, "Peso operativo"), null);
  assert.equal(value({ ...excavator, specs: { "Peso en servicio": "2650 kg" } }, "Peso operativo"), 2650);
});

test("Mercaeleva: controla mástil doble/simple frente a especificación y evita variantes", () => {
  const forklift = record("Linde E16P CARRETILLA ELEVADORA ELECTRICA 1600 KG", { "Tipo de mástil": "Triple" });
  assert.equal(value({ ...forklift, longDescription: "MÁSTIL DOBLE, altura 4300 mm" }, "Tipo de mástil"), null);
  assert.equal(value({ ...forklift, longDescription: "MÁSTIL TRIPLE 4300 mm" }, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...forklift, longDescription: "MASTIL SIMPLE o TRIPLEX" }, "Tipo de mástil"), null);
  assert.equal(value({ ...forklift, longDescription: "Manejo simple y compacto" }, "Tipo de mástil"), "Tríplex");
  assert.equal(value({ ...forklift, specs: { "Tipo de mástil": ["Triple"] }, longDescription: "MÁSTIL DOBLE" }, "Tipo de mástil"), null);
});

test("Mercaeleva: no rescata información textual desde proveedores o dominios ajenos", () => {
  const source = { ...record("Carretilla elevadora 2000 KG", {}), longDescription: "Capacidad de carga 2000 kg" };
  assert.equal(value({ ...source, url: "https://other.example/es/for-sale/machine/123", title: "Carretilla elevadora" }, "Capacidad de carga"), null);
  assert.equal(value({ ...source, providerId: "gam" }, "Capacidad de carga"), null);
});
