import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { parseCanonicalCatalog } from "../../canonical-catalog.js";
import { buildProductIdentity } from "../../identity.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { compareInterventionScripts } from "../comparison.js";
import { formatInterventionComparison } from "../../../cli/reporting/intervention-comparison.js";
import type { ManualInterventionProposal } from "../contracts.js";
import { simulateIntervention } from "../simulation.js";

const product: ProductRecord = {
  providerId: "gam", categoryKey: "maquinas", categoryName: "Máquinas",
  url: "https://proveedor.example/6002", title: "Carretilla", shortDescription: null,
  longDescription: null, price: null, reference: "6002", brand: "YALE", model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://proveedor.example/foto.jpg", images: ["https://proveedor.example/foto.jpg"],
  specs: { Marca: "YALE" }
};
const identity = buildProductIdentity(product).key;
const proposal = (field: ManualInterventionProposal["field"], expected: string, next: string,
  productIdentity = identity): ManualInterventionProposal => ({
  providerId: "gam", identity: productIdentity, field, expected, next,
  reason: "Ficha contrastada", evidence: "https://proveedor.example/6002"
});
const brand = proposal("brand", "YALE", "HYSTER");
const spec = proposal("spec:Marca", "YALE", "HYSTER");
const catalog = (current: ProductRecord) => parseCanonicalCatalog({
  version: 1, providerId: "gam", prefix: "gam-comparison", scope: "0123456789abcdef",
  startedAt: "2026-10-25T10:00:00.000Z", endedAt: "2026-10-25T10:02:00.000Z",
  quality: { status: "complete", published: true }, productCount: 1, products: [current]
});
const selected = (changes: readonly ManualInterventionProposal[], script = "interventions/gam/6002.ts") =>
  ({ script, proposals: changes });

test("comparación: identifica pendiente, corregida, ausente y divergente sin alterar el origen", () => {
  const source = catalog(product);
  const before = JSON.stringify(source);
  const pending = compareInterventionScripts(source, [selected([brand, spec])]);
  assert.equal(pending.scripts[0]?.status, "pending");
  assert.deepEqual(pending.pending, [brand, spec]);
  assert.equal(pending.blocked, false);
  const plan = simulateIntervention(source, createHash("sha256").update("origen").digest("hex"), pending.pending);
  assert.equal(plan.changes.length, 2);
  assert.equal(JSON.stringify(source), before);

  const corrected = compareInterventionScripts(catalog({ ...product, brand: "HYSTER", specs: { Marca: "HYSTER" } }),
    [selected([brand, spec])]);
  assert.equal(corrected.scripts[0]?.status, "corrected");
  assert.deepEqual(corrected.pending, []);
  assert.equal(corrected.blocked, false);

  const absent = compareInterventionScripts(source, [selected([proposal("brand", "YALE", "HYSTER", "gam:ref:no-existe")])]);
  assert.equal(absent.scripts[0]?.status, "absent");
  assert.deepEqual(absent.pending, []);
  assert.equal(absent.blocked, false);

  const divergent = compareInterventionScripts(catalog({ ...product, brand: "OTRA" }), [selected([brand, spec])]);
  assert.equal(divergent.scripts[0]?.status, "divergent");
  assert.equal(divergent.blocked, true);
  assert.deepEqual(divergent.pending, []);
  assert.match(formatInterventionComparison(divergent), /Actual: "OTRA".*Esperado: "YALE"/);
});

test("comparación: bloquea campos corregidos parcialmente en un mismo script", () => {
  const partial = compareInterventionScripts(catalog({ ...product, brand: "HYSTER" }), [selected([brand, spec])]);
  assert.equal(partial.scripts[0]?.status, "partial");
  assert.equal(partial.blocked, true);
  assert.deepEqual(partial.pending, []);
  assert.match(formatInterventionComparison(partial), /PARCIAL/);
});

test("comparación: compone solo scripts completamente pendientes y no duplica lo ya corregido", () => {
  const result = compareInterventionScripts(catalog(product), [
    selected([brand], "interventions/gam/6002.ts"),
    selected([proposal("model", "MODELO", "MODELO-CORREGIDO", "gam:ref:no-existe")], "interventions/gam/6003.ts")
  ]);
  assert.deepEqual(result.pending, [brand]);
  assert.deepEqual(result.scripts.map((script) => script.status), ["pending", "absent"]);
  assert.equal(result.blocked, false);
  const changed = compareInterventionScripts(catalog({ ...product, brand: "HYSTER" }), [
    selected([brand]), selected([spec], "interventions/gam/6003.ts")
  ]);
  assert.deepEqual(changed.pending, [spec]);
  assert.deepEqual(changed.scripts.map((script) => script.status), ["corrected", "pending"]);
});
