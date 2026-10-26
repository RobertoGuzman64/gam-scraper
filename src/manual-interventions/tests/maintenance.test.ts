import assert from "node:assert/strict";
import test from "node:test";
import { parseCanonicalCatalog } from "../../catalog/canonical-catalog.js";
import { buildProductIdentity } from "../../catalog/identity.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CampaignCatalogObservation } from "../../pipeline/campaign/discovery.js";
import type { CatalogIntervention } from "../catalog.js";
import { assessInterventionMaintenance } from "../maintenance.js";

const product: ProductRecord = {
  providerId: "gam", categoryKey: "maquinas", categoryName: "Máquinas",
  url: "https://proveedor.example/6002", title: "Carretilla", shortDescription: null,
  longDescription: null, price: null, reference: "6002", brand: "YALE", model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://proveedor.example/foto.jpg", images: ["https://proveedor.example/foto.jpg"],
  specs: { Marca: "YALE" }
};
const unrelated: ProductRecord = { ...product, reference: "otra", url: "https://proveedor.example/otra" };
const proposal = {
  providerId: "gam", identity: buildProductIdentity(product).key, field: "brand" as const,
  expected: "YALE", next: "HYSTER", reason: "Contradicción acreditada",
  evidence: "https://proveedor.example/6002"
};
const intervention: CatalogIntervention = {
  script: "interventions/gam/6002.ts", metadata: { id: "gam-6002", summary: "Corrige marca" },
  providerId: "gam", identities: [proposal.identity], fields: ["brand"], proposals: [proposal]
};
const catalog = (prefix: string, products: readonly ProductRecord[]) => parseCanonicalCatalog({
  version: 1, providerId: "gam", prefix, scope: "0123456789abcdef",
  startedAt: `2026-10-${prefix === "nuevo" ? "26" : prefix === "anterior" ? "25" : "24"}T10:00:00.000Z`,
  endedAt: `2026-10-${prefix === "nuevo" ? "26" : prefix === "anterior" ? "25" : "24"}T10:02:00.000Z`,
  quality: { status: "complete", published: true }, productCount: products.length, products
});
const observations = (...catalogs: readonly (ReturnType<typeof catalog> | null)[]): readonly CampaignCatalogObservation[] =>
  catalogs.map((item, index) => ({ runId: `lote-${index}`, catalog: item }));
const inspect = (entries: readonly CampaignCatalogObservation[]) => assessInterventionMaintenance([intervention], entries)[0]!;

test("mantenimiento: no propone retirada por una sola ausencia o una corrección en origen aislada", () => {
  const absent = inspect(observations(catalog("actual", [unrelated])));
  assert.equal(absent.status, "absent");
  assert.equal(absent.assessment, "keep");
  assert.equal(absent.consecutiveObservations, 1);
  const corrected = inspect(observations(catalog("actual", [{ ...product, brand: "HYSTER" }])));
  assert.equal(corrected.status, "corrected");
  assert.equal(corrected.assessment, "keep");
  assert.equal(corrected.consecutiveObservations, 1);
});

test("mantenimiento: solo permite plantear revisión con dos lotes originales distintos y consecutivos", () => {
  const repeated = inspect(observations(catalog("nuevo", [unrelated]), catalog("anterior", [unrelated])));
  assert.equal(repeated.assessment, "review");
  assert.equal(repeated.consecutiveObservations, 2);
  const resolved = inspect(observations(
    catalog("nuevo", [{ ...product, brand: "HYSTER" }]),
    catalog("anterior", [{ ...product, brand: "HYSTER" }])
  ));
  assert.equal(resolved.assessment, "review");
  assert.equal(resolved.status, "corrected");
  const missing = inspect(observations(catalog("nuevo", [unrelated]), null, catalog("antiguo", [unrelated])));
  assert.equal(missing.assessment, "keep");
  assert.equal(missing.consecutiveObservations, 1);
  const duplicate = inspect(observations(catalog("nuevo", [unrelated]), catalog("nuevo", [unrelated])));
  assert.equal(duplicate.assessment, "keep");
  const differentScope = inspect(observations(catalog("nuevo", [unrelated]),
    { ...catalog("anterior", [unrelated]), scope: "other-scope" }));
  assert.equal(differentScope.assessment, "keep");
  const previouslyPresent = inspect(observations(catalog("nuevo", [unrelated]), catalog("anterior", [product])));
  assert.equal(previouslyPresent.assessment, "keep");
});

test("mantenimiento: cambios que requieren intervención o revisión bloquean propuestas de retirada", () => {
  const pending = inspect(observations(catalog("nuevo", [product]), catalog("anterior", [unrelated])));
  assert.equal(pending.status, "pending");
  assert.equal(pending.assessment, "active");
  const inconsistent = inspect(observations(catalog("nuevo", [{ ...product, brand: "OTRA" }])));
  assert.equal(inconsistent.status, "divergent");
  assert.equal(inconsistent.assessment, "inconsistent");
  assert.throws(() => inspect(observations(null)), /campaña actual completa/);
});
