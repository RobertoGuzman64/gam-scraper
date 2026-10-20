import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareProduct } from "../../../catalog/import/prepare.js";
import { loadImportCatalog } from "../../../catalog/import/catalog-loader.js";
import { runExport } from "../../../cli/export.js";
import { validateCatalogPublication } from "../preflight.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const record: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ", shortDescription: "Plataforma de ocasión", longDescription: "Máquina revisada",
  price: "20.500,00 €", reference: "M044-4093", brand: "JLG", model: "450 AJ", year: "2013",
  location: "Barcelona", country: "ES", horometer: "3666", serialNumber: null,
  image: "https://example.com/1.jpg", images: ["https://example.com/1.jpg"], specs: { "Altura de trabajo": "16 m" }
};

const createBatch = async (dir: string) => {
  const catalog = await loadImportCatalog();
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.status, "ready");
  const start = new Date(Date.now() - 100).toISOString();
  const csv = `providerId,url,reference\nmercaeleva,${record.url},${record.reference}\n`;
  const preparation = { quality: "complete", published: true, products: [prepared] };
  const preparationText = JSON.stringify(preparation);
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  const summary = {
    startedAt: start, endedAt: new Date().toISOString(),
    artifacts: { csvSha256: hash(csv), preparationSha256: hash(preparationText) },
    quality: { status: "complete", published: true },
    totals: { scrapedProducts: 1, failures: 0 }
  };
  const changes = { status: "comparable", suspectedMissing: [] };
  const paths = {
    summary: join(dir, "lote-summary.json"),
    preparation: join(dir, "lote-preparation.json"),
    changes: join(dir, "lote-changes.json"),
    csv: join(dir, "lote-all.csv")
  };
  await Promise.all([
    writeFile(paths.summary, JSON.stringify(summary)),
    writeFile(paths.preparation, preparationText),
    writeFile(paths.changes, JSON.stringify(changes)),
    writeFile(paths.csv, csv)
  ]);
  return { paths, summary, preparation, changes };
};

const check = (dir: string) => validateCatalogPublication({
  providerId: "mercaeleva", outputDir: dir, outputPrefix: "lote", maxAgeHours: 48
});

test("valida lote coherente con referencias reales y marca los pendientes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-f7-"));
  try {
    const batch = await createBatch(dir);
    const result = await check(dir);
    assert.equal(result.productCount, 1);
    assert.equal(result.status, "passed");
    assert.equal(result.ready, 1);
    await writeFile(batch.paths.changes, JSON.stringify({ status: "comparable", suspectedMissing: ["mercaeleva:ref:MAQUINA"] }));
    const warnings = await check(dir);
    assert.equal(warnings.status, "review");
    assert.equal(warnings.suspectedMissing, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rechaza productos inconsistentes, catálogos incompletos, mezclas y fechas antiguas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-f7-fail-"));
  try {
    const batch = await createBatch(dir);
    await writeFile(batch.paths.csv, `providerId,url,reference\nmercaeleva,${record.url},DISTINTA\n`);
    await assert.rejects(check(dir), /huellas de integridad/);
    await writeFile(batch.paths.csv, `providerId,url,reference\nmercaeleva,${record.url},${record.reference}\n`);
    await writeFile(batch.paths.summary, JSON.stringify({ ...batch.summary, totals: { scrapedProducts: 2, failures: 0 } }));
    await writeFile(batch.paths.summary, JSON.stringify({ ...batch.summary, artifacts: { ...batch.summary.artifacts, csvSha256: createHash("sha256").update(await readFile(batch.paths.csv)).digest("hex") }, totals: { scrapedProducts: 2, failures: 0 } }));
    await assert.rejects(check(dir), /totales/);
    await writeFile(batch.paths.summary, JSON.stringify({ ...batch.summary, quality: { status: "partial", published: false } }));
    await assert.rejects(check(dir), /completo/);
    await writeFile(batch.paths.summary, JSON.stringify({ ...batch.summary, endedAt: new Date(Date.now() - 49 * 3600000).toISOString() }));
    await assert.rejects(check(dir), /Fecha de extracción/);
    await writeFile(batch.paths.summary, JSON.stringify(batch.summary));
    await writeFile(batch.paths.changes, JSON.stringify({ status: "not-comparable", suspectedMissing: [] }));
    await assert.rejects(check(dir), /cambios/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("impide generar Excel si se altera el CSV después de preparar la extracción", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-f7-export-"));
  try {
    const batch = await createBatch(dir);
    const inventory = join(dir, "inventory.csv");
    const output = join(dir, "altas.xlsx");
    await writeFile(inventory, "companyID,reference\n45,OTRA\n");
    const args = ["--provider", "mercaeleva", "--companyID", "45", "--preparation", batch.paths.preparation,
      "--existing", inventory, "--out", output, "--confirm-inventory"];
    await writeFile(batch.paths.csv, `providerId,url,reference\nmercaeleva,${record.url},OTRA\n`);
    await assert.rejects(runExport(args), /huellas de integridad/);
    await assert.rejects(readFile(output), /ENOENT/);
    await writeFile(batch.paths.csv, `providerId,url,reference\nmercaeleva,${record.url},${record.reference}\n`);
    await runExport(args);
    assert.ok((await readFile(output)).length > 100);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preflight rechaza ready que el exportador descartaría aunque los hashes sean correctos", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-f4-contract-"));
  try {
    const batch = await createBatch(dir);
    const original = batch.preparation.products[0];
    assert.ok(original);
    const scenarios = [
      { name: "precio", product: { ...original.product, price: null }, reason: /Precio ausente o inválido/ },
      { name: "categoría", product: { ...original.product, categorySellID: 99999 }, reason: /Categoría no coincide/ },
      { name: "imagen", product: { ...original.product, images: ["file:///local.jpg"] }, reason: /URL de imagen/ },
      { name: "atributo", product: { ...original.product, attributes: [{ attributeID: 1, value: "muchos" }] }, reason: /Atributo numérico inválido/ }
    ];
    for (const scenario of scenarios) {
      const preparationText = JSON.stringify({ ...batch.preparation, products: [{ ...original, product: scenario.product }] });
      await writeFile(batch.paths.preparation, preparationText);
      await writeFile(batch.paths.summary, JSON.stringify({
        ...batch.summary,
        artifacts: {
          ...batch.summary.artifacts,
          preparationSha256: createHash("sha256").update(preparationText).digest("hex")
        }
      }));
      await assert.rejects(check(dir), scenario.reason, scenario.name);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preflight comprueba ready/review declarados sin invalidar preparaciones históricas sin totales", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-f4-totals-"));
  try {
    const batch = await createBatch(dir);
    const preparationText = JSON.stringify({ ...batch.preparation, totals: { ready: 0, review: 1 } });
    await writeFile(batch.paths.preparation, preparationText);
    await writeFile(batch.paths.summary, JSON.stringify({
      ...batch.summary,
      artifacts: {
        ...batch.summary.artifacts,
        preparationSha256: createHash("sha256").update(preparationText).digest("hex")
      }
    }));
    await assert.rejects(check(dir), /totales ready\/review/);
    const corrected = JSON.stringify({ ...batch.preparation, totals: { ready: 1, review: 0 } });
    await writeFile(batch.paths.preparation, corrected);
    await writeFile(batch.paths.summary, JSON.stringify({
      ...batch.summary,
      artifacts: {
        ...batch.summary.artifacts,
        preparationSha256: createHash("sha256").update(corrected).digest("hex")
      }
    }));
    assert.equal((await check(dir)).status, "passed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
