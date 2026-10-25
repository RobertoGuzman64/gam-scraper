import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeGamRows } from "../normalization/normalize-rows.js";
import { loadCategoryResolver } from "../seed/internal/category-path.js";
import { parseScalar } from "../seed/internal/category-path-scalar.js";

test("normalización GAM conserva series, columnas ampliadas e inválidos", async () => {
  const rows = [
    {
      reference: "GAM-001",
      specJson: JSON.stringify({ Marca: "Yale", "Nº de serie": "000023", "Altura de trabajo": "10 m" }),
      spec__Marca: "anterior"
    },
    { reference: "GAM-002", specJson: "{invalid", spec__Marca: "anterior" }
  ];
  const headers = ["reference", "specJson", "spec__Marca"];
  const stats = await normalizeGamRows(rows, headers, { expandSpecColumns: true, maxValuesPerKey: 50 }, async () => {});

  assert.equal(stats.rowsWithSpecJson, 2);
  assert.equal(stats.rowsWithInvalidSpecJson, 1);
  assert.deepEqual(stats.unknownKeys, {});
  assert.equal(JSON.parse(rows[0]?.specJson ?? "{}")["Nº de serie"], "000023");
  assert.equal(rows[0]?.spec__Marca, "Yale");
  assert.equal(rows[1]?.specJson, "{invalid");
  assert.equal(rows[1]?.spec__Marca, "anterior");
  assert.ok(headers.includes("spec__Altura de trabajo (mm)"));
  assert.ok(headers.includes("spec__Nº de serie"));
});

test("conversión GAM por categoría mantiene resolución jerárquica y escalares", async () => {
  const folder = await mkdtemp(join(tmpdir(), "equipzilla-category-"));
  const file = join(folder, "categories.json");
  try {
    await writeFile(file, JSON.stringify([
      { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
      { id: 2, parentId: 1, name: "Elevación", slug: "elevacion" }
    ]), "utf8");
    const resolveCategory = await loadCategoryResolver(file);
    assert.equal(resolveCategory("maquinaria/elevacion"), 2);
    assert.equal(resolveCategory("maquinaria/desconocido"), null);
    assert.equal(parseScalar("1.200 kg"), 1200);
    assert.equal(parseScalar("1,5 m"), 1.5);
    assert.equal(parseScalar("true"), true);
    assert.equal(parseScalar("000023"), 23);
    assert.equal(parseScalar("80 V"), "80 V");
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
