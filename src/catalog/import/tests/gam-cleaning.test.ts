import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";

const catalog = await loadImportCatalog();
const attribute = (name: string) => {
  const value = catalog.attributes.find((entry) => entry.name === name);
  if (!value) throw new Error(`Atributo ausente: ${name}`);
  return value;
};
const record = (
  family: "fregadoras" | "barredoras" | "aspiradoras",
  description: string,
  title = "Fregadora industrial TENNANT",
  specs: ProductRecord["specs"] = {}
): ProductRecord => ({
  providerId: "gam", categoryKey: family === "aspiradoras" ? "marcas-nuevas" : `limpieza-${family}`,
  categoryName: "Limpieza", url: `https://online.gamrentals.com/es/${family}-industriales-nuevas/4025-tennant`,
  title, shortDescription: "Ficha comercial", longDescription: description, price: null,
  reference: "4025", brand: "Tennant", model: "BCS S680", year: null,
  location: null, country: null, horometer: null, serialNumber: null, image: null, specs
});
const resolved = (product: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(product, attribute(name));

test("GAM limpieza: asigna energía explícita de baterías, cable y un único combustible", () => {
  assert.equal(resolved(record("barredoras", "Alimentada por baterías de gel de 24 V.", "Barredora TENNANT"), "Alimentación"), "Batería");
  assert.equal(resolved(record("fregadoras", "Funciona con batería de 24 V."), "Alimentación"), "Batería");
  assert.equal(resolved(record("barredoras", "Equipada con un sistema de baterías de 24 V, con hasta 3 horas de autonomía.", "Barredora TENNANT"), "Alimentación"), "Batería");
  assert.equal(resolved(record("fregadoras", "Equipada con una batería que proporciona 4,3 horas de funcionamiento."), "Alimentación"), "Batería");
  assert.equal(resolved(record("fregadoras", "Con baterías de 24 V y autonomía de hasta 3,5 horas."), "Alimentación"), "Batería");
  assert.equal(resolved(record("aspiradoras", "Con un cable de alimentación de 8,5 metros.", "Aspiradora TENNANT"), "Alimentación"), "Cable");
  assert.equal(resolved(record("barredoras", "Esta barredora monta motor diésel.", "Barredora TENNANT"), "Alimentación"), "Diésel");
  assert.equal(resolved(record("barredoras", "Dispone de motor GLP.", "Barredora TENNANT"), "Alimentación"), "GLP");
});

test("GAM limpieza: conductor acompañante y sentado se interpretan según el contrato existente", () => {
  assert.equal(resolved(record("fregadoras", "Fregadora de conductor acompañante."), "Tipo de conductor"), "Hombre a pie");
  assert.equal(resolved(record("barredoras", "Barredora de operario sentado.", "Barredora TENNANT"), "Tipo de conductor"), "Hombre a bordo");
  assert.equal(resolved(record("fregadoras", "Equipo walk-behind."), "Tipo de conductor"), "Hombre a pie");
  assert.equal(resolved(record("fregadoras", "Máquina de operador sentado y conductor acompañante."), "Tipo de conductor"), null);
});

test("GAM limpieza: recupera solo anchura de limpieza inequívoca y convierte a mm", () => {
  assert.equal(resolved(record("fregadoras", "Su ancho de fregado es de 0,50 m."), "Ancho de trabajo"), 500);
  assert.equal(resolved(record("barredoras", "La trayectoria de limpieza total de 1.050 mm permite barrer.", "Barredora TENNANT"), "Ancho de trabajo"), 1050);
  assert.equal(resolved(record("barredoras", "Franja de limpieza de 138 cm.", "Barredora TENNANT"), "Ancho de trabajo"), 1380);
  assert.equal(resolved(record("fregadoras", "Ancho de trabajo de 700 mm; ancho de trabajo de 700 mm."), "Ancho de trabajo"), 700);
  assert.equal(resolved(record("barredoras", "Franja de limpieza de 1.380 mm y productividad de hasta 9.000 m²/h.", "Barredora TENNANT"), "Ancho de trabajo"), 1380);
});

test("GAM limpieza: versiones, opciones, medidas de máquina y potencia no acreditada quedan sin inferir", () => {
  assert.equal(resolved(record("barredoras", "Disponible con motores diésel o GLP.", "Barredora TENNANT Diesel/LPG"), "Alimentación"), null);
  assert.equal(resolved(record("fregadoras", "Funcionamiento a gasolina o diésel."), "Alimentación"), null);
  assert.equal(resolved(record("barredoras", "Disponible con motores diésel o GLP.", "Barredora TENNANT"), "Alimentación"), null);
  assert.equal(resolved(record("barredoras", "Disponible tanto en versiones diésel como LPG.", "Barredora TENNANT"), "Alimentación"), null);
  assert.equal(resolved(record("barredoras", "Diseño sin cable de alimentación.", "Barredora TENNANT"), "Alimentación"), null);
  assert.equal(resolved(record("fregadoras", "Batería opcional y motor diésel."), "Alimentación"), null);
  assert.equal(resolved(record("barredoras", "Ancho de barrido de 1270 mm con cepillo lateral y hasta 1570 mm con cepillos dobles.", "Barredora TENNANT"), "Ancho de trabajo"), null);
  assert.equal(resolved(record("barredoras", "El cepillo principal es de 650 mm y la anchura de la máquina de 816 mm.", "Barredora TENNANT"), "Ancho de trabajo"), null);
  assert.equal(resolved(record("fregadoras", "Trayectoria de limpieza de 550 mm o 700 mm."), "Ancho de trabajo"), null);
  assert.equal(resolved(record("fregadoras", "Ancho de fregado máximo de 800 mm."), "Ancho de trabajo"), null);
  assert.equal(resolved(record("barredoras", "Trayectoria de limpieza total de hasta 1520 mm.", "Barredora TENNANT"), "Ancho de trabajo"), null);
  assert.equal(resolved(record("fregadoras", "El cabezal de disco tiene una trayectoria de limpieza de 1049 mm, mientras que el cabezal cilíndrico cubre 984 mm."), "Ancho de trabajo"), null);
  assert.equal(resolved(record("aspiradoras", "Tiene 390 mm de ancho, succión potente y motor de 1200 W.", "Aspiradora TENNANT"), "Potencia de aspiración"), null);
  assert.equal(resolved(record("aspiradoras", "Equipo portátil operado manualmente.", "Aspiradora TENNANT"), "Tipo de conductor"), null);
  assert.equal(resolved(record("fregadoras", "Robot fregadora autónomo con funcionamiento a batería.", "Fregadora autónoma TENNANT"), "Tipo de conductor"), null);
});

test("GAM limpieza: respeta los specs existentes y no extrapola a otros proveedores o líneas", () => {
  const withSpecs = record("barredoras", "Ancho de barrido de 860 mm.", "Barredora TENNANT", { "Anchura trabajo": "0,85 metros" });
  assert.equal(resolved(withSpecs, "Ancho de trabajo"), 850);
  const incompatibleModel: ProductRecord = {
    ...record("barredoras", "La barredora TENNANT BCS S16L está alimentada por baterías, con conductor sentado y una franja de limpieza de 1520 mm.", "Barredora TENNANT BCS S16H"),
    model: "BCS S16H Descarga alto"
  };
  assert.equal(resolved(incompatibleModel, "Alimentación"), null);
  assert.equal(resolved(incompatibleModel, "Tipo de conductor"), null);
  assert.equal(resolved(incompatibleModel, "Ancho de trabajo"), null);
  const shortConfirmed: ProductRecord = {
    ...record("barredoras", "Esta barredora TENNANT BCS S16L se alimenta mediante baterías.", "Barredora TENNANT BCS S16L"),
    model: "BCS S16L Descarga baja",
    shortDescription: "Barredora TENNANT BCS S16L de conductor sentado."
  };
  assert.equal(resolved(shortConfirmed, "Tipo de conductor"), "Hombre a bordo");
  const shortWrongModel: ProductRecord = {
    ...shortConfirmed,
    shortDescription: "La barredora TENNANT BCS S16H es de conductor sentado."
  };
  assert.equal(resolved(shortWrongModel, "Tipo de conductor"), null);
  for (const different of [
    { ...record("barredoras", "Conductor sentado, alimentada por baterías.", "Barredora TENNANT"), providerId: "gomariz" },
    { ...record("barredoras", "Conductor sentado, alimentada por baterías.", "Barredora TENNANT"), url: "https://otro-proveedor.es/es/barredoras-industriales-nuevas/123" },
    { ...record("barredoras", "Conductor sentado, alimentada por baterías.", "Carretilla elevadora"), categoryKey: "manutencion" }
  ]) {
    assert.equal(resolved(different, "Alimentación"), null);
    assert.equal(resolved(different, "Tipo de conductor"), null);
  }
});
