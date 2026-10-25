import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runExport } from "../../../cli/export.js";
import { record, documentFor, readZipXml } from "./export-fixtures.js";

test("CLI genera Excel offline e impide reusar la preparación tras una extracción parcial", async () => {
  const dir = await mkdtemp(join(tmpdir(), "catalog-export-"));
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
    assert.ok("format" in report && report.format === "xlsx");
    assert.ok("outputBytes" in report && report.outputBytes === (await readFile(outputFile)).length);
    assert.ok("outputSha256" in report && report.outputSha256 === createHash("sha256").update(await readFile(outputFile)).digest("hex"));
    assert.ok("inventorySha256" in report && report.inventorySha256 === createHash("sha256").update("companyID,reference\n45,EXISTENTE\n").digest("hex"));
    await writeFile(summaryFile, JSON.stringify({ quality: { status: "partial", published: false } }));
    await assert.rejects(runExport([...args, "--dry-run"]), /catálogo completo/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
