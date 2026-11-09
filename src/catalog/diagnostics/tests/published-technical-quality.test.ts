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
