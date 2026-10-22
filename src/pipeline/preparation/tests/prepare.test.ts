import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { writeOutputs } from "../../publication/publish.js";
import { prepareSavedCatalog } from "../prepare.js";
import { compareOfflinePreparations } from "../../../catalog/import/preparation/offline-diagnostics.js";
import { buildSourceTriage } from "../../../catalog/diagnostics/source-triage.js";
import { readOfflinePreparation } from "../../../infrastructure/filesystem/offline-preparation.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/canonical-catalog.js";

const category: CategoryConfig = { key: "maquinas", name: "Maquinaria de ocasión", url: "https://example.test/maquinas" };
const when = "2026-10-21T12:00:00Z";
const machine = (n: number, price: string | null = null): ProductRecord => ({
  providerId: "gam", categoryKey: category.key, categoryName: category.name,
  url: `https://example.test/maquina/${n}`, title: `Máquina ${n}`,
  shortDescription: null, longDescription: null, price, reference: `GAM-${n}`,
  brand: null, model: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null,
  condition: n === 1 ? "Nuevo" : n === 2 ? "Segunda mano" : null,
  images: n === 1 ? ["https://example.test/image.jpg"] : [],
  specs: { "Capacidad de carga": n === 1 ? "500 kg" : "" }
});

const withFixture = async (run: (fixture: { root: string; source: string; out: string }) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-preparation-"));
  const source = join(root, "scraped", "inventario-catalog.json");
  const out = join(root, "prepared", "inventario-preparation.json");
  try {
    const products = Array.from({ length: 12 }, (_, i) => machine(i + 1));
    const result: CategoryScrapeResult = {
      category, discoveredProductUrls: products.length, products, failures: []
    };
    await writeOutputs(join(root, "scraped"), "inventario", [result], when, when);
    await run({ root, source, out });
  } finally { await rm(root, { recursive: true, force: true }); }
};

const options = (source: string, out: string, dryRun = false, compare: string | null = null) => ({
  providerId: "gam", source, out, dryRun, compare
});

test("replay offline conserva máquinas sin precio, condiciones inciertas e identidades", async () => {
  await withFixture(async ({ source, out }) => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = () => { throw new Error("No se permite red durante prepare"); };
    try {
      const result = await prepareSavedCatalog(options(source, out));
      assert.equal(result.preparation.products.length, 12);
      assert.equal(result.preparation.totals.ready + result.preparation.totals.review, 12);
      assert.equal(result.preparation.products[0]?.product.condition, "Nuevo");
      assert.equal(result.preparation.products[1]?.product.condition, "Segunda_Mano");
      assert.equal(result.preparation.products[2]?.product.condition, null);
      assert.equal(result.preparation.products[0]?.product.price, null);
      assert.equal(new Set(result.preparation.identities).size, 12);
      assert.equal(result.diagnostics.totals.products, 12);
      assert.ok(result.diagnostics.issues.every((entry) => entry.code !== "excel.price"));
      assert.ok(result.diagnostics.issues.every((entry) => entry.affected >= entry.only));
      assert.ok(result.diagnostics.sourceTriage);
      const sourceTriage = result.diagnostics.sourceTriage;
      assert.equal(sourceTriage.reduce((total, entry) => total + entry.affected, 0), result.diagnostics.issues.reduce((total, entry) => total + entry.affected, 0));
      assert.equal(sourceTriage.find((entry) => entry.issueCode === "excel.price"), undefined);
      assert.ok(sourceTriage.every((entry) => entry.affected >= entry.only));
      const reversed = [...(await readCanonicalCatalog(source)).products].reverse();
      assert.deepEqual(buildSourceTriage(result.preparation, reversed), sourceTriage);
      assert.throws(() => buildSourceTriage(result.preparation, reversed.slice(1)), /diferentes cantidades/);
      assert.throws(() => buildSourceTriage(result.preparation, [reversed[0]!, ...reversed.slice(0, -1)]), /identidad duplicada/);
      const saved = await readOfflinePreparation(out, "gam");
      assert.deepEqual(saved.products, result.preparation.products);
      assert.equal(saved.source.catalogSha256, createHash("sha256").update(await readFile(source, "utf8")).digest("hex"));
    } finally { globalThis.fetch = oldFetch; }
  });
});

test("dry-run prepara sin crear archivos ni tocar la fuente", async () => {
  await withFixture(async ({ source, out }) => {
    const before = await readFile(source, "utf8");
    const result = await prepareSavedCatalog(options(source, out, true));
    assert.equal(result.preparation.products.length, 12);
    await assert.rejects(access(out), { code: "ENOENT" });
    await assert.rejects(access(result.diagnosticsFile), { code: "ENOENT" });
    await assert.rejects(access(result.manifestFile), { code: "ENOENT" });
    assert.equal(await readFile(source, "utf8"), before);
  });
});

test("replay comparable tiene los mismos datos semánticos y ninguna regresión", async () => {
  await withFixture(async ({ root, source, out }) => {
    const first = await prepareSavedCatalog(options(source, out));
    const next = join(root, "prepared", "inventario-replay-preparation.json");
    const second = await prepareSavedCatalog(options(source, next, false, out));
    assert.deepEqual(second.preparation.products, first.preparation.products);
    assert.equal(second.comparison?.comparable, true);
    assert.deepEqual(second.comparison?.reviewToReady, []);
    assert.deepEqual(second.comparison?.readyToReview, []);
    assert.deepEqual(second.comparison?.issuesResolved, {});
    assert.deepEqual(second.comparison?.issuesAdded, {});
    assert.equal(second.comparison?.rulesChanged, false);
    assert.equal(second.comparison?.snapshotsChanged, false);
    assert.ok(second.comparisonFile && await readFile(second.comparisonFile, "utf8"));
  });
});

test("no sobrescribe preparación previa ni deja nuevos archivos sueltos", async () => {
  await withFixture(async ({ source, out }) => {
    await prepareSavedCatalog(options(source, out));
    const before = await readFile(out, "utf8");
    await assert.rejects(prepareSavedCatalog(options(source, out)), { code: "EEXIST" });
    assert.equal(await readFile(out, "utf8"), before);
  });
});

test("un manifest alterado bloquea comparaciones aunque el JSON parezca válido", async () => {
  await withFixture(async ({ root, source, out }) => {
    const result = await prepareSavedCatalog(options(source, out));
    await writeFile(result.manifestFile, "{}");
    const next = join(root, "prepared", "inventario-new-preparation.json");
    await assert.rejects(prepareSavedCatalog(options(source, next, true, out)), /Manifest/);
    await assert.rejects(readOfflinePreparation(out, "gam"), /Manifest/);
  });
});

test("si cambia el catálogo de origen se declara comparación no homogénea", async () => {
  await withFixture(async ({ root, source, out }) => {
    await prepareSavedCatalog(options(source, out));
    const products = Array.from({ length: 12 }, (_, i) => machine(i + 1, "100 €"));
    await writeOutputs(join(root, "scraped"), "inventario", [{
      category, discoveredProductUrls: products.length, products, failures: []
    }], "2026-10-22T12:00:00Z", "2026-10-22T12:00:00Z");
    const next = join(root, "prepared", "inventario-new-preparation.json");
    const result = await prepareSavedCatalog(options(source, next, false, out));
    assert.equal(result.comparison?.comparable, false);
    assert.deepEqual(result.comparison?.reviewToReady, []);
    assert.deepEqual(result.comparison?.readyToReview, []);
  });
});

test("comparador detecta cambios por identidad y por código estable, no por posición", async () => {
  await withFixture(async ({ source, out }) => {
    const { preparation } = await prepareSavedCatalog(options(source, out, true));
    const before = {
      ...preparation,
      identities: [...preparation.identities].reverse(),
      products: [...preparation.products].reverse().map((entry, index) => index === 0 ? {
        ...entry, status: "ready" as const, issues: [],
        product: { ...entry.product, categorySellID: 4, attributes: [{ attributeID: 5, value: 10 }] }
      } : entry)
    };
    const result = compareOfflinePreparations(preparation, before);
    assert.equal(result.comparable, true);
    assert.equal(result.readyToReview.length, 1);
    assert.equal(result.categoryChanged.length, 1);
    assert.equal(result.attributesChanged.length, 1);
    assert.ok(Object.keys(result.issuesAdded).length > 0);
  });
});

test("proveedor erróneo y catálogo incompleto se rechazan sin escribir salida", async () => {
  await withFixture(async ({ source, out }) => {
    await assert.rejects(prepareSavedCatalog({ ...options(source, out), providerId: "gomariz" }), /proveedor/);
    await writeFile(source, "{}");
    await assert.rejects(prepareSavedCatalog(options(source, out)), /catálogo canónico|Catálogo canónico/i);
    await assert.rejects(access(out), { code: "ENOENT" });
  });
});

for (const providerId of ["gomariz", "mercaeleva"] as const) {
  test(`replay offline acepta catálogos completos de ${providerId} sin reinterpretar faltantes`, async () => {
    const root = await mkdtemp(join(tmpdir(), `equipzilla-${providerId}-`));
    try {
      const source = join(root, "scraped", "inventario-catalog.json");
      const out = join(root, "prepared", "inventario-preparation.json");
      const products: readonly ProductRecord[] = Array.from({ length: 12 }, (_, i) => ({
        ...machine(i + 1), providerId, condition: null, price: null
      }));
      await writeOutputs(join(root, "scraped"), "inventario", [{
        category, discoveredProductUrls: products.length, products, failures: []
      }], when, when);
      const result = await prepareSavedCatalog({ providerId, source, out, dryRun: false, compare: null });
      assert.equal(result.preparation.products.length, products.length);
      assert.equal(result.preparation.source.providerId, providerId);
      assert.equal(result.preparation.totals.ready + result.preparation.totals.review, 12);
      assert.ok(result.preparation.products.every((entry) => entry.product.price === null));
      assert.equal((await readOfflinePreparation(out, providerId)).source.catalogSha256, result.preparation.source.catalogSha256);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test("si el diagnóstico ya existe, rollback conserva el archivo ajeno y no deja salida parcial", async () => {
  await withFixture(async ({ source, out }) => {
    const diagnostics = out.replace(/-preparation\.json$/, "-diagnostics.json");
    await mkdir(dirname(diagnostics), { recursive: true });
    await writeFile(diagnostics, "contenido anterior");
    await assert.rejects(prepareSavedCatalog(options(source, out)), { code: "EEXIST" });
    await assert.rejects(access(out), { code: "ENOENT" });
    assert.equal(await readFile(diagnostics, "utf8"), "contenido anterior");
  });
});
