import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toCsv } from "../../../../shared/csv.js";
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
