import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTechnicalDensity } from "../technical/technical-density.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";

const candidate = (reference: string, spec: ImportCandidate["spec"], providerId = "proveedor"): ImportCandidate => ({
  providerId, sourceUrl: `https://example.com/${reference}`, reference, title: `Máquina ${reference}`,
  categorySellID: null, category: "Elevación", condition: "Segunda_Mano", price: null,
  description_title: null, description: null, description_general: null, image: null, images: [],
  spec, attributes: []
});

test("la densidad técnica separa prestaciones de metadatos y no inventa campos obligatorios", () => {
  const report = analyzeTechnicalDensity([
    candidate("1", { Marca: "JLG", Modelo: "1930ES", "Año de fabricación": "2018", "Horas laborales": "300 h",
      Estado: "Usado", "Título adicional": "Elevador", "Tipo de motor": "Eléctrico", "Altura de trabajo": "7,8 m" }),
    candidate("2", { Marca: "JLG", Modelo: "1930ES", "Tipo de motor": "Eléctrico", "Altura de trabajo": "7,8 m", Capacidad: "230 kg" }),
    candidate("3", { Marca: "JLG", Modelo: "1930ES", "Tipo de motor": "", "Altura de trabajo": [] }),
    candidate("4", { Marca: "JLG", Modelo: "450AJ", "Altura de trabajo": "15 m" }, "otro"),
    candidate("5", { Marca: "JLG", Modelo: "450AJ", "Tipo de motor": "Diésel", "Altura de trabajo": "15 m",
      Capacidad: "230 kg", Peso: "6.000 kg" }, "otro")
  ]);
  assert.equal(report.totals.products, 5);
  assert.equal(report.target.minimum, 6);
  assert.equal(report.target.below, 5);
  assert.equal(report.target.missing, 20);
  assert.deepEqual(report.target.cases.map((item) => [item.reference, item.technicalCount, item.missingToTarget]),
    [["3", 0, 6], ["4", 1, 5], ["1", 2, 4], ["2", 3, 3], ["5", 4, 2]]);
  assert.deepEqual(report.target.providers, [
    { providerId: "otro", below: 2, missing: 7 },
    { providerId: "proveedor", below: 3, missing: 13 }
  ]);
  assert.equal(report.totals.sparse, 3);
  assert.equal(report.totals.medium, 1);
  assert.equal(report.cases.length, 3);
  assert.equal(report.mediumCases.length, 1);
  assert.deepEqual(report.providers.map((item) => [item.providerId, item.products, item.sparse, item.median]),
    [["otro", 2, 1, 2.5], ["proveedor", 3, 2, 2]]);
  assert.deepEqual(report.cases.map((item) => [item.reference, item.technicalCount, item.priority]),
    [["3", 0, "alta"], ["4", 1, "alta"], ["1", 2, "alta"]]);
  assert.deepEqual(report.mediumCases.map((item) => [item.reference, item.technicalCount, item.priority]),
    [["2", 3, "media"]]);
  assert.deepEqual(report.cases.find((item) => item.reference === "1")?.technicalKeys,
    ["Altura de trabajo (mm)", "Tipo de motor"]);
  assert.deepEqual(report.models.find((item) => item.providerId === "proveedor"), {
    providerId: "proveedor", brand: "JLG", model: "1930ES", products: 3, sparse: 2, medium: 1, examples: ["1", "2", "3"]
  });
  assert.match(report.note, /Sin bloqueo de publicación/);
  assert.deepEqual(report.criteria, { sparseMaximum: 2, mediumMaximum: 3 });
  assert.equal([...report.cases, ...report.mediumCases].some((item) => item.reference === "5"), false);
});

test("el criterio se aplica también a proveedores nuevos y rechaza duplicados", () => {
  const report = analyzeTechnicalDensity([
    candidate("5", { "Capacidad": "200 kg", "Alcance": "9 m", "Peso": "1500 kg" }, "nuevo"),
    candidate("6", { "Nº de serie": "123", "Certificación CE": "Sí" }, "nuevo")
  ]);
  assert.equal(report.providers[0]?.providerId, "nuevo");
  assert.equal(report.target.below, 2);
  assert.equal(report.target.missing, 9);
  assert.equal(report.providers[0]?.sparse, 1);
  assert.equal(report.providers[0]?.medium, 1);
  assert.equal(report.providers[0]?.median, 1.5);
  assert.throws(() => analyzeTechnicalDensity([candidate("5", {}), candidate("5", {})]), /duplicada/);
});

test("la riqueza cuenta una sola vez alias acreditados y distingue conceptos y condiciones independientes", () => {
  const base = candidate("riqueza", { "Altura de trabajo (mm)": "8000 mm", "Altura de plataforma": "6 m",
    "Capacidad de carga (kg)": "230 kg", "Capacidad a máxima altura de elevación": "180 kg",
    "Longitud de plataforma": "2 m", "Anchura de plataforma": "1 m", "Elevación libre disponible": false,
    "Distancia al suelo": "0 mm", "Horas de uso": "100 h", Marca: "Marca", "Nueva o usada": "usada", Maquina: "Plataforma" });
  const withAliases = { ...base, spec: { ...base.spec, "Altura de trabajo (m)": "8 m", "Ancho de plataforma": "1000 mm" } };
  const first = analyzeTechnicalDensity([base]).richness.cases[0]!;
  const second = analyzeTechnicalDensity([withAliases]).richness.cases[0]!;
  assert.equal(first.interpretedConcepts, 8);
  assert.equal(second.interpretedConcepts, first.interpretedConcepts);
  assert.deepEqual(second.aliases.map(({ status }) => status), ["acreditada", "acreditada"]);
  assert.equal(second.unresolved.length, 0);
  assert.equal(second.interpretedKeys.includes("Horas (h)"), false);
  assert.equal(second.interpretedKeys.includes("Elevación libre disponible"), true);
});

test("las equivalencias incompatibles no se acreditan y los valores no interpretables quedan visibles", () => {
  const report = analyzeTechnicalDensity([candidate("conflicto", { "Altura de trabajo (mm)": "8000 mm", "Altura de trabajo (m)": "9 m",
    "Ancho de plataforma": "1 kg", "Anchura de plataforma": "1 m", "Dimensiones cesta (mm)": "1,4 x 0,7 m",
    "Capacidad de carga (kg)": "200 / 300 kg", "Campo desconocido": "Texto" })]).richness;
  assert.deepEqual(report.cases[0]?.aliases.map(({ status }) => status), ["conflicto", "posible"]);
  assert.equal(report.totals.accreditedRedundancyProducts, 0);
  assert.equal(report.totals.conflictingAliasProducts, 1);
  assert.equal(report.totals.possibleRedundancyProducts, 1);
  assert.equal(report.cases[0]?.unresolved.some(({ key }) => key === "Campo desconocido"), true);
  assert.equal(report.cases[0]?.interpretedKeys.includes("Dimensiones cesta (mm)"), true);
});

test("la cobertura familiar no confunde una capacidad condicionada ni altura replegada con una prestación nominal", () => {
  const product = { ...candidate("familia", { "Altura de plataforma recogida": "2 m", "Capacidad de plataforma sin restricciones": "200 kg",
    "Longitud de plataforma": "2 m" }), title: "Plataforma de tijera", category: "Plataformas de tijera" };
  const report = analyzeTechnicalDensity([product]).richness;
  const item = report.cases[0]!;
  assert.equal(item.family, "plataformas de tijera");
  assert.deepEqual(item.essentials.map(({ key, status }) => [key, status]), [
    ["altura_vertical", "no_evaluable"], ["capacidad", "no_evaluable"], ["dimensiones_plataforma", "no_evaluable"]
  ]);
  const complete = analyzeTechnicalDensity([{ ...product, spec: { "Altura de trabajo (m)": "8 m", "Capacidad de la cesta": "230 kg",
    "Dimensiones cesta (mm)": "1,4 x 0,7 m" } }]).richness.cases[0]!;
  assert.equal(complete.essentials.every(({ status }) => status === "observada"), true);
});

test("familias contradictorias y desconocidas no se convierten en carencias; la distribución no penaliza densidad alta", () => {
  const rich = { ...candidate("densa", { "Profundidad máxima de excavación": "3000 mm", "Peso (kg)": "3500 kg", "Potencia del motor": "20 kW",
    "Anchura (mm)": "1500 mm", "Longitud (mm)": "3500 mm", "Altura (mm)": "2000 mm" }), title: "Excavadora", category: "Excavadoras" };
  const products = [rich, { ...candidate("contradiccion", {}), title: "Plataforma de tijera", category: "Excavadoras" },
    { ...candidate("accesorio", {}), title: "Martillo para miniexcavadora", category: null }, candidate("desconocida", {})];
  const report = analyzeTechnicalDensity(products).richness;
  assert.equal(report.cases.find(({ reference }) => reference === "densa")?.essentials.every(({ status }) => status === "observada"), true);
  assert.equal(report.totals.conflictingFamily, 1);
  assert.equal(report.totals.unknownFamily, 1);
  assert.equal(report.totals.withoutFamilyCriteria, 1);
  assert.equal(report.cases.filter(({ familyStatus }) => familyStatus !== "identificada").every(({ essentials }) => essentials.length === 0), true);
  assert.equal(report.totals.high, 1);
  assert.equal(report.families.find(({ name }) => name === "excavadoras y miniexcavadoras")?.medium, 1);
  assert.deepEqual(analyzeTechnicalDensity([...products].reverse()).richness, report);
  assert.deepEqual(analyzeTechnicalDensity([]).richness.totals.p50, null);
});


test("los rangos, la potencia con ámbito propio y las dimensiones compuestas no se fusionan por semejanza", () => {
  const product = { ...candidate("alcances", { "Velocidad de desplazamiento (km/h)": "15–16 km/h (rango publicado)",
    "Potencia del motor de tracción": "12 kW", "Potencia del motor de elevación": "12 kW",
    "Dimensiones cesta (mm)": "1,4 x 0,7 m", "Dimensiones horquillas (mm)": "1400 x 700 x 50 mm" }),
    title: "Brazo articulado", category: null };
  const item = analyzeTechnicalDensity([product]).richness.cases[0]!;
  assert.equal(item.family, "plataformas articuladas");
  assert.equal(item.interpretedConcepts, 5);
  assert.equal(item.aliases.length, 0);
});


test("las declaraciones contradictorias de una misma ficha impiden acreditar su familia", () => {
  const item = { ...candidate("inconsistente", { "Título adicional": "Plataforma de tijera" }), title: "Excavadora", category: null };
  const ambiguous = { ...item, spec: {}, title: "Excavadora plataforma de tijera" };
  for (const product of [item, ambiguous]) {
    const result = analyzeTechnicalDensity([product]).richness.cases[0]!;
    assert.equal(result.familyStatus, "contradictoria");
    assert.equal(result.essentials.length, 0);
  }
});


test("la equivalencia entre metros y milímetros reutiliza la conversión exacta y la prioridad familiar alcanza fichas densas", () => {
  const product = { ...candidate("prioridad", { "Altura de trabajo (mm)": "1001 mm", "Altura de trabajo (m)": "1,001 m",
    "Anchura (mm)": "1000 mm", "Longitud (mm)": "3000 mm", "Altura (mm)": "2000 mm", "Peso (kg)": "1500 kg",
    "Potencia del motor": "12 kW", "Elevación libre disponible": false }), title: "Plataforma de tijera", category: null };
  const report = analyzeTechnicalDensity([product]);
  assert.equal(report.target.below, 0);
  assert.equal(report.richness.cases[0]?.aliases[0]?.status, "acreditada");
  assert.equal(report.richness.totals.essentialUnobservedProducts, 1);
  assert.deepEqual(report.richness.essentialPriorities.map(({ key, priority, notObserved }) => [key, priority, notObserved]),
    [["capacidad", "P1", 1], ["dimensiones_plataforma", "P1", 1]]);
});
