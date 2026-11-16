import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toCsv } from "../../../../shared/csv.js";
import { parseCsv as parseSeedCsv } from "../internal/csv.js";
import { convertGamCsvToSeedTs as convertFull } from "../convert-csv.js";
import { convertGamCsvToSeedTs as convertCategory } from "../convert-csv-by-category.js";
import { convertGamCsvToSeedTsAuto as convertUrl } from "../convert-csv-by-url.js";

const headers = ["categoryKey", "title", "shortDescription", "longDescription", "reference", "url", "specJson"];

const csv = (specJson: string): string => toCsv([{
  categoryKey: "elevacion", title: "Máquina", shortDescription: "Descripción",
  longDescription: "Texto", reference: "GAM-S12", url: "https://online.gamrentals.com/es/elevacion/modelo", specJson
}], headers);

test("N12 las tres variantes de seed rechazan valores corruptos sin generar productos ni informes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-seed-corrupt-"));
  try {
    const index = join(dir, "categories.json");
    const input = join(dir, "input.csv");
    await writeFile(index, JSON.stringify([
      { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
      { id: 2, parentId: 1, name: "Elevación", slug: "elevacion" }
    ]), "utf8");
    const settings = {
      inputCsvPath: input, categorySellFlatJsonPath: index,
      idStart: 100, companyID: 208, defaultImage: "https://online.gamrentals.com/img/default.jpg",
      categorySellPathByCategoryKey: { elevacion: "maquinaria/elevacion" }
    };
    const variants = [convertFull, convertCategory, convertUrl];
    for (const specJson of ["{invalid", "[]", "null", "2", '"texto"']) {
      const original = csv(specJson);
      await writeFile(input, original, "utf8");
      for (const [indexVariant, convert] of variants.entries()) {
        const outputTsPath = join(dir, `out-${indexVariant}.ts`);
        await assert.rejects(convert({ ...settings, outputTsPath }), /specJson inválido en GAM-S12/);
        await assert.rejects(access(outputTsPath));
        await assert.rejects(access(`${outputTsPath}.report.json`));
      }
      assert.equal(await readFile(input, "utf8"), original);
    }
    await writeFile(input, csv("{}"), "utf8");
    for (const [indexVariant, convert] of variants.entries()) {
      const outputTsPath = join(dir, `out-${indexVariant}.ts`);
      await convert({ ...settings, outputTsPath });
      assert.match(await readFile(outputTsPath, "utf8"), /(?:spec:|"spec":) \{\}/);
    }
    await writeFile(input, csv(""), "utf8");
    for (const [indexVariant, convert] of variants.entries()) {
      const outputTsPath = join(dir, `out-${indexVariant}.ts`);
      await convert({ ...settings, outputTsPath });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("N12 el CLI original propaga el fallo y no escribe el seed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-seed-cli-"));
  try {
    const index = join(dir, "categories.json");
    const input = join(dir, "input.csv");
    const output = join(dir, "output.ts");
    await writeFile(index, JSON.stringify([
      { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
      { id: 2, parentId: 1, name: "Elevación", slug: "elevacion" }
    ]), "utf8");
    await writeFile(input, csv("{invalid"), "utf8");
    for (const script of [
      "dist/tools/gam/seed/convert-csv.js",
      "dist/tools/gam/seed/convert-csv-by-category.js",
      "dist/tools/gam/seed/convert-csv-by-url.js"
    ]) {
      const executed = spawnSync(process.execPath, [script, input, output, index], {
        cwd: process.cwd(), encoding: "utf8", timeout: 20000
      });
      assert.equal(executed.status, 1, `${script}: ${executed.stderr}`);
      assert.match(`${executed.stdout}${executed.stderr}`, /specJson inválido/);
      await assert.rejects(access(output));
      await assert.rejects(access(`${output}.report.json`));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("el CSV de semillas conserva campos multilínea y comillas en las tres rutas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "equipzilla-seed-csv-roundtrip-"));
  try {
    const index = join(dir, "categories.json");
    const input = join(dir, "input.csv");
    const rows = [{
      categoryKey: "elevacion",
      title: 'Modelo "alto"',
      shortDescription: "Primera línea\nSegunda línea, con coma",
      longDescription: 'Descripción con "comillas"\ny salto',
      reference: "GAM-6901",
      url: "https://online.gamrentals.com/es/elevacion/modelo",
      specJson: JSON.stringify({ "Dimensiones Cesta": "1,83X1 metros", "Nº de serie": "000023" })
    }];
    const source = toCsv(rows, headers);
    await writeFile(index, JSON.stringify([
      { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
      { id: 2, parentId: 1, name: "Elevación", slug: "elevacion" }
    ]), "utf8");
    const options = {
      inputCsvPath: input, categorySellFlatJsonPath: index,
      idStart: 100, companyID: 208, defaultImage: "https://online.gamrentals.com/img/default.jpg",
      categorySellPathByCategoryKey: { elevacion: "maquinaria/elevacion" }
    };
    for (const lineEnding of ["\n", "\r\n"]) {
      const csvText = lineEnding === "\n" ? source : source.replace(/\n/g, "\r\n");
      await writeFile(input, csvText, "utf8");
      const parsed = parseSeedCsv(csvText);
      assert.equal(parsed.rows.length, 1);
      const decoded = parsed.rows[0];
      assert.ok(decoded);
      assert.equal(decoded[2], rows[0]?.shortDescription.replace(/\n/g, lineEnding));
      assert.equal(decoded[3], rows[0]?.longDescription.replace(/\n/g, lineEnding));
      assert.equal(decoded[6], rows[0]?.specJson);
      const encoded = toCsv([Object.fromEntries(headers.map((name, index) => [name, decoded[index] ?? ""]))], headers);
      assert.deepEqual(parseSeedCsv(encoded).rows, parsed.rows);
      for (const [indexVariant, convert] of [convertFull, convertCategory, convertUrl].entries()) {
        const outputTsPath = join(dir, `out-${indexVariant}.ts`);
        await convert({ ...options, outputTsPath });
        const output = await readFile(outputTsPath, "utf8");
        assert.match(output, /Modelo \\"alto\\"|Modelo "alto"/);
        assert.match(output, /1830/);
        assert.match(output, /1000/);
        assert.match(output, /000023/);
        assert.match(output, /Segunda línea, con coma/);
        assert.match(output, /comillas/);
      }
    }
    for (const malformed of [
      source.replace('"Primera línea', '"Primera línea"z'),
      'categoryKey,title\n"sin cerrar',
      'categoryKey,title\nelevacion',
      source.replace("reference,url", "reference,reference"),
      source.replace("reference,url", "reference, reference"),
      source.replace("reference,url", "reference,")
    ]) {
      await writeFile(input, malformed, "utf8");
      for (const [indexVariant, convert] of [convertFull, convertCategory, convertUrl].entries()) {
        const outputTsPath = join(dir, `out-${indexVariant}.ts`);
        const previous = await readFile(outputTsPath, "utf8");
        await assert.rejects(convert({ ...options, outputTsPath }), /CSV inválido/);
        assert.equal(await readFile(outputTsPath, "utf8"), previous);
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
