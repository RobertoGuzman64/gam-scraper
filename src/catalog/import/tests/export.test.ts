import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareProduct } from "../prepare.js";
import { loadImportCatalog } from "../catalog-loader.js";
import { planProductImport, readReferenceInventory } from "../export-plan.js";
import { parsePreparation } from "../preparation-document.js";
import { createProductsXlsx } from "../xlsx.js";
import { runExport } from "../../../cli/export.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const record: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ", shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.", price: "20.500,00 €", reference: "M044-4093",
  brand: "JLG", model: "450 AJ", year: "2013", location: "Barcelona", country: "ES",
  horometer: "3666", serialNumber: null, image: "https://machineric.com/1.jpg",
  images: ["https://machineric.com/1.jpg", "https://machineric.com/2.jpg"],
  specs: { "Altura de trabajo": "16 m" }
};

const documentFor = async (records: readonly ProductRecord[]) => {
  const catalog = await loadImportCatalog();
  return {
    quality: "complete" as const,
    published: true as const,
    products: records.map((record) => prepareProduct(record, catalog))
  };
};

const readZipXml = (zip: Buffer, file: string): string => {
  let position = 0;
  while (zip.readUInt32LE(position) === 0x04034b50) {
    const method = zip.readUInt16LE(position + 8);
    const compressed = zip.readUInt32LE(position + 18);
    const nameLength = zip.readUInt16LE(position + 26);
    const extraLength = zip.readUInt16LE(position + 28);
    const name = zip.subarray(position + 30, position + 30 + nameLength).toString("utf8");
    const start = position + 30 + nameLength + extraLength;
    if (name === file) {
      assert.equal(method, 8);
      return inflateRawSync(zip.subarray(start, start + compressed)).toString("utf8");
    }
    position = start + compressed;
  }
  throw new Error(`No se encontró ${file}`);
};

test("el inventario exige companyID coherente e identifica referencias sin distinguir mayúsculas", () => {
  const inventory = readReferenceInventory("companyID,reference\n45,m044-4093\n", 45);
  assert.ok(inventory.references.has("M044-4093"));
  assert.throws(() => readReferenceInventory("companyID,reference\n46,M044-4093\n", 45), /otra empresa/);
  assert.throws(() => readReferenceInventory("reference\nM044-4093\n", 45), /companyID/);
  assert.throws(() => readReferenceInventory("companyID,reference\n45,\n", 45), /referencia vacía/);
});

test("solo exporta nuevos preparados, excluyendo existentes, reviews y referencias repetidas", async () => {
  const catalog = await loadImportCatalog();
  const input = await documentFor([
    record,
    { ...record, reference: "PREEXISTE" },
    { ...record, reference: "SINPRECIO", price: null },
    { ...record, reference: "DUPLICADA" },
    { ...record, reference: "duplicada", title: "Otra unidad" }
  ]);
  const plan = planProductImport(input, "mercaeleva", readReferenceInventory("companyID,reference\n45,preexiste\n", 45), catalog);
  assert.deepEqual({ new: plan.report.newProducts, existing: plan.report.existingProducts, review: plan.report.reviewProducts, duplicates: plan.report.duplicateReferences },
    { new: 1, existing: 1, review: 1, duplicates: 2 });
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0]?.[0], "M044-4093");
  assert.ok(plan.headers.includes("Altura de trabajo (m)"));
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("Altura de trabajo (m)")], 16);
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("URL 1 *")], "https://machineric.com/1.jpg");
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("URL 2")], "https://machineric.com/2.jpg");
  assert.equal(plan.headers[0], "Referencia *");
  assert.equal(plan.headers[1], "Categoría *");
  assert.equal(plan.headers[3], "Condición *");
  assert.equal(plan.rows[0]?.[3], "Segunda_Mano");
  assert.equal(plan.rows[0]?.[4], 20500);
});

test("no acepta preparación parcial ni de un proveedor distinto", async () => {
  const input = await documentFor([record]);
  assert.throws(() => parsePreparation({ ...input, quality: "partial" }, "mercaeleva"), /completo/);
  assert.throws(() => parsePreparation({ ...input, published: false }, "mercaeleva"), /completo/);
  assert.throws(() => parsePreparation(input, "gam"), /no coincide/);
});

test("vuelve a comprobar campos y atributos aunque una entrada llegue marcada ready", async () => {
  const catalog = await loadImportCatalog();
  const input = await documentFor([record]);
  const first = input.products[0];
  assert.ok(first);
  const document = { ...input, products: [{ ...first, product: { ...first.product, price: null } }] };
  const plan = planProductImport(document, "mercaeleva", readReferenceInventory("companyID,reference\n45,OTRA\n", 45), catalog);
  assert.equal(plan.report.newProducts, 0);
  assert.equal(plan.report.reviewProducts, 1);
});

test("xlsx estándar contiene hoja Productos, textos seguros, números y cabeceras compatibles", () => {
  const bytes = createProductsXlsx(["Referencia *", "Precio *", "URL 1 *"], [["=SUM(1,2)", 12500.5, "https://example.com/x.jpg"]]);
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.match(readZipXml(bytes, "xl/workbook.xml"), /name="Productos"/);
  const sheet = readZipXml(bytes, "xl/worksheets/sheet1.xml");
  assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">=SUM\(1,2\)/);
  assert.match(sheet, /<c r="B2"><v>12500\.5<\/v><\/c>/);
  assert.doesNotMatch(sheet, /<f>/);
  assert.throws(() => createProductsXlsx(["Precio *", "Precio *"], []), /duplicadas/);
});

test("se limita a diez URLs y no inventa imágenes adicionales", async () => {
  const catalog = await loadImportCatalog();
  const many = Array.from({ length: 12 }, (_, index) => `https://example.com/${index + 1}.jpg`);
  const input = await documentFor([{ ...record, image: many[0] ?? null, images: many }]);
  const plan = planProductImport(input, "mercaeleva", readReferenceInventory("companyID,reference\n45,OTRA\n", 45), catalog);
  assert.equal(plan.report.extraImages, 2);
  assert.equal(plan.headers.filter((h) => /^URL /.test(h)).length, 10);
  assert.ok(!plan.rows[0]?.includes(many[10] ?? ""));
});

test("CLI genera Excel offline e impide reusar la preparación tras una extracción parcial", async () => {
  const dir = await mkdtemp(join(tmpdir(), "phase6-import-"));
  try {
    const preparationFile = join(dir, "lote-preparation.json");
    const summaryFile = join(dir, "lote-summary.json");
    const inventoryFile = join(dir, "existing.csv");
    const outputFile = join(dir, "altas.xlsx");
    const document = await documentFor([record]);
    await writeFile(inventoryFile, "companyID,reference\n45,EXISTENTE\n");
    const endedAt = new Date().toISOString();
    const csv = "providerId,url,reference\nmercaeleva,https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093,M044-4093\n";
    const preparationText = JSON.stringify(document);
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    await writeFile(summaryFile, JSON.stringify({
      startedAt: endedAt,
      endedAt,
      quality: { status: "complete", published: true },
      artifacts: { csvSha256: hash(csv), preparationSha256: hash(preparationText) },
      totals: { scrapedProducts: 1, failures: 0 }
    }));
    await writeFile(preparationFile, preparationText);
    await writeFile(join(dir, "lote-all.csv"), csv);
    await writeFile(join(dir, "lote-changes.json"), JSON.stringify({ status: "comparable", suspectedMissing: [] }));
    const args = ["--provider", "mercaeleva", "--companyID", "45", "--preparation", preparationFile,
      "--existing", inventoryFile, "--out", outputFile];
    await runExport([...args, "--dry-run"]);
    await assert.rejects(readFile(outputFile), /ENOENT/);
    await runExport([...args, "--confirm-inventory"]);
    assert.match(readZipXml(await readFile(outputFile), "xl/workbook.xml"), /name="Productos"/);
    const report: unknown = JSON.parse(await readFile(`${outputFile}.report.json`, "utf8"));
    assert.ok(report && typeof report === "object" && "newProducts" in report && report.newProducts === 1);
    await writeFile(summaryFile, JSON.stringify({ quality: { status: "partial", published: false } }));
    await assert.rejects(runExport([...args, "--dry-run"]), /catálogo completo/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
