import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeSpecsObject, reconcileSourceSpecsForNormalization } from "../../../catalog/normalization/normalize-specs.js";
import { toCsv } from "../../../shared/csv.js";
import { normalizeGamRows } from "../normalization/normalize-rows.js";
import { convertGamCsvToSeedTs as convertFull } from "../seed/convert-csv.js";
import { convertGamCsvToSeedTs as convertByCategory } from "../seed/convert-csv-by-category.js";
import { convertGamCsvToSeedTsAuto as convertByUrl } from "../seed/convert-csv-by-url.js";
import { normalizeSeedSpecs, parseSpecByRule } from "../seed/internal/spec.js";

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
      specJson: JSON.stringify({ "Longitud (m)": "4,5 m", "Anchura": "81 cm", "Velocidad de desplazamiento con/sin carga (km/h)": "14.8/15.7 km/h", "Dimensiones cesta (mm)": "100 x 200 mm", "Nº de serie": "000023", "Dato propio": "Sin dato comprobado" })
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
    assert.match(full ?? "", /"Nº de serie": (?:"000023"|`000023`)/);
    for (const rendered of [category, url]) {
      assert.match(rendered ?? "", /"Longitud \(mm\)": 4500/);
      assert.match(rendered ?? "", /"Anchura \(mm\)": 810/);
      assert.doesNotMatch(rendered ?? "", /"Longitud \(m\)": 4500/);
      assert.match(rendered ?? "", /"Nº de serie": (?:"000023"|`000023`)/);
      assert.match(rendered ?? "", /"Velocidad de desplazamiento con\/sin carga \(km\/h\)": \[\s*14\.8,\s*15\.7\s*\]/);
      assert.match(rendered ?? "", /"Dimensiones cesta \(mm\)": \[\s*100,\s*200\s*\]/);
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

test("el CSV normalizado conserva parejas, unidades y ejes a través de tres pasadas", async () => {
  const rows = [{
    reference: "GAM-6901-278",
    specJson: JSON.stringify({
      "Dimensiones Cesta": "1,83X1 metros",
      "Velocidad de desplazamiento con/sin carga": "8/13 km/h",
      "Dimensiones Horquillas": "100 x 200 mm",
      "Nº de serie": "000023"
    })
  }];
  const headers = ["reference", "specJson"];
  await normalizeGamRows(rows, headers, { expandSpecColumns: false, maxValuesPerKey: 10 }, async () => {});
  const first = rows[0]?.specJson;
  assert.ok(first);
  const expected = {
    "Dimensiones cesta (mm)": "1830 x 1000 mm",
    "Velocidad de desplazamiento con/sin carga (km/h)": "8 | 13",
    "Dimensiones horquillas (mm)": "100 x 200 mm",
    "Nº de serie": "000023"
  };
  assert.deepEqual(JSON.parse(first), expected);
  assert.deepEqual(normalizeSpecsObject(expected).normalized, {
    "Dimensiones cesta (mm)": { ancho: 1830, largo: 1000 },
    "Velocidad de desplazamiento con/sin carga (km/h)": [8, 13],
    "Dimensiones horquillas (mm)": { largo: 100, ancho: 200, grosor: null },
    "Nº de serie": "000023"
  });
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const stats = await normalizeGamRows(rows, headers, { expandSpecColumns: false, maxValuesPerKey: 10 }, async () => {});
    assert.equal(stats.rowsTransformed, 0);
    assert.equal(rows[0]?.specJson, first);
  }
  const flipped = normalizeSpecsObject({ "Dimensiones cesta (mm)": "100 x 200 mm" });
  assert.deepEqual(flipped.normalized["Dimensiones cesta (mm)"], { ancho: 100, largo: 200 });
  const threeAxes = normalizeSpecsObject({ "Dimensiones Horquillas": "1,2 x 0,1 x 0,04 m" });
  assert.deepEqual(threeAxes.normalized["Dimensiones horquillas (mm)"], { largo: 1200, ancho: 100, grosor: 40 });
  const thirdAxisRows = [{ reference: "GAM-3D", specJson: JSON.stringify({ "Dimensiones Horquillas": "1,2 x 0,1 x 0,04 m" }) }];
  const thirdAxisHeaders = ["reference", "specJson"];
  await normalizeGamRows(thirdAxisRows, thirdAxisHeaders, { expandSpecColumns: false, maxValuesPerKey: 10 }, async () => {});
  const triple = thirdAxisRows[0]?.specJson;
  assert.ok(triple);
  assert.deepEqual(JSON.parse(triple), { "Dimensiones horquillas (mm)": "1200 x 100 x 40 mm" });
  const thirdAgain = await normalizeGamRows(thirdAxisRows, thirdAxisHeaders, { expandSpecColumns: false, maxValuesPerKey: 10 }, async () => {});
  assert.equal(thirdAgain.rowsTransformed, 0);
  for (const invalid of ["100 x 200", "1,2 x 0,5", "100 x 200 kg"]) {
    assert.equal(normalizeSpecsObject({ "Dimensiones cesta (mm)": invalid }).normalized["Dimensiones cesta (mm)"], undefined);
  }
});

test("las listas canónicas no reinterpretan valores sueltos ni alternativas prohibidas", () => {
  const key = "Velocidad de desplazamiento con/sin carga (km/h)";
  assert.deepEqual(normalizeSpecsObject({ [key]: "14.8 / 15.7 km/h" }).normalized[key], [14.8, 15.7]);
  assert.deepEqual(normalizeSpecsObject({ [key]: "14.8 | 15.7" }).normalized[key], [14.8, 15.7]);
  assert.deepEqual(normalizeSpecsObject({ [key]: "14.8 km/h" }).normalized[key], [14.8]);
  assert.equal(normalizeSpecsObject({ "Potencia (kW)": "14.8 / 15.7 kW" }).normalized["Potencia (kW)"], "14,8 / 15,7 kW");
  assert.equal(normalizeSpecsObject({ "Potencia (kW)": "14.8 / 15.7 kVA" }).normalized["Potencia (kW)"], undefined);
  assert.equal(normalizeSpecsObject({ "Potencia (kW)": "14.8 / 15.7 / 16 kW" }).normalized["Potencia (kW)"], undefined);
  assert.equal(normalizeSpecsObject({ [key]: "14.8 | falso" }).normalized[key], undefined);
  assert.equal(normalizeSpecsObject({ [key]: "14.8 || 15.7" }).normalized[key], undefined);
  assert.equal(normalizeSpecsObject({ "Peso (kg)": "1.5 t" }).normalized["Peso (kg)"], undefined);
  assert.equal(normalizeSpecsObject({ "Peso (kg)": "1.5 kg" }).normalized["Peso (kg)"], 1.5);
});


test("CSV y seed conservan longitud de horquillas, tensiones dobles y precisión decimal", async () => {
  const forks = "Dimensiones horquillas (mm)";
  const speed = "Velocidad de desplazamiento con/sin carga (km/h)";
  const basket = "Dimensiones cesta (mm)";
  const source = { [forks]: "1185 mm", Voltios: "400/230 V", [speed]: [1.234, 2.345], [basket]: { ancho: 760.125, largo: 830.375 } };
  const expected = normalizeSpecsObject(source).normalized;
  const rows = [{ reference: "CONTROL", specJson: JSON.stringify(source) }];
  const headers = ["reference", "specJson"];
  const options = { expandSpecColumns: true, maxValuesPerKey: 10 };
  await normalizeGamRows(rows, headers, options, async () => {});
  const first = rows[0]?.specJson ?? "{}";
  assert.deepEqual(JSON.parse(first), { [forks]: "1185 mm", Voltios: "400 | 230", [speed]: "1,234 | 2,345", [basket]: "760,125 x 830,375 mm" });
  assert.deepEqual(normalizeSpecsObject(JSON.parse(first)).normalized, expected);
  assert.deepEqual(parseSpecByRule(forks, "1185 mm"), [1185]);
  assert.deepEqual(parseSpecByRule(forks, expected[forks]), [1185]);
  assert.deepEqual(parseSpecByRule("Voltios", "400 | 230"), [400, 230]);
  assert.deepEqual(parseSpecByRule(speed, "1,234 | 2,345"), [1.234, 2.345]);
  assert.deepEqual(parseSpecByRule(basket, "760,125 x 830,375 mm"), [760.125, 830.375]);
  assert.equal((await normalizeGamRows(rows, headers, options, async () => {})).rowsTransformed, 0);
  assert.equal(rows[0]?.specJson, first);
  for (const invalid of ["400 | 0", "400 | 230 | 120", "400 A | 230", "400 | 230 V", "400 | 1.234", "400 || 230"]) {
    assert.equal(parseSpecByRule("Voltios", invalid), null);
  }
  assert.equal(parseSpecByRule("voltios", "400 | 230"), null);
  const precise = [{ reference: "CONTROL", specJson: JSON.stringify({ Voltios: [1234.567, 0.0000001], [speed]: [0.0000001, 12.3456] }) }];
  await normalizeGamRows(precise, ["reference", "specJson"], options, async () => {});
  assert.deepEqual(normalizeSpecsObject(JSON.parse(precise[0]?.specJson ?? "{}")).normalized,
    { Voltios: [1234.567, 0.0000001], [speed]: [0.0000001, 12.3456] });
  assert.equal(parseSpecByRule(basket, "1185 mm"), null);
  assert.equal(parseSpecByRule(forks, "1185 kg"), null);
});


test("CSV y seed conservan la configuración eléctrica explícita del origen", async () => {
  const key = "Capacidad de la batería";
  const target = "Batería (V / Ah)";
  const source = { [key]: "24V / 315-375Ah | Li-ion 24V / 300Ah (V/Ah)", Voltios: "230 V" };
  const expected = { [target]: "24 V / 315-375 Ah | Li-ion 24 V / 300 Ah", Voltios: [230] };
  const rows = [{ reference: "CONTROL", specJson: JSON.stringify(source) }];
  const headers = ["reference", "specJson"];
  const options = { expandSpecColumns: true, maxValuesPerKey: 10 };
  const result = await normalizeGamRows(rows, headers, options, async () => {});
  const serialized = JSON.parse(rows[0]?.specJson ?? "{}");
  assert.deepEqual(serialized, { [target]: expected[target], Voltios: "230" });
  assert.deepEqual(normalizeSeedSpecs(source, "CONTROL"), expected);
  assert.deepEqual(normalizeSeedSpecs(serialized, "CONTROL"), expected);
  assert.equal(result.renamedKeysTotal, 1);
  assert.equal(result.issueCounts.invalid_value, 0);
  assert.equal((await normalizeGamRows(rows, headers, options, async () => {})).rowsTransformed, 0);
  assert.deepEqual(normalizeSeedSpecs({ [key]: "230 Ah" }, "CONTROL"), { "Capacidad de la batería (Ah)": [230] });
  for (const invalid of ["24 V / 315 A", "24 V / 375-315 Ah", "24 V / 315 Ah opcional"]) {
    assert.deepEqual(normalizeSeedSpecs({ [key]: invalid }, "CONTROL"), {});
  }
  assert.deepEqual(normalizeSeedSpecs({ "Capacidad de la batería (Ah)": "24 V / 315 Ah" }, "CONTROL"), {});
  assert.throws(() => normalizeSeedSpecs({ [key]: "24 V / 315 Ah", "Capacidad batería (Ah)": "300 Ah" }, "CONTROL"), /Especificaciones incompatibles/);
});


test("las dimensiones canónicas exportadas por el seed conservan orden, precisión y ejes al reentrar", async () => {
  const forks = "Dimensiones horquillas (mm)";
  const basket = "Dimensiones cesta (mm)";
  const options = { expandSpecColumns: true, maxValuesPerKey: 10 };
  for (const raw of ["1185 mm", "1200 x 80 mm", "1200 x 80 x 40,125 mm"]) {
    const original = { [forks]: raw, [basket]: "760,125 x 830,375 mm" };
    const expected = normalizeSpecsObject(original).normalized;
    const seed = normalizeSeedSpecs(original, "CONTROL");
    assert.deepEqual(normalizeSpecsObject(seed).normalized, expected);
    assert.deepEqual(normalizeSeedSpecs(seed, "CONTROL"), seed);
    const rows = [{ reference: "CONTROL", specJson: JSON.stringify(seed) }];
    const headers = ["reference", "specJson"];
    await normalizeGamRows(rows, headers, options, async () => {});
    const serialized: unknown = JSON.parse(rows[0]?.specJson ?? "{}");
    assert.deepEqual(normalizeSpecsObject(serialized).normalized, expected);
    assert.equal((await normalizeGamRows(rows, headers, options, async () => {})).rowsTransformed, 0);
  }
  for (const [key, invalid] of [[forks, []], [forks, [1200, null]], [forks, ["1200"]],
    [forks, [1200, 0]], [forks, [1200, 80, 40, 10]], [forks, [NaN]], [forks, [Infinity]],
    [forks, [1200, 0.0001]], [forks, [20001]], [basket, [1200]], [basket, [1200, 800, 1100]],
    [basket, [1200, -800]], [basket, [1200, "800"]], ["Dimensiones Cesta", [1200, 800]],
    ["Dimensiones Horquillas", [1200, 80]]] as const) {
    assert.deepEqual(normalizeSpecsObject({ [key]: invalid }).normalized, {}, key);
    assert.equal(parseSpecByRule(key, invalid), null, key);
  }
  const equivalent = { [basket]: [1200, 800], "Dimensiones Cesta": "1,2 x 0,8 m" };
  assert.deepEqual(normalizeSpecsObject(equivalent).normalized, { [basket]: { ancho: 1200, largo: 800 } });
  assert.throws(() => normalizeSeedSpecs({ ...equivalent, "Dimensiones Cesta": "0,8 x 1,2 m" }, "CONTROL"), /Especificaciones incompatibles/);
});


test("las columnas técnicas conservan unidades contextuales y precisión sin cambiar specJson", async () => {
  const raw = {
    "Capacidad de la cesta": "230 kg",
    "Capacidad de plataforma": "250 kg",
    "Capacidad nominal de carga": "1500 kg",
    "Capacidad de plataforma sin restricciones": "200 kg",
    "Altura máxima replegada": "2,345 m",
    "Altura máxima de plataforma": "8,125 m",
    "Altura de plataforma recogida": "1,234 m",
    "Anchura con ejes recogidos": "1,456 m",
    "Altura de elevación (m)": "4,176 m",
    "Peso (kg)": "1200 kg",
    "Nº de serie": "000023"
  };
  const rows: Record<string, string>[] = [{ reference: "SINTETICA", specJson: JSON.stringify(raw) }];
  const headers = ["reference", "specJson"];
  const options = { expandSpecColumns: true, maxValuesPerKey: 10 };
  await normalizeGamRows(rows, headers, options, async () => {});
  const row = rows[0];
  assert.ok(row);
  const expected = normalizeSpecsObject(raw).normalized;
  assert.deepEqual(JSON.parse(row.specJson ?? "null"), expected);
  const columns = Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith("spec__")).map(([key, value]) => [key.slice(6), value]));
  assert.deepEqual(normalizeSpecsObject(columns).normalized, expected);
  assert.equal(columns["Capacidad de la cesta"], "230 kg");
  assert.equal(columns["Altura máxima replegada"], "2,345 m");
  assert.equal(columns["Altura de elevación (m)"], "4,176");
  assert.equal(columns["Peso (kg)"], "1200");
  assert.equal(columns["Nº de serie"], "000023");
  const again = await normalizeGamRows(rows, headers, options, async () => {});
  assert.equal(again.rowsTransformed, 0);
  assert.deepEqual(normalizeSpecsObject({ "Capacidad de la cesta": "230", "Altura máxima replegada": "1.234 m" }).normalized, {});
});


test("CSV y seed distinguen disponibilidad de elevación libre y altura medida", async () => {
  const key = "Elevación libre";
  const target = "Elevación libre disponible";
  const measure = "Elevación libre (mm)";
  const options = { expandSpecColumns: true, maxValuesPerKey: 10 };
  for (const [source, raw, expected] of [[key, "SI", true], ["Elevacion libre", "no", false],
    [key, true, true], [key, false, false], [key, "Yes", true]] as const) {
    const input = { [source]: raw, "Capacidad de la batería": "24 V / 300 Ah" };
    const normalized = { "Batería (V / Ah)": "24 V / 300 Ah", [target]: expected };
    const row: Record<string, string> = { reference: "SINTETICA", specJson: JSON.stringify(input) };
    const headers = ["reference", "specJson"];
    const result = await normalizeGamRows([row], headers, options, async () => {});
    assert.deepEqual(JSON.parse(row.specJson ?? "{}"), normalized);
    assert.deepEqual(normalizeSeedSpecs(input, "SINTETICA"), normalized);
    assert.deepEqual(normalizeSeedSpecs(JSON.parse(row.specJson ?? "{}"), "SINTETICA"), normalized);
    assert.equal(row[`spec__${target}`], String(expected));
    assert.equal(result.renamedKeysTotal, 2);
    assert.equal(result.issueCounts.invalid_value, 0);
    assert.equal((await normalizeGamRows([row], headers, options, async () => {})).rowsTransformed, 0);
  }
  for (const raw of ["1600", "1600 mm", 1600, "1", 0]) {
    const expected = normalizeSpecsObject({ [key]: raw }).normalized;
    assert.deepEqual(normalizeSeedSpecs({ [key]: raw }, "SINTETICA"), expected);
    assert.equal(Object.hasOwn(expected, target), false);
  }
  for (const raw of ["Opcional", "Sí / No", ["Sí"], "1/0", "Sí mm"]) {
    assert.deepEqual(normalizeSeedSpecs({ [key]: raw }, "SINTETICA"), {});
  }
  assert.deepEqual(normalizeSeedSpecs({ [measure]: "SI" }, "SINTETICA"), {});
  assert.throws(() => normalizeSeedSpecs({ [key]: "NO", [measure]: "1500 mm" }, "SINTETICA"), /Especificaciones incompatibles/);
  const competing = { [key]: "NO", [target]: true };
  assert.deepEqual(reconcileSourceSpecsForNormalization(competing), { specs: competing, renames: [] });
  assert.throws(() => normalizeSeedSpecs({ [key]: "SI", "Elevacion libre": "1500 mm" }, "SINTETICA"), /Especificaciones incompatibles/);
});
