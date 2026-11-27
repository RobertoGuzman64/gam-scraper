import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { gapCheckCoverage, gapPopulation, reconcileGapCurrentEntries } from "../../../../catalog/diagnostics/coverage/content-gap-population.js";
import { loadGapComparison, loadGapCurrentPopulation, loadGapPublications } from "../../../../infrastructure/filesystem/preparation/content-gap-population.js";
import { writeCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/originals/canonical-catalog.js";
import { prepareSourceProduct } from "../../../../preparation/prepare-product.js";
import { writeTestPublicationVersion } from "../../../../testing/builders/publication-version-fixture.js";
import { buildProductIdentity } from "../../../../catalog/identity.js";
import { sha256 } from "../../../../catalog/editorial/campaign-accreditation.js";
import { discardedManainProductUrls } from "../../../../preparation/manain/discarded-urls.js";
import { activateTechnicalPublication } from "../../../../infrastructure/filesystem/catalog/publications/technical-publication.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { PreparationFingerprints, PreparationSource } from "../../../../preparation/documents/offline-document.js";

const fingerprints: PreparationFingerprints = { rulesVersion: 2, rulesSha256: "a".repeat(64) };
const source = (providerId: string, reference: string | null): ProductRecord => ({
  providerId, reference, url: `https://example.test/${providerId}/${reference ?? "sin-ref"}`,
  categoryKey: "plataformas", categoryName: "Plataformas", title: "Plataforma de tijera eléctrica",
  brand: "Marca", model: "Modelo", shortDescription: "Plataforma de tijera eléctrica", longDescription: null,
  price: null, year: null, location: null, country: null, horometer: null, serialNumber: null, image: null,
  specs: { "Altura de trabajo": "8 m" }
});
const writeOriginal = async (root: string, providerId: string, records: readonly ProductRecord[], endedAt: string): Promise<PreparationSource> => {
  const directory = join(root, "catalogs", "providers", providerId, "original");
  await mkdir(directory, { recursive: true });
  const prefix = `scrape-${providerId}`;
  const scope = "a".repeat(16);
  const startedAt = "2026-01-01T00:00:00Z";
  const catalogSha256 = await writeCanonicalCatalog(directory, prefix, scope, startedAt, endedAt, records);
  await writeFile(join(directory, `${prefix}-summary.json`), JSON.stringify({ startedAt, endedAt,
    quality: { status: "complete", published: true }, totals: { scrapedProducts: records.length }, artifacts: { catalogSha256 } }));
  return { providerId, prefix, scope, catalogSha256, productCount: records.length };
};
const writePublication = async (root: string, record: ProductRecord, provenance?: PreparationSource): Promise<void> => {
  const product = prepareSourceProduct(record).product;
  const hash = await writeTestPublicationVersion(root, product, { version: 1, runId: `fixture-${record.providerId}`,
    approved: true, approvalReason: "Prueba sintética", sources: [], exclusions: [] });
  if (provenance) {
    const path = join(root, "catalogs", "providers", record.providerId, "publications", hash, "manifest.json");
    const manifest: unknown = JSON.parse(await readFile(path, "utf8"));
    assert.ok(manifest && typeof manifest === "object" && !Array.isArray(manifest));
    await writeFile(path, JSON.stringify({ ...manifest, source: provenance }));
  }
};

const writePartialManain = async (root: string, original: ProductRecord): Promise<void> => {
  const prepared = prepareSourceProduct(original);
  const sourceCsvSha256 = "b".repeat(64);
  const totals = { ready: prepared.status === "ready" ? 1 : 0, review: prepared.status === "review" ? 1 : 0 };
  const discoveredProductUrls = 1 + discardedManainProductUrls.length;
  const raw = JSON.stringify({ providerId: original.providerId, quality: { status: "partial", published: false },
    sourceCsvSha256, discoveredProductUrls, discardedUrls: discardedManainProductUrls, totals, products: [{ original, prepared }] });
  const directory = join(root, "catalogs", "providers", original.providerId, "records");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "manain-record.json"), raw);
  await activateTechnicalPublication(root, { version: 1, providerId: "manain", quality: "partial",
    source: { kind: "manain-record", recordSha256: sha256(raw), sourceCsvSha256, rulesSha256: fingerprints.rulesSha256,
      discoveredProductUrls, discardedUrls: discardedManainProductUrls }, totals,
    identities: [buildProductIdentity(original).key], products: [prepared] });
};

test("huecos distingue selección explícita, fuente ausente, registro parcial y cobertura no evaluable", () => {
  const gam = { providerId: "gam", state: "evaluado", eligible: 2, evaluated: 2 } as const;
  const explicit = gapPopulation([gam], [gam.providerId]);
  assert.equal(explicit.scope, "seleccion");
  assert.equal(explicit.complete, true);
  assert.equal(explicit.excluded.length, explicit.expected.length - 1);
  const global = gapPopulation([gam, { providerId: "manain", state: "parcial", eligible: 3, evaluated: 1 },
    { providerId: "gomariz", state: "error", eligible: 1, evaluated: 0 }]);
  assert.equal(global.scope, "global");
  assert.equal(global.complete, false);
  assert.equal(global.totals.eligible, null);
  assert.equal(global.totals.knownNotEvaluated, 3);
  assert.equal(global.providers.find((item) => item.providerId === "mercaeleva")?.state, "ausente");
  assert.equal(gapCheckCoverage(global, 1, 2, "fuera_del_objetivo_minimo").eligible, null);
  assert.equal(gapCheckCoverage(global, 1, 2, "fuera_del_objetivo_minimo").knownNotEvaluable, 3);
});

test("huecos conserva las publicaciones acreditadas aunque una versión histórica no pueda conciliarse", async () => {
  const root = await mkdtemp(join(tmpdir(), "huecos-poblacion-"));
  try {
    const published = source("gomariz", "fixture-1");
    const review = source("gomariz", null);
    const records = [published, review];
    const provenance = await writeOriginal(root, published.providerId, records, "2026-01-02T00:00:00Z");
    await writePublication(root, published, provenance);
    await writePartialManain(root, source("manain", "fixture-partial"));
    const discovery = await loadGapPublications(root);
    assert.equal(discovery.population.totals.evaluated, 1);
    assert.equal(discovery.population.providers.find((item) => item.providerId === "gam")?.state, "ausente");
    const comparison = await loadGapComparison(root, discovery.publications);
    assert.equal(comparison.failures.length, 0);
    assert.equal(comparison.evaluated[0]?.provenance.originalSha256, provenance.catalogSha256);
    const current = await loadGapCurrentPopulation(root, fingerprints);
    const manain = current.evaluated.find((item) => item.provenance.source.providerId === "manain");
    assert.ok(manain?.provenance.source.record);
    assert.equal(manain.provenance.source.record.discoveredProductUrls, manain.entries.length + discardedManainProductUrls.length);
    assert.equal(manain.entries.length, 1);
    const entries = current.evaluated.flatMap((item) => item.entries);
    const reconcile = (matched: typeof comparison, sources: typeof current) => reconcileGapCurrentEntries(
      sources.evaluated.flatMap((item) => item.entries), matched.evaluated.flatMap((item) => item.inputs),
      discovery.publications.flatMap((item) => item.publication.products), [],
      new Map(sources.evaluated.map((item) => [item.provenance.source.providerId, item.provenance.source.catalogSha256])),
      new Map(matched.evaluated.map((item) => [item.provenance.providerId, item.provenance.originalSha256])));
    const report = reconcile(comparison, current);
    assert.equal(report.totals.matched, 1);
    assert.equal(report.cases.find((item) => item.identity === buildProductIdentity(review).key)?.state, "sin_publicacion");
    assert.equal(report.cases.find((item) => item.identity === buildProductIdentity(review).key)?.status, "review");
    const before = JSON.stringify(entries);
    const updated = await writeOriginal(root, published.providerId, records, "2026-01-03T00:00:00Z");
    assert.notEqual(updated.catalogSha256, provenance.catalogSha256);
    const historical = await loadGapComparison(root, discovery.publications);
    assert.equal(historical.evaluated.length, 0);
    assert.equal(historical.failures[0]?.category, "INCOMPLETE_SOURCE");
    const unmatched = reconcile(historical, await loadGapCurrentPopulation(root, fingerprints));
    assert.equal(unmatched.totals.unmatched, 1);
    assert.equal(unmatched.published.totals.unmatched, 1);
    assert.equal(JSON.stringify(entries), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("huecos distingue una reconstrucción permitida de una publicación ilegible sin ocultar los demás proveedores", async () => {
  const root = await mkdtemp(join(tmpdir(), "huecos-reconstruccion-"));
  try {
    const original = { ...source("mercaeleva", "fixture-reconstruction"), url: "https://sales.mercaeleva.com/es/for-sale/machine/fixture-reconstruction" };
    await writePublication(root, original);
    const invalid = join(root, "catalogs", "providers", "gam", "publications");
    await mkdir(invalid, { recursive: true });
    await writeFile(join(invalid, "active.json"), "{}");
    const discovery = await loadGapPublications(root);
    assert.equal(discovery.population.providers.find((item) => item.providerId === "gam")?.state, "error");
    assert.equal(discovery.population.totals.evaluated, 1);
    assert.equal(discovery.failures.length, 1);
    const comparison = await loadGapComparison(root, discovery.publications);
    assert.equal(comparison.evaluated[0]?.provenance.origin, "reconstruccion_publicada");
    assert.equal(comparison.evaluated[0]?.provenance.originalSha256, null);
    assert.equal(comparison.evaluated[0]?.inputs[0]?.origin, "reconstruccion_publicada");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("el ranking JSON de originales conserva todos los casos y no depende de --top", async () => {
  const root = await mkdtemp(join(tmpdir(), "huecos-ranking-"));
  try {
    const first = { ...source("gomariz", "ranking-1"), shortDescription: null, longDescription: null,
      title: "Equipo", brand: null, model: null, categoryKey: "sin-categoria", categoryName: "Sin categoría" };
    const second = { ...first, reference: "ranking-2", url: "https://example.test/gomariz/ranking-2" };
    await writeOriginal(root, first.providerId, [first, second], "2026-01-02T00:00:00Z");
    const cli = fileURLToPath(new URL("../audits/catalog-content-gaps.js", import.meta.url));
    const args = [cli, "--catalogo", join(root, "catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
      "--min-grupo", "1", "--min-ausentes", "1", "--json"];
    const execute = promisify(execFile);
    const parse = async (limit: string) => {
      const result: unknown = JSON.parse((await execute(process.execPath, [...args, "--top", limit])).stdout);
      assert.ok(result && typeof result === "object" && "prioritized" in result && "cases" in result && "version" in result);
      assert.ok(Array.isArray(result.prioritized) && result.prioritized.length > 1);
      assert.equal(result.version, 1);
      return result;
    };
    const a = await parse("1");
    const b = await parse("20");
    assert.deepEqual(a.prioritized, b.prioritized);
    assert.deepEqual(a.cases, b.cases);
  } finally { await rm(root, { recursive: true, force: true }); }
});
