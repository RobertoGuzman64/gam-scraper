import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareProduct } from "../../../catalog/import/preparation/prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { runExport } from "../../../cli/export.js";
import { runPreflight } from "../../../cli/validate.js";
import { validateCatalogPublication } from "../preflight.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const record: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ", shortDescription: "Plataforma de ocasión", longDescription: "Máquina revisada",
  price: "20.500,00 €", reference: "M044-4093", brand: "JLG", model: "450 AJ", year: "2013",
  location: "Barcelona", country: "ES", horometer: "3666", serialNumber: null,
  condition: "Segunda mano",
  image: "https://example.com/1.jpg", images: ["https://example.com/1.jpg"], specs: { "Altura de trabajo": "16 m" }
};

const createBatch = async (dir: string, records: readonly ProductRecord[] = [record]) => {
  const catalog = await loadImportCatalog();
  const products = records.map((item) => prepareProduct(item, catalog));
  const start = new Date(Date.now() - 100).toISOString();
  const csv = `providerId,url,reference\n${records.map((item) => `${item.providerId},${item.url},${item.reference ?? ""}\n`).join("")}`;
  const preparation = { quality: "complete", published: true, products };
  const preparationText = JSON.stringify(preparation);
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  const summary = {
    startedAt: start, endedAt: new Date().toISOString(),
    artifacts: { csvSha256: hash(csv), preparationSha256: hash(preparationText) },
    quality: { status: "complete", published: true },
    totals: { scrapedProducts: records.length, failures: 0 }
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

const check = (dir: string, providerId = "mercaeleva") => validateCatalogPublication({
  providerId, outputDir: dir, outputPrefix: "lote", maxAgeHours: 48
});

test("valida lote coherente con referencias reales y marca los pendientes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-preflight-"));
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

test("preflight acepta precios ausentes para create/many pero Excel excluye esas fichas", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "log", (...values: unknown[]) => { logs.push(values.map(String).join(" ")); });
  const dir = await mkdtemp(join(tmpdir(), "eq-new-used-export-"));
  try {
    const newMachine: ProductRecord = {
      ...record,
      providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Plataformas elevadoras nuevas",
      url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/99999-maquina",
      reference: "GAM-NUEVA", title: "Plataforma de tijera eléctrica XCMG",
      condition: "Nuevo", specs: { "Altura de trabajo": "8 m" }
    };
    const usedMachine: ProductRecord = {
      ...newMachine, categoryKey: "elevacion",
      url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/88888-maquina",
      reference: "GAM-USADA", title: "Plataforma de tijera eléctrica usada", condition: "Segunda mano"
    };
    const noPrice: ProductRecord = {
      ...newMachine,
      url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/77777-maquina",
      reference: "GAM-SIN-PRECIO", price: null
    };
    const batch = await createBatch(dir, [newMachine, usedMachine, noPrice]);
    assert.deepEqual(batch.preparation.products.map((entry) => entry.status), ["ready", "ready", "ready"]);
    assert.deepEqual(batch.preparation.products.map((entry) => entry.product.condition), ["Nuevo", "Segunda_Mano", "Nuevo"]);
    assert.equal(batch.preparation.products[2]?.product.price, null);
    const checked = await check(dir, "gam");
    assert.equal(checked.productCount, 3);
    assert.equal(checked.ready, 3);
    assert.equal(checked.review, 0);
    const inventory = join(dir, "inventory.csv");
    const output = join(dir, "altas.xlsx");
    await writeFile(inventory, "companyID,reference\n45,YA-EXISTE\n");
    const args = ["--provider", "gam", "--companyID", "45", "--preparation", batch.paths.preparation,
      "--existing", inventory, "--out", output];
    await runExport([...args, "--dry-run"]);
    assert.match(logs.join("\n"), /Altas: 2 \| Existentes: 0 \| Revisar: 1 \| Duplicados: 0/);
    assert.match(logs.join("\n"), /Condiciones de las altas: Nuevo: 1 \| Segunda_Mano: 1/);
    await assert.rejects(readFile(output), /ENOENT/);
    await runExport([...args, "--confirm-inventory"]);
    assert.equal((await readFile(output)).readUInt32LE(0), 0x04034b50);
    const report: unknown = JSON.parse(await readFile(`${output}.report.json`, "utf8"));
    assert.ok(report && typeof report === "object" && "total" in report && report.total === 3);
    assert.ok("newProducts" in report && report.newProducts === 2);
    assert.ok("reviewProducts" in report && report.reviewProducts === 1);
    assert.match(JSON.stringify(report), /GAM-SIN-PRECIO/);
    assert.deepEqual(JSON.parse(await readFile(batch.paths.preparation, "utf8")), batch.preparation);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rechaza productos inconsistentes, catálogos incompletos, mezclas y fechas antiguas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-preflight-invalid-"));
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
  const dir = await mkdtemp(join(tmpdir(), "eq-preflight-export-"));
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

test("preflight separa calidad ready de importabilidad create/many sin exportar candidatos incompatibles", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-preflight-contract-"));
  try {
    const batch = await createBatch(dir);
    const original = batch.preparation.products[0];
    assert.ok(original);
    const scenarios = [
      { name: "condición", product: { ...original.product, condition: null }, reason: /Condición incompatible/ },
      { name: "precio inválido", product: { ...original.product, price: 0 }, reason: /Precio ausente o inválido/ },
      { name: "categoría", product: { ...original.product, categorySellID: 99999 }, reason: /Categoría no válida/ },
      { name: "imagen", product: { ...original.product, images: ["file:///local.jpg"] }, reason: /URL de imagen/ },
      { name: "atributo", product: { ...original.product, attributes: [{ attributeID: 1, value: "muchos" }] }, reason: /Atributo numérico inválido/ }
    ];
    const withoutPrice = JSON.stringify({ ...batch.preparation, products: [{ ...original, product: { ...original.product, price: null } }] });
    await writeFile(batch.paths.preparation, withoutPrice);
    await writeFile(batch.paths.summary, JSON.stringify({
      ...batch.summary, artifacts: { ...batch.summary.artifacts, preparationSha256: createHash("sha256").update(withoutPrice).digest("hex") }
    }));
    assert.equal((await check(dir)).ready, 1);
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
      const result = await check(dir);
      assert.equal(result.ready, 1, scenario.name);
      assert.equal(result.review, 0, scenario.name);
      assert.equal(result.importReady, 0, scenario.name);
      assert.equal(result.importBlocked, 1, scenario.name);
      assert.equal(result.status, "review", scenario.name);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preflight comprueba ready/review declarados sin invalidar preparaciones históricas sin totales", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eq-preflight-totals-"));
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


test("validate presenta motivos y referencias sin modificar la elegibilidad ni el código de revisión", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "eq-review-cli-"));
  const originalExitCode = process.exitCode;
  const lines: string[] = [];
  t.mock.method(console, "log", (...values: unknown[]) => { lines.push(values.map(String).join(" ")); });
  try {
    const noPrice: ProductRecord = { ...record, reference: "M044-4094", url: `${record.url}-2`, price: null };
    const noDescription: ProductRecord = { ...record, reference: "M044-4095", url: `${record.url}-3`,
      price: null, shortDescription: null };
    await createBatch(dir, [record, noPrice, noDescription]);
    process.exitCode = 0;
    await runPreflight(["mercaeleva", "--out", dir, "--prefix", "lote"]);
    const output = lines.join("\n");
    assert.equal(process.exitCode, 2);
    assert.match(output, /Productos: 3 \| Calidad ready: 3 \| Calidad review: 0 \| Importables create\/many: 2 \| Bloqueados: 1 \| Posibles bajas: 0/);
    assert.doesNotMatch(output, /Precio no disponible o inválido/);
    assert.match(output, /Aviso: 1 productos no elegibles para create\/many/);
    lines.length = 0;
    await createBatch(dir);
    process.exitCode = 0;
    await runPreflight(["mercaeleva", "--out", dir, "--prefix", "lote"]);
    assert.equal(process.exitCode, 0);
    assert.match(lines.join("\n"), /VALIDACIÓN \| MERCAELEVA \| CONFORME/);
    assert.doesNotMatch(lines.join("\n"), /Diagnóstico review:/);
  } finally {
    process.exitCode = originalExitCode;
    await rm(dir, { recursive: true, force: true });
  }
});
