import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CategoryConfig, CategoryScrapeResult } from "../../../contracts/scraping.js";
import { writeOutputs } from "../../publication/publish.js";
import { prepareSavedCatalog } from "../../preparation/prepare.js";
import { validateCanonicalSource, validateOfflinePreparation } from "../offline.js";
import { offlinePreparationManifestPath, readOfflinePreparation } from "../../../infrastructure/filesystem/offline-preparation.js";
import { planProductImport, readReferenceInventory } from "../../../catalog/import/export/export-plan.js";
import { createProductsXlsx } from "../../../infrastructure/spreadsheet/xlsx.js";
import { runPreflight } from "../../../cli/validate.js";

const category: CategoryConfig = {
  key: "elevacion-nueva", name: "Plataformas elevadoras nuevas", url: "https://example.test/catalogo"
};
const machine = (reference: string, condition: "Nuevo" | "Segunda mano" | null, price: string | null): ProductRecord => ({
  providerId: "gam", categoryKey: condition === "Segunda mano" ? "elevacion" : category.key,
  categoryName: condition === "Segunda mano" ? "Plataformas usadas" : category.name,
  url: condition === "Segunda mano"
    ? `https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/${reference}-maquina`
    : `https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/${reference}-maquina`,
  reference, title: "Plataforma de tijera eléctrica XCMG", shortDescription: "Plataforma eléctrica",
  longDescription: "Maquinaria", price, brand: "XCMG", model: "Tijera", year: null, location: null,
  country: null, horometer: null, serialNumber: null, condition,
  image: "https://example.test/image.jpg", images: ["https://example.test/image.jpg"],
  specs: { "Altura de trabajo": "8 m" }
});

const withCatalog = async (run: (paths: {
  source: string; preparation: string; inventory: string; root: string;
}) => Promise<void>, products: readonly ProductRecord[] = [
  machine("11111", "Nuevo", "20000 €"), machine("22222", "Segunda mano", "18000 €"),
  machine("33333", "Nuevo", null), {
    ...machine("44444", "Nuevo", "20000 €"),
    title: "Plataforma de tijera eléctrica XCMG de segunda mano"
  }
]): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-stage3-"));
  const source = join(root, "scraped", "fase3-catalog.json");
  const preparation = join(root, "prepared", "fase3-preparation.json");
  const inventory = join(root, "inventory.csv");
  const now = new Date().toISOString();
  const result: CategoryScrapeResult = { category, discoveredProductUrls: products.length, products, failures: [] };
  try {
    await writeOutputs(join(root, "scraped"), "fase3", [result], now, now);
    await prepareSavedCatalog({ providerId: products[0]?.providerId ?? "gam", source, out: preparation, dryRun: false, compare: null });
    await writeFile(inventory, "companyID,reference\n45,11111\n");
    await run({ root, source, preparation, inventory });
  } finally { await rm(root, { recursive: true, force: true }); }
};

test("catálogo, preparación y plan de altas usan la misma fuente y preservan review", async () => {
  await withCatalog(async ({ source, preparation, inventory }) => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = () => { throw new Error("Red prohibida"); };
    try {
      const catalog = await validateCanonicalSource(source, "gam");
      const result = await validateOfflinePreparation("gam", preparation, source, 48);
      assert.equal(catalog.productCount, 4);
      assert.equal(result.ready + result.review, 4);
      assert.equal(result.ready, 3);
      const referenceInventory = readReferenceInventory(await readFile(inventory, "utf8"), 45);
      const plan = planProductImport(result.preparation, "gam", referenceInventory, result.target);
      assert.equal(plan.report.newProducts, 1);
      assert.equal(plan.report.existingProducts, 1);
      assert.equal(plan.report.reviewProducts, 2);
      assert.equal(plan.rows[0]?.[0], "22222");
      assert.equal(plan.rows[0]?.[3], "Segunda_Mano");
      assert.ok(!plan.rows.some((row) => row.includes("33333")));
      assert.ok(!plan.rows.some((row) => row.includes("44444")));
      const xlsx = createProductsXlsx(plan.headers, plan.rows);
      assert.equal(xlsx.readUInt32LE(0), 0x04034b50);
    } finally { globalThis.fetch = oldFetch; }
  });
});

test("condición comercial no publicada conserva ready sin superar requisitos de importación", async () => {
  await withCatalog(async ({ source, preparation }) => {
    const result = await validateOfflinePreparation("gam", preparation, source);
    assert.equal(result.ready, 1);
    assert.equal(result.review, 0);
    assert.equal(result.importBlocked, 1);
    const entry = result.preparation.products[0];
    assert.equal(entry?.status, "ready");
    assert.equal(entry?.product.condition, null);
    assert.deepEqual(entry?.issues, []);
    assert.ok(entry?.importIssues?.createMany.some((issue) => issue.includes("Condición")));
  }, [machine("55555", null, "20000 €")]);
});

test("preparación alterada y firmada de nuevo sigue bloqueada por las reglas reales", async () => {
  await withCatalog(async ({ source, preparation }) => {
    const original = await readOfflinePreparation(preparation, "gam");
    const changed = {
      ...original,
      products: original.products.map((product, index) => index === 2 ? {
        ...product, product: { ...product.product, price: 20000 }
      } : product)
    };
    const raw = JSON.stringify(changed);
    await writeFile(preparation, raw);
    const manifest = {
      version: 1, providerId: "gam",
      catalogSha256: createHash("sha256").update(await readFile(source, "utf8")).digest("hex"),
      preparationSha256: createHash("sha256").update(raw).digest("hex")
    };
    await writeFile(offlinePreparationManifestPath(preparation), JSON.stringify(manifest));
    await assert.rejects(validateOfflinePreparation("gam", preparation, source), /no coincide con los productos/);
  });
});

test("manifest inválido, proveedor equivocado y catálogo diferente detienen el flujo", async () => {
  await withCatalog(async ({ source, preparation, root }) => {
    await assert.rejects(validateOfflinePreparation("gomariz", preparation, source), /proveedores distintos/);
    const other = join(root, "otro-catalog.json");
    await writeFile(other, "{}");
    await assert.rejects(validateOfflinePreparation("gam", preparation, other), /ENOENT|catálogo canónico/i);
    const manifestPath = offlinePreparationManifestPath(preparation);
    const valid = await readFile(manifestPath, "utf8");
    await writeFile(manifestPath, "{}");
    await assert.rejects(validateOfflinePreparation("gam", preparation, source), /Manifest/);
    await writeFile(manifestPath, valid);
    const raw = await readFile(preparation, "utf8");
    await writeFile(preparation, raw.replace("11111", "alterada"));
    await assert.rejects(validateOfflinePreparation("gam", preparation, source), /Manifest/);
  });
});

test("exportación rechaza antigüedad de origen aunque la preparación sea reciente", async () => {
  await withCatalog(async ({ source, preparation }) => {
    await assert.rejects(validateOfflinePreparation("gam", preparation, source, 0.0000001), /demasiado antiguo/);
  });
});

test("catálogos de los tres proveedores se verifican sin convertir review en pérdida", async () => {
  for (const providerId of ["gam", "gomariz", "mercaeleva"] as const) {
    const products = ["11111", "22222"].map((ref) => ({
      ...machine(ref, null, "12xx3 €"), providerId
    }));
    await withCatalog(async ({ source, preparation }) => {
      const result = await validateOfflinePreparation(providerId, preparation, source);
      assert.equal(result.catalog.productCount, 2);
      assert.equal(result.ready, 0);
      assert.equal(result.review, 2);
      const before = await readFile(source, "utf8");
      await validateCanonicalSource(source, providerId);
      assert.equal(await readFile(source, "utf8"), before);
    }, products);
  }
});

test("validate resuelve el catálogo original al validar una preparación de nombre diferente", async () => {
  await withCatalog(async ({ root, preparation }) => {
    const renamed = join(root, "prepared", "fase3-alturas-preparation.json");
    await rename(preparation, renamed);
    await rename(offlinePreparationManifestPath(preparation), offlinePreparationManifestPath(renamed));
    const previousLog = console.log;
    const previousExitCode = process.exitCode;
    const messages: string[] = [];
    try {
      console.log = (...values: unknown[]) => { messages.push(values.map(String).join(" ")); };
      process.exitCode = 0;
      await runPreflight(["gam", "--stage", "preparation", "--preparation", renamed, "--out", join(root, "scraped")]);
      assert.ok(messages.some((message) => message.includes("VALIDACIÓN | GAM | REVISIÓN")));
      assert.equal(process.exitCode, 2);
    } finally {
      console.log = previousLog;
      process.exitCode = previousExitCode;
    }
  });
});

test("validate --verbose separa fichas en review de bloqueos de receptor sin alterar la validación", async () => {
  await withCatalog(async ({ source, preparation }) => {
    const previousLog = console.log;
    const previousExitCode = process.exitCode;
    const messages: string[] = [];
    try {
      console.log = (...values: unknown[]) => { messages.push(values.map(String).join(" ")); };
      process.exitCode = 0;
      await runPreflight(["gam", "--stage", "preparation", "--preparation", preparation, "--source", source, "--verbose"]);
      const output = messages.join("\n");
      assert.match(output, /AUDIT DE REVIEW \| 1\/4 fichas en revisión/);
      assert.match(output, /Patrones de bloqueos simultáneos/);
      assert.match(output, /Máquinas en review \(referencia y motivos exactos\)/);
      const reviewDetails = output.split("  Máquinas en review (referencia y motivos exactos):")[1]?.split("  Bloqueos de importación Excel")[0];
      assert.ok(reviewDetails);
      assert.doesNotMatch(reviewDetails, /GAM \| 33333 \|/);
      assert.match(reviewDetails, /GAM \| 44444 \| 1 motivo/);
      assert.match(output, /GAM \| 33333 \| calidad: ready \| 1 requisitos de receptor/);
      assert.doesNotMatch(output, /\[excel.price\]/);
      assert.match(output, /\[condition.contradictory\] Condición comercial contradictoria entre la ficha y el origen/);
      assert.doesNotMatch(reviewDetails, /\[mapping.category\]/);
      assert.match(output, /\[category.excel\] contrato_destino: Categoría no coincide de forma única con el backend/);
      assert.doesNotMatch(output, /GAM \| 11111 \|/);
      assert.doesNotMatch(output, /GAM \| 22222 \|/);
      assert.doesNotMatch(output, /Origen canónico \(todos los campos publicados\)/);
      assert.doesNotMatch(output, /Preparación \(todos los campos normalizados\)/);
      assert.equal((output.match(/^    GAM \| \d+ \| \d+ motivos?$/gm) ?? []).length, 1);
      assert.equal(process.exitCode, 2);
    } finally {
      console.log = previousLog;
      process.exitCode = previousExitCode;
    }
  });
});

test("validate sin --verbose conserva el diagnóstico resumido", async () => {
  await withCatalog(async ({ source, preparation }) => {
    const previousLog = console.log;
    const previousExitCode = process.exitCode;
    const messages: string[] = [];
    try {
      console.log = (...values: unknown[]) => { messages.push(values.map(String).join(" ")); };
      process.exitCode = 0;
      await runPreflight(["gam", "--stage", "preparation", "--preparation", preparation, "--source", source]);
      const output = messages.join("\n");
      assert.match(output, /Diagnóstico review/);
      assert.doesNotMatch(output, /AUDIT DE REVIEW/);
      assert.doesNotMatch(output, /Máquinas en review/);
      assert.equal(process.exitCode, 2);
    } finally {
      console.log = previousLog;
      process.exitCode = previousExitCode;
    }
  });
});
