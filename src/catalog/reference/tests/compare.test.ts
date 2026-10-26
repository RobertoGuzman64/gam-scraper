import assert from "node:assert/strict";
import test from "node:test";
import { compareCampaignReferences } from "../compare.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import type { CanonicalCatalog } from "../../canonical-catalog.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const product = (providerId: string, reference: string | null, url: string): ProductRecord => ({
  providerId, reference, url, categoryKey: "equipos", categoryName: "Equipos",
  title: "Equipo", shortDescription: null, longDescription: null, price: null,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: "SERIE-COMPARTIDA", image: null,
  specs: { potencia: "10", capacidad: 12 }, scrapedAt: "2026-01-01T08:00:00Z"
});

const catalog = (providerId: string, products: readonly ProductRecord[], scope = "a".repeat(16)): CanonicalCatalog => ({
  version: 1, providerId, prefix: `extraccion-${providerId}`, scope,
  startedAt: "2026-01-01T08:00:00.000Z", endedAt: "2026-01-01T09:00:00.000Z",
  quality: { status: "complete", published: true }, productCount: products.length, products
});

const all = (gam: readonly ProductRecord[], scope?: string): readonly CanonicalCatalog[] =>
  CAMPAIGN_PROVIDERS.map((providerId) => catalog(providerId, providerId === "gam" ? gam :
    [product(providerId, "1", `https://ejemplo.test/${providerId}/1`)], scope));

test("sin referencia informa de inicialización sin inventar altas", () => {
  const result = compareCampaignReferences(null, null, "nuevo", all([
    product("gam", "1", "https://ejemplo.test/gam/1")
  ]));
  assert.equal(result.baseline, "initial");
  assert.equal(result.previousRunId, null);
  assert.equal(result.providers[0]?.currentCount, 1);
  assert.deepEqual(result.providers[0]?.added, []);
});

test("altas, ausencias, cambios de campos y ausencia de falsos positivos por orden o marcas temporales", () => {
  const kept = product("gam", "1", "https://ejemplo.test/gam/1");
  const modified = product("gam", "2", "https://ejemplo.test/gam/2");
  const previous = all([kept, modified, product("gam", "3", "https://ejemplo.test/gam/3")]);
  const current = all([
    product("gam", "4", "https://ejemplo.test/gam/4"),
    { ...modified, price: "200", specs: { capacidad: 15, potencia: "10" } },
    { ...kept, scrapedAt: "2026-01-02T09:00:00Z", specs: { capacidad: 12, potencia: "10" } }
  ]);
  const result = compareCampaignReferences("anterior", previous, "actual", current);
  const gam = result.providers[0];
  assert.ok(gam);
  assert.equal(gam.previousCount, 3);
  assert.equal(gam.currentCount, 3);
  assert.equal(gam.added.length, 1);
  assert.equal(gam.missing.length, 1);
  assert.equal(gam.modified.length, 1);
  assert.equal(gam.unchanged, 1);
  assert.deepEqual(gam.modified[0]?.fields.map((field) => field.field), ["price", "specs.capacidad"]);
  assert.deepEqual(gam.modified[0]?.fields[0]?.previous, { present: true, value: null });
  assert.deepEqual(gam.modified[0]?.fields[0]?.current, { present: true, value: "200" });
  assert.equal(result.providers[1]?.unchanged, 1);
});

test("no identifica por número de serie, pero detecta URLs e identidades contradictorias", () => {
  const older = all([product("gam", "1", "https://ejemplo.test/gam/1")]);
  const newer = all([product("gam", "2", "https://ejemplo.test/gam/2")]);
  const changes = compareCampaignReferences("a", older, "b", newer);
  assert.equal(changes.providers[0]?.added.length, 1);
  assert.equal(changes.providers[0]?.missing.length, 1);
  assert.throws(() => compareCampaignReferences("a", older, "b", all([
    product("gam", "2", "https://ejemplo.test/gam/1")
  ])), /contradictoria/);
  assert.throws(() => compareCampaignReferences(null, null, "b", all([
    product("gam", "1", "https://ejemplo.test/gam/1"),
    product("gam", "2", "https://ejemplo.test/gam/1")
  ])), /URL de inventario compartida/);
});

test("identidad sin referencia usa URL normalizada; un campo opcional ausente es distinto de null", () => {
  const original = product("gam", null, "https://ejemplo.test/gam/a?origen=uno");
  const updated = { ...original, url: "https://ejemplo.test/gam/a?origen=dos", priceText: null };
  const report = compareCampaignReferences("a", all([original]), "b", all([updated]));
  assert.deepEqual(report.providers[0]?.modified[0]?.fields.map((field) => field.field), ["priceText"]);
  assert.deepEqual(report.providers[0]?.modified[0]?.fields[0]?.previous, { present: false });
  assert.deepEqual(report.providers[0]?.modified[0]?.fields[0]?.current, { present: true, value: null });
});

test("bloquea ámbitos incompatibles y proveedores ausentes", () => {
  assert.throws(() => compareCampaignReferences("a", all([
    product("gam", "1", "https://ejemplo.test/gam/1")
  ]), "b", all([product("gam", "1", "https://ejemplo.test/gam/1")], "b".repeat(16))), /Ámbito/);
  assert.throws(() => compareCampaignReferences(null, null, "b", all([]).slice(0, 2)), /tres proveedores/);
});
