import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeSpecsObject } from "../../../catalog/normalization/normalize-specs.js";
import { toCsv } from "../../../shared/csv.js";
import { normalizeGamRows } from "../normalization/normalize-rows.js";
import { convertGamCsvToSeedTs as convertFull } from "../seed/convert-csv.js";
import { convertGamCsvToSeedTs as convertByCategory } from "../seed/convert-csv-by-category.js";
import { convertGamCsvToSeedTsAuto as convertByUrl } from "../seed/convert-csv-by-url.js";
import { parseSpecByRule } from "../seed/internal/spec.js";

test("N03 aplica las mismas conversiones medidas y rechazos entre normalizador y seed", () => {
  for (const [key, value, target, expected] of [
    ["Longitud (m)", "4,5", "Longitud (mm)", 4500],
    ["Longitud (m)", "4,5 m", "Longitud (mm)", 4500],
    ["Longitud (mm)", "4500 mm", "Longitud (mm)", 4500],
    ["Radio giro (m)", "6.02 m", "Radio de giro (mm)", 6020],
    ["Anchura", "81 cm", "Anchura (mm)", 810]
  ] as const) {
    assert.equal(normalizeSpecsObject({ [key]: value }).normalized[target], expected, key);
    assert.equal(parseSpecByRule(key, value), expected, key);
    assert.equal(normalizeSpecsObject({ [target]: expected }).normalized[target], expected, key);
  }
  assert.deepEqual(parseSpecByRule("Dimensiones cesta (mm)", "1200 x 800 mm"), [1200, 800]);
  assert.deepEqual(parseSpecByRule("Velocidad de desplazamiento con/sin carga (km/h)", "12/14 km/h"), [12, 14]);
  for (const [key, value] of [
    ["Longitud (m)", "4,5 cm"],
    ["Longitud (mm)", "4,5 m extra"],
    ["Peso (kg)", "1.5 t"],
    ["Altura de trabajo (mm)", "3 km"]
  ] as const) {
    assert.equal(parseSpecByRule(key, value), null, key);
  }
});

test("N04 rechaza alias incompatibles sin depender del orden y mantiene equivalentes", () => {
  for (const raw of [
    { "peso": "1500", "Peso (kg)": "1200" },
    { "Peso (kg)": "1200", "peso": "1500" },
    { "peso": "1200 kg", "Peso (kg)": "1.5 t" }
  ]) {
    const result = normalizeSpecsObject(raw);
    assert.equal(result.normalized["Peso (kg)"], undefined);
    assert.deepEqual(result.conflictingKeys, [{ key: "Peso (kg)", sources: ["peso", "Peso (kg)"] }]);
  }
  const equal = normalizeSpecsObject({ "Peso (kg)": "1200 kg", peso: "1200" });
  assert.equal(equal.normalized["Peso (kg)"], 1200);
  assert.deepEqual(equal.conflictingKeys, []);
  const different = normalizeSpecsObject({ "Peso (kg)": "1200", "peso total": "1500", "peso en vacío": "900" });
  assert.equal(different.normalized["Peso (kg)"], 1200);
  assert.deepEqual(different.conflictingKeys, []);
  assert.ok(different.unknownKeys.includes("peso total"));
  assert.ok(different.unknownKeys.includes("peso en vacío"));
  const special = normalizeSpecsObject(Object.fromEntries([["constructor", "origen"], ["__proto__", "original"]]));
  assert.deepEqual(special.unknownKeys, ["__proto__", "constructor"]);
  assert.deepEqual(special.normalized, {});
});

test("N09 preserva desconocidos originales sin convertirlos en columnas comerciales", async () => {
  const raw = { "marca": "Yale", "Certificación CE": "verificar", "Peso total": "1200 kg", "Dato ajeno": { texto: "valor" } };
  const rows = [{ reference: "GAM-X", specJson: JSON.stringify(raw) }];
  const headers = ["reference", "specJson"];
  const stats = await normalizeGamRows(rows, headers, { expandSpecColumns: true, maxValuesPerKey: 10 }, async () => {});
  const normalized: unknown = JSON.parse(rows[0]?.specJson ?? "null");
  assert.deepEqual(normalized, {
    "Certificación CE": "verificar",
    "Peso total": "1200 kg",
    "Dato ajeno": { texto: "valor" },
    Marca: "Yale"
  });
  assert.deepEqual(stats.aliasConflicts, {});
  assert.equal(stats.unknownKeys["Certificación CE"], 1);
  assert.ok(!headers.includes("spec__Certificación CE"));
  assert.ok(!headers.includes("spec__Peso total"));
  const again = await normalizeGamRows(rows, headers, { expandSpecColumns: true, maxValuesPerKey: 10 }, async () => {});
  assert.equal(again.rowsTransformed, 0);
});

test("N04 CSV conserva ambos valores al colisionar y no produce un peso canónico", async () => {
  const raw = { "peso": "1500", "Peso (kg)": "1200", "Marca": "Yale" };
  const rows = [{ reference: "GAM-C", specJson: JSON.stringify(raw), "spec__Peso (kg)": "previo" }];
  const headers = ["reference", "specJson", "spec__Peso (kg)"];
  const stats = await normalizeGamRows(rows, headers, { expandSpecColumns: true, maxValuesPerKey: 10 }, async () => {});
  assert.deepEqual(stats.aliasConflicts, { "Peso (kg)": 1 });
  assert.deepEqual(JSON.parse(rows[0]?.specJson ?? "null"), { ...raw });
  assert.equal(rows[0]?.["spec__Peso (kg)"], "");
  const again = await normalizeGamRows(rows, headers, { expandSpecColumns: true, maxValuesPerKey: 10 }, async () => {});
  assert.equal(again.rowsTransformed, 0);
});

test("los tres conversores seed utilizan medidas coherentes y bloquean colisiones", async () => {
  const folder = await mkdtemp(join(tmpdir(), "equipzilla-seed-n03-n04-"));
  try {
    const index = join(folder, "categories.json");
    const input = join(folder, "input.csv");
    await writeFile(index, JSON.stringify([
      { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
      { id: 2, parentId: 1, name: "Elevación", slug: "elevacion" }
    ]), "utf8");
    const base = {
      categoryKey: "elevacion",
      title: "Modelo",
      shortDescription: "Descripción",
      longDescription: "Descripción general",
      reference: "GAM-X",
      url: "https://online.gamrentals.com/es/elevacion/modelo",
      specJson: JSON.stringify({ "Longitud (m)": "4,5 m", "Anchura": "81 cm", "Dato propio": "Sin dato comprobado" })
    };
    const headers = ["categoryKey", "title", "shortDescription", "longDescription", "reference", "url", "specJson"];
    const options = {
      inputCsvPath: input, categorySellFlatJsonPath: index,
      idStart: 100, companyID: 208, defaultImage: "https://online.gamrentals.com/img/default.jpg"
    };
    const run = async () => {
      const full = join(folder, "full.ts");
      const category = join(folder, "category.ts");
      const url = join(folder, "url.ts");
      await convertFull({ ...options, outputTsPath: full });
      await convertByCategory({ ...options, outputTsPath: category, categorySellPathByCategoryKey: { elevacion: "maquinaria/elevacion" } });
      await convertByUrl({ ...options, outputTsPath: url });
      return Promise.all([readFile(full, "utf8"), readFile(category, "utf8"), readFile(url, "utf8")]);
    };
    await writeFile(input, toCsv([base], headers), "utf8");
    const [full, category, url] = await run();
    assert.match(full ?? "", /"Longitud \(mm\)": 4500/);
    assert.match(full ?? "", /"Anchura \(mm\)": 810/);
    for (const rendered of [category, url]) {
      assert.match(rendered ?? "", /"Longitud \(m\)": 4500/);
      assert.match(rendered ?? "", /"Anchura": 810/);
    }
    for (const variant of [convertFull, convertByCategory, convertByUrl]) {
      await writeFile(input, toCsv([{ ...base, specJson: JSON.stringify({ peso: "1500", "Peso (kg)": "1200" }) }], headers), "utf8");
      const outputTsPath = join(folder, `${variant.name}-${variant === convertByUrl ? "url" : variant === convertFull ? "full" : "category"}.ts`);
      const cfg = { ...options, outputTsPath, categorySellPathByCategoryKey: { elevacion: "maquinaria/elevacion" } };
      await assert.rejects(variant(cfg), /Especificaciones incompatibles/);
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("el CLI hace visible la colisión aunque se permitan claves desconocidas", async () => {
  const folder = await mkdtemp(join(tmpdir(), "equipzilla-normalize-alias-"));
  try {
    const input = join(folder, "source.csv");
    const output = join(folder, "normalized.csv");
    const report = join(folder, "report.json");
    const source = toCsv([{
      reference: "GAM-C",
      specJson: JSON.stringify({ peso: "1200", "Peso (kg)": "1500", "Campo propio": "literal" })
    }], ["reference", "specJson"]);
    await writeFile(input, source, "utf8");
    const executed = spawnSync(process.execPath, ["dist/tools/gam/normalize-csv.js", input, output, "--report", report, "--allow-unknown"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20000
    });
    assert.equal(executed.status, 1, executed.stderr);
    assert.match(executed.stdout, /Conflictos de alias: 1/);
    await assert.rejects(access(report));
    await assert.rejects(access(output));
    assert.equal(await readFile(input, "utf8"), source);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
