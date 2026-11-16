import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toCsv } from "../../../../shared/csv.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { normalizeSeedSpecs } from "../internal/spec.js";
import { convertGamCsvToSeedTs as convertFull } from "../convert-csv.js";
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
    assert.match(categoryTs, /"Peso \(kg\)": 1200/);
    assert.match(categoryTs, /"Altura \(mm\)": 1500/);
    assert.match(categoryTs, /"Serie": "000023"/);
    assert.match(categoryTs, /"Velocidad": "80 rpm"/);
    assert.match(categoryTs, /"Tensión": "80 V"/);
    assert.match(categoryTs, /"Disponible": "false"/);
    assert.doesNotMatch(categoryTs, /"Sin dato":/);

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

test("los tres conversores preservan las especificaciones técnicas de un original GAM acreditado", async () => {
  const source = accreditedSourceRecord("gam-original", "6901");
  const snapshot = structuredClone(source);
  const title = source.title;
  const reference = source.reference;
  assert.ok(title);
  assert.ok(reference);
  const folder = await mkdtemp(join(tmpdir(), "equipzilla-seed-source-parity-"));
  try {
    const categories = join(folder, "categories.json");
    const input = join(folder, "input.csv");
    await writeFile(categories, JSON.stringify([
      { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
      { id: 2, parentId: 1, name: "Elevación", slug: "elevacion" }
    ]), "utf8");
    await writeFile(input, toCsv([{
      categoryKey: source.categoryKey,
      title,
      shortDescription: source.shortDescription ?? "",
      longDescription: source.longDescription ?? "",
      reference,
      url: source.url,
      specJson: JSON.stringify(source.specs ?? {})
    }], ["categoryKey", "title", "shortDescription", "longDescription", "reference", "url", "specJson"]), "utf8");
    const options = {
      inputCsvPath: input,
      categorySellFlatJsonPath: categories,
      idStart: 200000,
      companyID: 208,
      defaultImage: "https://online.gamrentals.com/img/p/es-default.jpg",
      referencePrefix: "GAM-",
      categorySellPathByCategoryKey: { elevacion: "maquinaria/elevacion" }
    };
    const expected = normalizeSeedSpecs(source.specs ?? {}, reference);
    for (const [index, convert] of [convertFull, convertGamCsvToSeedTs, convertGamCsvToSeedTsAuto].entries()) {
      const outputTsPath = join(folder, `output-${index}.ts`);
      await convert({ ...options, outputTsPath });
      const rendered = await readFile(outputTsPath, "utf8");
      assert.match(rendered, /"Dimensiones cesta \(mm\)": \[\s*1830,\s*1000\s*\]/u);
      assert.match(rendered, /"Nº de serie":/u);
      if (index > 0) {
        const extracted = rendered.match(/"spec"\s*:\s*(\{[^{}]*\})/u);
        assert.ok(extracted?.[1], `${index}: ${reference}`);
        const value: unknown = JSON.parse(extracted[1]);
        assert.deepEqual(value, expected);
      }
    }
    assert.deepEqual(source, snapshot);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
