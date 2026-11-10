import assert from "node:assert/strict";
import test from "node:test";
import { prioritizeCommercialInterventions } from "../commercial-intervention-priorities.js";

const fixture = () => ({
  outputConsistencyAudit: {
    signals: [{ reason: "modelo-variante-titulo-contradictorio" as const, affected: 2,
      examples: ["https://example.org/1", "https://example.org/2"] }],
    findings: [{ reason: "modelo-variante-titulo-contradictorio" as const, reference: "1",
      sourceUrl: "https://example.org/1", field: "title" as const,
      evidence: ["B-LIFT 18HD", "B-LIFT 18HV"] }]
  },
  crossCoverageAudit: { signals: [
    { area: "imagenes" as const, reason: "imagen-de-otro-modelo", origin: "introducida" as const,
      affected: 1, examples: ["https://example.org/3"] },
    { area: "editorial" as const, reason: "general_repetida_entre_modelos", origin: "heredada" as const,
      affected: 7, examples: ["https://example.org/4"] },
    { area: "identidad" as const, reason: "referencia-visible-formato-ambiguo", origin: "heredada" as const,
      affected: 2, examples: ["https://example.org/5"] }
  ] },
  presentationAudit: { signals: [{ reason: "descripcion-general-posiblemente-truncada" as const,
    affected: 5, examples: ["https://example.org/6"] }] },
  accreditation: {
    blocking: [],
    pending: [
      { reason: "especificaciones-incompatibles-filtradas", affected: 21, examples: ["https://example.org/7"] },
      { reason: "capacidad-titulo-spec-discordante", affected: 3, examples: ["https://example.org/8"] }
    ]
  },
  attributeAudit: { validationIssues: [] }
});

test("ordena problemas por prioridad y conserva las evidencias reales sin sumar fichas repetidas", () => {
  const input = fixture();
  const original = JSON.stringify(input);
  const report = prioritizeCommercialInterventions(input);
  assert.deepEqual(report.pending.map((item) => [item.priority, item.source, item.affected]), [
    ["alta", "salida", 2], ["alta", "transversal", 1],
    ["media", "editorial", 5], ["media", "acreditacion", 3],
    ["media", "transversal", 2], ["baja", "transversal", 7]
  ]);
  assert.match(report.pending[0]?.evidence[0] ?? "", /18HD <> B-LIFT 18HV/);
  assert.match(report.pending[1]?.action ?? "", /Contrastar la propiedad de la imagen/);
  assert.match(report.pending.find((item) => item.reason.startsWith("identidad"))?.action ?? "", /no fusionar/);
  assert.equal(report.controlled[0]?.affected, 21);
  assert.equal(report.controlled[0]?.priority, "controlada");
  assert.deepEqual(prioritizeCommercialInterventions(input), report);
  assert.equal(JSON.stringify(input), original);
});

test("no confunde ausencia de señales con acreditación semántica ni inventa propuestas", () => {
  const input = fixture();
  assert.deepEqual(prioritizeCommercialInterventions({
    ...input, outputConsistencyAudit: { signals: [], findings: [] }, crossCoverageAudit: { signals: [] },
    presentationAudit: { signals: [] }, accreditation: { blocking: [], pending: [] }
  }), { pending: [], controlled: [] });
});

test("prioriza infracciones contractuales y atributos rechazados sin crear un auditor nuevo", () => {
  const report = prioritizeCommercialInterventions({
    ...fixture(),
    outputConsistencyAudit: { signals: [], findings: [] },
    crossCoverageAudit: { signals: [] }, presentationAudit: { signals: [] },
    accreditation: { blocking: [{ reason: "campo-title-perdido", affected: 1, examples: ["https://example.org/10"] }], pending: [] },
    attributeAudit: { validationIssues: [{ reason: "resuelto-no-asignado", affected: 2,
      examples: [{ reference: "21", sourceUrl: "https://example.org/21", sourceCategory: "test",
        status: "resuelto-no-asignado" }] }] }
  });
  assert.deepEqual(report.pending.map((item) => [item.priority, item.source, item.reason]), [
    ["alta", "acreditacion", "campo-title-perdido"], ["media", "atributos", "resuelto-no-asignado"]
  ]);
  assert.deepEqual(report.pending[1]?.examples, ["https://example.org/21"]);
});

test("separa diferencias de prefijo controladas de portadas ajenas y variantes sin acreditar", () => {
  const input = fixture();
  const report = prioritizeCommercialInterventions({
    ...input,
    outputConsistencyAudit: { signals: [], findings: [] },
    presentationAudit: { signals: [] },
    accreditation: { blocking: [], pending: [] },
    crossCoverageAudit: { signals: [
      { area: "imagenes", reason: "portada-prefijo-distinto", origin: "heredada", affected: 3,
        examples: ["https://example.org/TE1756"] },
      { area: "imagenes", reason: "portada-referencia-ajena", origin: "heredada", affected: 1,
        examples: ["https://example.org/CC1666"] },
      { area: "identidad", reason: "modelo-titulo-spec-discordante", origin: "heredada", affected: 1,
        examples: ["https://example.org/6934"] }
    ] }
  });
  assert.deepEqual(report.pending.map((item) => [item.priority, item.reason]), [
    ["media", "identidad:modelo-titulo-spec-discordante:heredada"],
    ["media", "imagenes:portada-referencia-ajena:heredada"]
  ]);
  assert.deepEqual(report.controlled.map((item) => [item.affected, item.reason]), [
    [3, "imagenes:portada-prefijo-distinto:heredada"]
  ]);
  assert.match(report.pending[0]?.action ?? "", /unidad origen/);
  assert.match(report.pending[1]?.action ?? "", /portada compartida/);
  const introduced = prioritizeCommercialInterventions({
    ...input, outputConsistencyAudit: { signals: [], findings: [] }, presentationAudit: { signals: [] },
    accreditation: { blocking: [], pending: [] },
    crossCoverageAudit: { signals: [{ area: "imagenes", reason: "portada-prefijo-distinto",
      origin: "introducida", affected: 1, examples: [] }] }
  });
  assert.equal(introduced.pending[0]?.priority, "alta");
});

test("las variantes reconocidas por coherencia permanecen visibles como controladas y reabren al caducar", () => {
  const sourceUrl = "https://example.org/maquina/6934";
  const signal = { area: "identidad" as const, reason: "modelo-titulo-spec-discordante", origin: "heredada" as const,
    affected: 1, examples: [sourceUrl] };
  const finding = { reference: "6934", sourceUrl, area: signal.area, reason: signal.reason, origin: signal.origin };
  const input = { ...fixture(), outputConsistencyAudit: { signals: [], findings: [] },
    presentationAudit: { signals: [] }, accreditation: { blocking: [], pending: [] },
    crossCoverageAudit: { signals: [signal], findings: [finding] } };
  const pending = prioritizeCommercialInterventions(input);
  assert.deepEqual(pending.pending.map((item) => [item.reason, item.affected]), [
    ["identidad:modelo-titulo-spec-discordante:heredada", 1]
  ]);
  const recognized = prioritizeCommercialInterventions({ ...input,
    controlledCoherence: new Set([JSON.stringify([sourceUrl, signal.reason])]) });
  assert.deepEqual(recognized.pending, []);
  assert.deepEqual(recognized.controlled.map((item) => [item.reason, item.affected]), [
    ["identidad:modelo-titulo-spec-discordante:heredada", 1]
  ]);
  assert.deepEqual(prioritizeCommercialInterventions({ ...input,
    controlledCoherence: new Set([JSON.stringify([sourceUrl, "otro-modelo"])]) }).pending, pending.pending);
});
