import assert from "node:assert/strict";
import test from "node:test";
import { analyzePublishedTechnicalQuality } from "../published-technical-quality.js";
import { formatPublishedTechnicalQualityReport } from "../../../cli/commands/catalog/published-technical-quality-report.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";

const product = (reference: string, spec: ImportCandidate["spec"],
  providerId = "gam"): ImportCandidate => ({
  providerId, sourceUrl: `https://example.com/machine/${reference}`, reference,
  title: `Máquina ${reference}`, categorySellID: null, category: "Elevación", condition: "Segunda_Mano",
  price: null, description_title: null, description: null, description_general: null,
  image: null, images: [], spec, attributes: []
});

test("la auditoría semántica identifica valores incoherentes, agrupa causas y recomienda investigar", () => {
  const inputs = [
    product("1", { "Altura plataforma": "2240 metros" }),
    product("2", { "Altura plataforma": "2600 metros" }),
    product("3", { "Radio de giro": "24 V" }),
    product("4", { "Altura de trabajo": "8 m", Capacidad: "200 kg" })
  ];
  const before = JSON.stringify(inputs);
  const report = analyzePublishedTechnicalQuality(inputs);
  assert.deepEqual(report.totals, { products: 4, affectedProducts: 3, findings: 3 });
  assert.deepEqual(report.patterns.map((item) => [item.code, item.products]), [
    ["spec:longitud-fisicamente-implausible", 2], ["spec:magnitud-en-campo-incompatible", 1]
  ]);
  assert.equal(report.cases[0]?.key, "Altura plataforma");
  assert.match(report.cases[0]?.detail ?? "", /2240 metros/);
  assert.match(report.patterns[0]?.action ?? "", /normalizador/);
  assert.equal(report.patterns[0]?.priority, "media");
  assert.match(report.patterns[0]?.responsible ?? "", /normalización técnica/);
  assert.match(formatPublishedTechnicalQualityReport(report, 2).join("\n"), /prioridad media/);
  assert.equal(JSON.stringify(inputs), before);
  assert.match(formatPublishedTechnicalQualityReport(report, 2, true).join("\n"), /CASO.*2240 metros/);
});

test("los conflictos entre título y capacidad técnica son señales de revisión, no correcciones", () => {
  const mismatch = { ...product("5", { "Capacidad de carga (kg)": "2.500 kg" }),
    title: "Carretilla eléctrica 3.000 kg" };
  const report = analyzePublishedTechnicalQuality([mismatch]);
  assert.deepEqual(report.cases.map((issue) => issue.code), ["capacidad-titulo-spec-discordante"]);
  assert.match(report.cases[0]?.detail ?? "", /2\.500 kg/);
  assert.match(report.patterns[0]?.action ?? "", /configuración/);
  assert.deepEqual(analyzePublishedTechnicalQuality([{ ...mismatch, title: "Carretilla eléctrica 2.500 kg" }]).cases, []);
});

test("reutiliza las comprobaciones técnicas de motorización y alturas sin modificar las publicaciones", () => {
  const motor = product("m", { "Tipo motor": "Diésel", Motorización: "Eléctrico" });
  const height = {
    ...product("h", { "Altura plataforma": "11 m", "Altura de trabajo": "10 m" }, "gomariz"),
    sourceUrl: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/ejemplo"
  };
  const report = analyzePublishedTechnicalQuality([motor, height]);
  assert.deepEqual(report.cases.map((issue) => issue.code), ["relacion-motorizacion", "relacion-alturas"]);
  assert.deepEqual(report.totals, { products: 2, affectedProducts: 2, findings: 2 });
  assert.equal(report.patterns[0]?.priority, "alta");
  assert.match(formatPublishedTechnicalQualityReport(report, 2).join("\n"), /Revisar: evidencia de origen/);
});

test("ausencia de evidencia, posibles duplicados y salida vacía son tratados de forma conservadora", () => {
  const a = product("a", { "Altura de trabajo": "12 m" });
  const report = analyzePublishedTechnicalQuality([a]);
  assert.deepEqual(report.cases, []);
  assert.match(formatPublishedTechnicalQualityReport(report, 10).join("\n"), /Sin anomalías reconocidas/);
  assert.throws(() => analyzePublishedTechnicalQuality([a, a]), /Identidad duplicada/);
});

test("identifica magnitudes cruzadas y baterías que repiten el peso sin modificar las fichas", () => {
  const inputs = [
    product("2241", { "Centro de carga": "8895 mm", Longitud: "3242 mm", "Altura Plataforma": "14 metros" }),
    product("2300", { "Centro de carga": "5076 mm", Longitud: "2892 mm",
      "Radio de giro": "24V / 400Ah(V/Ah)", "Capacidad de la batería": "2280" }),
    product("2242", { Peso: "545 KG", "Capacidad de la batería": "545",
      "Altura Plataforma": "24V / 150-375Ah (V/Ah) metros" }),
    product("2246", { Peso: "1.010 kg", "Capacidad de la batería": "1010",
      "Altura Plataforma": "24V / 465Ah(V/Ah) metros" }),
    product("2250", { Peso: "678 KG", "Capacidad de la batería": "785",
      "Altura Plataforma": "24V / 315-500Ah(V/Ah) metros" })
  ];
  const before = JSON.stringify(inputs);
  const report = analyzePublishedTechnicalQuality(inputs);
  const codes = (reference: string): readonly string[] => report.cases
    .filter((issue) => issue.reference === reference).map((issue) => issue.code);
  assert.deepEqual(codes("2241"), ["spec:centro-carga-supera-longitud"]);
  assert.deepEqual(codes("2300"), [
    "spec:capacidad-bateria-sin-unidad-con-alternativa", "spec:centro-carga-supera-longitud",
    "spec:magnitud-en-campo-incompatible"
  ]);
  assert.deepEqual(codes("2242"), ["spec:capacidad-bateria-coincide-peso", "spec:magnitud-en-campo-incompatible"]);
  assert.deepEqual(codes("2246"), codes("2242"));
  assert.deepEqual(codes("2250"), [
    "spec:capacidad-bateria-sin-unidad-con-alternativa", "spec:magnitud-en-campo-incompatible"
  ]);
  assert.match(report.cases.find((issue) => issue.reference === "2242" &&
    issue.code === "spec:capacidad-bateria-coincide-peso")?.detail ?? "", /«Peso»: "545 KG"/);
  assert.equal(report.patterns.find((item) => item.code === "spec:centro-carga-supera-longitud")?.priority, "alta");
  assert.equal(JSON.stringify(inputs), before);
});

test("detecta unidades repetidas y centinelas sin confundir medidas legítimas", () => {
  const report = analyzePublishedTechnicalQuality([
    product("2220", { "Centro de carga": "500mm mm" }),
    product("1714", { "Centro de carga": "600mm mm" }),
    product("M062-8951", { "Distancia del centro de gravedad": "−1 mm" }, "mercaeleva"),
    product("M119-9334", { "Horas laborales": "−1 h" }, "mercaeleva"),
    product("correcto", { "Centro de carga": "500 mm", Longitud: "3242 mm", Peso: "545 KG",
      "Capacidad de la batería": "240 Ah", "Horas laborales": "1 h", Temperatura: "-1 °C" })
  ]);
  assert.deepEqual(report.cases.map((item) => [item.reference, item.code, item.key]), [
    ["1714", "spec:unidad-tecnica-duplicada", "Centro de carga"],
    ["2220", "spec:unidad-tecnica-duplicada", "Centro de carga"],
    ["M062-8951", "spec:valor-centinela-no-utilizable", "Distancia del centro de gravedad"],
    ["M119-9334", "spec:valor-centinela-no-utilizable", "Horas laborales"]
  ]);
  assert.equal(report.totals.affectedProducts, 4);
  assert.match(report.patterns.find((item) => item.code === "spec:valor-centinela-no-utilizable")?.action ?? "", /centinela/);
});
