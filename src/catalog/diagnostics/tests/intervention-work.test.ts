import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { buildProductIdentity } from "../../identity.js";
import { applyInterventionToCatalog } from "../../interventions/application.js";
import type { ManualInterventionProposal } from "../../interventions/contracts.js";
import { simulateIntervention } from "../../interventions/simulation.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { measureAppliedIntervention } from "../intervention-work.js";
import { formatInterventionWork } from "../../../cli/reporting/intervention-work.js";

const item = (reference: string): ProductRecord => ({
  providerId: "gam", categoryKey: "maquinas", categoryName: "Máquinas", reference,
  url: `https://example.test/${reference}`, title: "Título original", shortDescription: "Texto existente",
  longDescription: null, brand: "Marca anterior", model: null, price: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: null, specs: { "Peso (kg)": "1000" }
});
const original = parseCanonicalCatalog({
  version: 1, providerId: "gam", prefix: "gam-intervention-work", scope: "0123456789abcdef",
  startedAt: "2026-10-25T10:00:00.000Z", endedAt: "2026-10-25T10:02:00.000Z",
  quality: { status: "complete", published: true }, productCount: 2,
  products: [item("M-1"), item("M-2")]
});
const sha = createHash("sha256").update("origen").digest("hex");
const identity = buildProductIdentity(original.products[0]!).key;
const proposal = (field: ManualInterventionProposal["field"], expected: ManualInterventionProposal["expected"], next: ManualInterventionProposal["next"]): ManualInterventionProposal => ({
  providerId: "gam", identity, field, expected, next,
  reason: "Corrección contrastada", evidence: "Fuente verificada"
});

test("aplicación verificada: cuenta máquinas únicas y campos realmente cambiados", () => {
  const changes = [
    proposal("shortDescription", "Texto existente", "Texto revisado"),
    proposal("longDescription", null, "Descripción incorporada"),
    proposal("title", "Título original", "Título ajustado"),
    proposal("spec:Peso (kg)", "1000", "1500"),
    proposal("brand", "Marca anterior", "Marca corregida")
  ];
  const simulation = simulateIntervention(original, sha, changes);
  const snapshot = JSON.stringify(original);
  const derived = applyInterventionToCatalog(original, simulation);
  const summary = measureAppliedIntervention(original, derived, simulation);
  assert.deepEqual(summary, {
    processedProducts: 2, transformedProducts: 1, technicalValuesTransformed: 1,
    descriptionsGenerated: 1, descriptionsTransformed: 1,
    titlesTransformed: 1, otherFieldsTransformed: 1
  });
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(measureAppliedIntervention(original, derived, simulation).transformedProducts, 1);
  assert.match(formatInterventionWork(summary).join("\n"), /Máquinas transformadas: 1/);
  assert.doesNotMatch(formatInterventionWork(summary).join("\n"), /SIMULADO|recuperadas/);
});

test("rechaza procedencia inconsistente y no transforma artificialmente un campo sin delta", () => {
  const simulation = simulateIntervention(original, sha, [proposal("title", "Título original", "Título ajustado")]);
  assert.throws(() => measureAppliedIntervention(original, original, simulation), /no coincide con el plan/);
  const derived = applyInterventionToCatalog(original, simulation);
  const invalid = parseCanonicalCatalog({ ...derived, prefix: "otro-prefijo" });
  assert.throws(() => measureAppliedIntervention(original, invalid, simulation), /no corresponden/);
  const unchanged = { ...simulation, changes: [{ ...simulation.changes[0]!, next: "Título original" }] };
  const result = measureAppliedIntervention(original, original, unchanged);
  assert.equal(result.transformedProducts, 0);
  assert.equal(result.titlesTransformed, 0);
});
