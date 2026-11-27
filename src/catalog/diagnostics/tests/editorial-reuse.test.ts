import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import {
  controlledGamForklift,
  controlledGomarizPlatform,
  controlledGomarizForklift,
  controlledMercaelevaForklift
} from "../../../preparation/editorial/core/editorial-contract-records.js";
import { analyzeEditorialReuse, analyzeEditorialKnowledgeUsage, analyzeEditorialKnowledgeComparison } from "../editorial/editorial-reuse.js";
import type { GapInput } from "../coverage/content-gaps-types.js";

const entry = (source: ProductRecord): GapInput => ({ source, prepared: prepareSourceProduct(source) });
const without = (input: GapInput, field: "description" | "description_general"): GapInput => ({
  ...input, prepared: { ...input.prepared, product: { ...input.prepared.product, [field]: null } }
});

test("diagnóstico: distingue capacidad editorial disponible, ausencia de aplicación y revisión", () => {
  const platform = entry(controlledGomarizPlatform());
  const missing = without(platform, "description");
  const report = analyzeEditorialReuse([missing]);
  assert.equal(report.totals.capacidad_disponible_sin_aplicar, 1);
  assert.deepEqual(report.cases.filter((item) => item.cause === "capacidad_disponible_sin_aplicar")
    .map((item) => [item.reference, item.field, item.family]),
  [[platform.source.reference, "description", "plataforma-tijera"]]);
  const review = analyzeEditorialReuse([{ ...missing, prepared: { ...missing.prepared,
    status: "review", issues: ["Dato técnico contradictorio"] } }]);
  assert.equal(review.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(review.totals.preparacion_en_revision, 1);
});

test("diagnóstico: rechaza identidades repetidas y preparaciones de otra unidad", () => {
  const first = entry(controlledGomarizPlatform());
  const other = entry({ ...controlledGomarizPlatform(),
    reference: "CONTROL-OTRA", url: "https://www.gomarizrent.com/producto/marca-modelo10-otra/" });
  assert.throws(() => analyzeEditorialReuse([first, first]), /duplicada/u);
  assert.throws(() => analyzeEditorialReuse([{ ...first, prepared: other.prepared }]), /discordante/u);
});

test("audita el contrato compartido de tres proveedores sin depender de un inventario congelado", () => {
  const inputs = [
    entry(controlledGamForklift()),
    entry(controlledGomarizPlatform()),
    entry(controlledMercaelevaForklift())
  ];
  const original = JSON.stringify(inputs);
  const report = analyzeEditorialReuse(inputs);
  assert.equal(report.analyzed, inputs.length);
  assert.equal(Object.values(report.totals).reduce((sum, value) => sum + value, 0), inputs.length * 2);
  assert.deepEqual(analyzeEditorialReuse([...inputs].reverse()), report);
  assert.equal(JSON.stringify(inputs), original);
});

test("un anuncio nuevo no hereda la identidad ajena y permite detectar pérdidas de contenido", () => {
  const original = controlledGomarizPlatform();
  const incoming: ProductRecord = {
    ...original,
    reference: "CONTROL-SEMANTICO-NUEVO",
    url: "https://www.gomarizrent.com/producto/marca-modelo10-nueva/"
  };
  const candidate = entry(incoming);
  const correct = analyzeEditorialReuse([candidate]);
  assert.equal(correct.analyzed, 1);
  assert.equal(correct.totals.capacidad_disponible_sin_aplicar, 0);
  const removed = without(candidate, "description");
  const missing = analyzeEditorialReuse([removed]);
  assert.equal(missing.totals.capacidad_disponible_sin_aplicar, 1);
  assert.deepEqual(missing.cases.filter((item) => item.cause === "capacidad_disponible_sin_aplicar")
    .map((item) => [item.providerId, item.reference, item.field]),
  [["gomariz", incoming.reference, "description"]]);
  const review = analyzeEditorialReuse([{ ...removed, prepared: { ...removed.prepared,
    status: "review", issues: ["Dato técnico contradictorio"] } }]);
  assert.equal(review.totals.capacidad_disponible_sin_aplicar, 0);
  assert.equal(review.totals.preparacion_en_revision, 1);
  const unknown: ProductRecord = { ...incoming, url: "https://example.invalid/ficha/control-nueva" };
  const invalid = entry(unknown);
  const noSource = analyzeEditorialReuse([without(without(invalid, "description"), "description_general")]);
  assert.equal(noSource.totals.origen_no_validado, 2);
  assert.equal(noSource.totals.capacidad_disponible_sin_aplicar, 0);
});

test("aprovechamiento: encuentra una afirmación acreditada ausente de una general no vacía", () => {
  const input = entry({ ...controlledGomarizPlatform(), longDescription: "La máquina dispone de mandos proporcionales." });
  const changed = { ...input, prepared: { ...input.prepared, product: { ...input.prepared.product,
    description_general: "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m y capacidad de 450 kg." } } };
  const original = JSON.stringify(changed);
  const report = analyzeEditorialKnowledgeUsage([changed]);
  const general = report.cases.find((item) => item.field === "description_general");
  assert.equal(general?.state, "oportunidad_respaldada");
  assert.equal(general?.evidence?.[0]?.mechanism, "afirmaciones_de_origen");
  assert.match(general?.evidence?.[0]?.candidate ?? "", /mandos proporcionales/u);
  assert.equal(report.affected.opportunities, 1);
  assert.equal(JSON.stringify(changed), original);
  assert.equal(analyzeEditorialKnowledgeUsage([input]).totals.oportunidad_respaldada, 0);
  const equivalent = { ...changed, prepared: { ...changed.prepared, product: { ...changed.prepared.product,
    description_general: `${changed.prepared.product.description_general} Cuenta con controles proporcionales.` } } };
  assert.equal(analyzeEditorialKnowledgeUsage([equivalent]).totals.oportunidad_respaldada, 0);
});

test("aprovechamiento: una corta identifica la unidad y puede omitir una magnitud seleccionable", () => {
  const input = entry(controlledGomarizForklift());
  const changed = { ...input, prepared: { ...input.prepared, product: { ...input.prepared.product,
    description: "Carretilla elevadora MARCA MODELO10." } } };
  const report = analyzeEditorialKnowledgeUsage([changed]);
  const short = report.cases.find((item) => item.field === "description");
  assert.equal(short?.state, "oportunidad_respaldada");
  assert.equal(short?.evidence?.[0]?.mechanism, "resumen_tecnico_verificado");
  assert.match(short?.evidence?.[0]?.candidate ?? "", /4,5 m/u);
  assert.equal(analyzeEditorialKnowledgeUsage([input]).totals.oportunidad_respaldada, 0);
});

test("aprovechamiento: no presupone que todos los hechos deban constar en títulos y cortas", () => {
  const input = entry({ ...controlledGomarizPlatform(), specs: { ...controlledGomarizPlatform().specs, Peso: "2500 kg" } });
  const report = analyzeEditorialKnowledgeUsage([input]);
  assert.equal(report.byField.title.oportunidad_respaldada, 0);
  assert.equal(report.byField.description.oportunidad_respaldada, 0);
  assert.equal(Object.values(report.totals).reduce((a, b) => a + b, 0), 3);
  assert.equal(analyzeEditorialKnowledgeUsage([input], ["title"]).cases.length, 1);
});

test("aprovechamiento: excluye reconstrucciones, revisión e identidad o variante discordante", () => {
  const input = entry(controlledGomarizPlatform());
  const reconstructed = analyzeEditorialKnowledgeUsage([{ ...input, origin: "reconstruccion_publicada" }]);
  assert.equal(reconstructed.totals.no_evaluable, 3);
  assert.equal(analyzeEditorialKnowledgeUsage([{ ...input, prepared: { ...input.prepared, status: "review" } }]).totals.no_evaluable, 3);
  const changed = { ...input, prepared: { ...input.prepared, product: { ...input.prepared.product,
    title: "Plataforma de tijera eléctrica MARCA MODELO11" } } };
  assert.equal(analyzeEditorialKnowledgeUsage([changed]).totals.no_evaluable, 3);
  assert.throws(() => analyzeEditorialKnowledgeUsage([input, input]), /duplicada/u);
});

test("aprovechamiento: no transforma una diferencia textual sin traza en oportunidad acreditada", () => {
  const input = entry(controlledGomarizPlatform());
  const changed = { ...input, prepared: { ...input.prepared, product: { ...input.prepared.product,
    description_general: "La plataforma MARCA MODELO10 alcanza diez metros de trabajo y admite 450 kg." } } };
  const report = analyzeEditorialKnowledgeUsage([changed]);
  assert.equal(report.byField.description_general.hipotesis_composicion, 1);
  assert.equal(report.byField.description_general.oportunidad_respaldada, 0);
  const other = entry(controlledMercaelevaForklift());
  assert.deepEqual(analyzeEditorialKnowledgeUsage([changed, other]), analyzeEditorialKnowledgeUsage([other, changed]));
});

test("aprovechamiento: conserva la precisión del origen como hipótesis si la presentación final cambia sus claves", () => {
  const source = { ...controlledGomarizPlatform(), specs: { ...controlledGomarizPlatform().specs,
    Longitud: "2,5 m", "Longitud total": "2,5 m" } };
  const input = entry(source);
  const { "Longitud total": _total, ...spec } = input.prepared.product.spec;
  const changed = { ...input, prepared: { ...input.prepared, product: { ...input.prepared.product, spec,
    description_general: "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m, capacidad de 450 kg y longitud de 2,5 m." } } };
  const report = analyzeEditorialKnowledgeUsage([changed]);
  const general = report.cases.find((item) => item.field === "description_general");
  assert.equal(general?.state, "hipotesis_composicion");
  assert.match(general?.evidence?.[0]?.candidate ?? "", /longitud total/u);
});

test("aprovechamiento: conserva la identidad acreditada de Manain con título de origen limitado al modelo", () => {
  const source: ProductRecord = { ...controlledGomarizPlatform(), providerId: "manain", categoryKey: "venta",
    url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo10/", title: "MODELO10",
    specs: { Marca: "MARCA", Modelo: "MODELO10", Motor: "Eléctrico", Peso: "2000 kg",
      "Altura trabajo": "10 m", "Capacidad carga": "230 kg", "Nueva o usada": "usada" } };
  const input = entry(source);
  const report = analyzeEditorialKnowledgeUsage([{ ...input, origin: "registro_parcial_verificado" }]);
  assert.equal(report.analyzed, 1);
  assert.equal(report.totals.no_evaluable, 0);
  assert.equal(report.totals.oportunidad_respaldada, 0);
  const changed = { ...input, prepared: { ...input.prepared, product: { ...input.prepared.product,
    title: "Plataforma de tijera eléctrica MARCA MODELO11" } } };
  assert.equal(analyzeEditorialKnowledgeUsage([changed]).totals.no_evaluable, 3);
});

test("aprovechamiento: reutiliza únicamente entradas equivalentes y conserva cada cohorte y campo", () => {
  const platform = { ...entry(controlledGomarizPlatform()), origin: "original_canonico" as const };
  const forklift = { ...entry(controlledMercaelevaForklift()), origin: "original_canonico" as const };
  const current = [platform, forklift];
  const matched = [structuredClone(platform), { ...forklift, origin: "reconstruccion_publicada" as const }];
  const before = JSON.stringify({ matched, current });
  for (const fields of [undefined, ["title"] as const]) {
    const comparison = analyzeEditorialKnowledgeComparison(matched, current, fields);
    assert.deepEqual(comparison.matched, analyzeEditorialKnowledgeUsage(matched, fields));
    assert.deepEqual(comparison.current, analyzeEditorialKnowledgeUsage(current, fields));
    assert.equal(comparison.matched.cases.find((item) => item.providerId === forklift.source.providerId)?.state, "no_evaluable");
    const changed = { ...platform, prepared: { ...platform.prepared, status: "review" as const } };
    assert.deepEqual(analyzeEditorialKnowledgeComparison([changed], current, fields).matched, analyzeEditorialKnowledgeUsage([changed], fields));
    const changedSource = { ...platform, source: { ...platform.source, title: "Variante discordante" } };
    assert.deepEqual(analyzeEditorialKnowledgeComparison([changedSource], current, fields).matched, analyzeEditorialKnowledgeUsage([changedSource], fields));
    assert.throws(() => analyzeEditorialKnowledgeComparison([platform, platform], current, fields), /duplicada/u);
  }
  assert.equal(JSON.stringify({ matched, current }), before);
});
