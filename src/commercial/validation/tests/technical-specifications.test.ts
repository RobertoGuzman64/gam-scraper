import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { analyzePresentationConsistency } from "../../diagnostics/presentation-consistency.js";
import { hasLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../technical-specifications.js";
import { projectPresentableSpecifications } from "../../projection/spec-projection.js";

const publication = async (providerId: string): Promise<readonly ImportCandidate[]> => {
  const path = await resolveAccreditedPublication(process.cwd(), providerId);
  assert.ok(path, providerId);
  return (await readAccreditedPublication(path)).products;
};

const knownTechnicalReferences = ["2242", "2243", "2244", "2245", "2246", "2247", "2248", "2249", "2250",
  "2300", "2301", "2263", "2265", "2267", "2302", "2305", "6114", "6115", "2130", "72", "73"];
const knownCapacityReferences = ["gam:1145", "gam:6514", "gam:6837", "mercaeleva:M062-8951", "mercaeleva:M119-9334"];

test("la proyección comercial oculta las 21 especificaciones corruptas vigentes sin alterar evidencias", async () => {
  const products = await publication("gam");
  const snapshot = JSON.stringify(products);
  const byReference = new Map(products.map((product) => [product.reference, product]));
  const affected = products.filter((product) => inspectTechnicalSpecifications(product.spec).length > 0);
  assert.deepEqual(affected.map((product) => product.reference).sort(), [...knownTechnicalReferences].sort());
  for (const reference of knownTechnicalReferences) {
    const product = byReference.get(reference);
    assert.ok(product, reference);
    const issues = inspectTechnicalSpecifications(product.spec);
    assert.ok(issues.length > 0, reference);
    const safe = projectPresentableSpecifications(product.spec);
    assert.deepEqual(inspectTechnicalSpecifications(safe), []);
    for (const issue of issues) {
      assert.ok(issue.key in product.spec, reference);
      assert.ok(!(issue.key in safe), `${reference}:${issue.key}`);
    }
    for (const key of Object.keys(safe)) assert.deepEqual(safe[key], product.spec[key]);
  }
  assert.equal(JSON.stringify(products), snapshot);
});

test("las cinco discrepancias de capacidad quedan en revisión, sin fijar automáticamente la capacidad nominal", async () => {
  const products = [...await publication("gam"), ...await publication("mercaeleva")];
  const flagged = products.filter(hasLoadCapacityDisagreement).map((product) => `${product.providerId}:${product.reference}`);
  assert.deepEqual(flagged.sort(), [...knownCapacityReferences].sort());
  const report = analyzePresentationConsistency(products);
  const capacity = report.findings.filter((item) => item.code === "capacidad-titulo-spec-discordante");
  assert.equal(capacity.length, knownCapacityReferences.length);
  assert.ok(capacity.every((item) => item.status === "revisar"));
});

test("no bloquea medidas físicas válidas ni transforma implícitamente metros a milímetros", () => {
  const spec = {
    "Altura Plataforma": "9,5 metros",
    "Radio de giro": "1,98 m",
    "Radio de giro (exterior)": "1601 mm",
    "Capacidad de la batería": "24 V / 400 Ah",
    "Altura de elevación (mm)": "16900 mm",
    "Número de serie": "12345"
  };
  assert.deepEqual(inspectTechnicalSpecifications(spec), []);
  assert.deepEqual(projectPresentableSpecifications(spec), spec);
  assert.deepEqual(projectPresentableSpecifications({
    ...spec, "Altura Plataforma": "9225 metros", "Radio de giro": "24V / 400Ah(V/Ah)",
    "Capacidad de la batería": "1000mm", "Altura de elevación (mm)": "#VALUE! mm"
  }), {
    "Radio de giro (exterior)": "1601 mm", "Número de serie": "12345"
  });
});

test("retiene completos los campos multivalor válidos y excluye campos con residuos parciales", () => {
  assert.deepEqual(projectPresentableSpecifications({
    "Altura Plataforma": ["8 m", "24 V / 400 Ah"],
    "Capacidad de la batería": ["24 V / 400 Ah", "48 V / 500 Ah"],
    "Radio de giro": "6085mm metros",
    "Anchura": "24V / 840-1000Ah(V/Ah)",
    Modelo: "MPC14"
  }), { "Capacidad de la batería": ["24 V / 400 Ah", "48 V / 500 Ah"], Modelo: "MPC14" });
});
