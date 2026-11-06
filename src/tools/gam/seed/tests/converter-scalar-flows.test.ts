import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toCsv } from "../../../../shared/csv.js";
import { convertGamCsvToSeedTs } from "../convert-csv-by-category.js";
import { convertGamCsvToSeedTsAuto } from "../convert-csv-by-url.js";

test("los conversores GAM por categoría y URL proyectan los mismos escalares", async () => {
  const folder = await mkdtemp(join(tmpdir(), "equipzilla-seed-scalars-"));
  try {
    const categoriesPath = join(folder, "categories.json");
    const csvPath = join(folder, "products.csv");
    const categoryOutputPath = join(folder, "category.ts");
    const urlOutputPath = join(folder, "url.ts");

    await writeFile(categoriesPath, JSON.stringify([
      { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
      { id: 2, parentId: 1, name: "Elevación", slug: "elevacion" }
    ]), "utf8");
    await writeFile(csvPath, toCsv([{
      categoryKey: "elevacion",
      title: "Modelo CSV",
      shortDescription: "Descripción breve",
      longDescription: "Descripción general",
      reference: "GAM-001",
      url: "https://online.gamrentals.com/es/elevacion/modelo-csv",
      specJson: JSON.stringify({
        "Peso": "1.200 kg",
        "Altura": "1,5 m",
        "Serie": "000023",
        "Velocidad": "80 rpm",
        "Tensión": "80 V",
        "Disponible": "false",
        "Sin dato": null
      })
    }], ["categoryKey", "title", "shortDescription", "longDescription", "reference", "url", "specJson"]), "utf8");

    const options = {
      inputCsvPath: csvPath,
      categorySellFlatJsonPath: categoriesPath,
      idStart: 200000,
      companyID: 208,
      defaultImage: "https://online.gamrentals.com/img/p/es-default.jpg",
      referencePrefix: "GAM-"
    };

    await convertGamCsvToSeedTs({
      ...options,
      outputTsPath: categoryOutputPath,
      categorySellPathByCategoryKey: { elevacion: "maquinaria/elevacion" }
    });
    await convertGamCsvToSeedTsAuto({ ...options, outputTsPath: urlOutputPath });

    const categoryTs = await readFile(categoryOutputPath, "utf8");
    const urlTs = await readFile(urlOutputPath, "utf8");
    assert.equal(categoryTs, urlTs);
    assert.match(categoryTs, /"Peso": 1200/);
    assert.match(categoryTs, /"Altura": 1\.5/);
    assert.match(categoryTs, /"Serie": 23/);
    assert.match(categoryTs, /"Velocidad": 80/);
    assert.match(categoryTs, /"Tensión": "80 V"/);
    assert.match(categoryTs, /"Disponible": false/);
    assert.match(categoryTs, /"Sin dato": "null"/);

    const report: unknown = JSON.parse(await readFile(`${urlOutputPath}.report.json`, "utf8"));
    assert.deepEqual(report, {
      totalRows: 1,
      totalProductsWritten: 1,
      missingCategorySellId: {},
      ambiguousUrlSlug: {},
      usedFallbackToCategoryKey: {},
      usedDirectSlugMatch: { elevacion: 1 },
      usedNormalizedSlugMatch: {},
      unknownUrlSlug: {}
    });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
