import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runExport } from "../../../cli/export.js";
import { parseExportOptions } from "../../../cli/options/export.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import { prepareProduct } from "../preparation/prepare-product.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { PreparationDocument } from "../preparation/preparation-document.js";

const record: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ", shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.", price: "20.500,00 €", reference: "M044-4093",
  brand: "JLG", model: "450 AJ", year: "2013", location: "Barcelona", country: "ES",
  condition: "Segunda mano", horometer: "3666", serialNumber: null,
  image: "https://machineric.com/1.jpg", images: ["https://machineric.com/1.jpg", "https://machineric.com/2.jpg"],
  specs: { "Altura de trabajo": "16 m" }
};

const prepareDocument = async (records: readonly ProductRecord[]): Promise<PreparationDocument> => {
  const catalog = await loadImportCatalog();
  return { quality: "complete", published: true, products: records.map((item) => prepareProduct(item, catalog)) };
};


test("CLI JSON emite cuerpo create/many más informe sin llamar al backend", async () => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-json-export-"));
  try {
    const preparationFile = join(dir, "lote-preparation.json");
    const summaryFile = join(dir, "lote-summary.json");
    const inventoryFile = join(dir, "inventario.csv");
    const out = join(dir, "altas.json");
    const document = await prepareDocument([{ ...record, price: null }]);
    const preparationText = JSON.stringify(document);
    const csv = "providerId,url,reference\nmercaeleva,https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093,M044-4093\n";
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    await writeFile(inventoryFile, "companyID,reference\n45,OTRA\n");
    await writeFile(preparationFile, preparationText);
    await writeFile(summaryFile, JSON.stringify({
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
      quality: { status: "complete", published: true },
      artifacts: { csvSha256: hash(csv), preparationSha256: hash(preparationText) },
      totals: { scrapedProducts: 1, failures: 0 }
    }));
    await writeFile(join(dir, "lote-all.csv"), csv);
    await writeFile(join(dir, "lote-changes.json"), JSON.stringify({ status: "comparable", suspectedMissing: [] }));
    const args = ["mercaeleva", "--companyID", "45", "--preparation", preparationFile,
      "--existing", inventoryFile, "--out", out, "--format", "json"];
    await runExport([...args, "--dry-run"]);
    await assert.rejects(readFile(out), /ENOENT/);
    await runExport([...args, "--confirm-inventory"]);
    const payload: unknown = JSON.parse(await readFile(out, "utf8"));
    assert.ok(payload && typeof payload === "object" && "products" in payload && Array.isArray(payload.products));
    assert.equal(payload.products.length, 1);
    assert.ok(!("price" in payload.products[0]));
    assert.ok(!("providerId" in payload.products[0]));
    const report: unknown = JSON.parse(await readFile(`${out}.report.json`, "utf8"));
    assert.ok(report && typeof report === "object" && "newProducts" in report && report.newProducts === 1);
    assert.ok("format" in report && report.format === "json");
    assert.ok("outputBytes" in report && report.outputBytes === (await readFile(out)).length);
    assert.ok("outputSha256" in report && report.outputSha256 === hash(await readFile(out, "utf8")));
    assert.ok("inventorySha256" in report && report.inventorySha256 === hash("companyID,reference\n45,OTRA\n"));
    await assert.rejects(runExport([...args, "--confirm-inventory"]), /EEXIST/);
    await writeFile(summaryFile, JSON.stringify({ quality: { status: "partial", published: false } }));
    await assert.rejects(runExport([...args, "--dry-run"]), /catálogo completo/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("parser CLI distingue json y xlsx sin debilitar confirmaciones", () => {
  const args = ["mercaeleva", "--companyID", "45", "--preparation", "lote-preparation.json",
    "--existing", "inventory.csv", "--out", "altas.json", "--format", "json"];
  const options = parseExportOptions([...args, "--dry-run"]);
  assert.notEqual(options, "help");
  if (options === "help") return;
  assert.equal(options.format, "json");
  assert.throws(() => parseExportOptions(args), /--confirm-inventory/);
  assert.throws(() => parseExportOptions([...args, "--format", "xlsx", "--dry-run"]), /repetido/);
  assert.throws(() => parseExportOptions([...args.slice(0, -2), "--format", "json", "--out", "altas.xlsx", "--dry-run"]), /repetido/);
  assert.throws(() => parseExportOptions([...args.slice(0, -2), "--format", "xlsx", "--dry-run"]), /\.xlsx/);
});
