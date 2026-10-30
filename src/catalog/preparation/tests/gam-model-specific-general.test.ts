import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamModelSpecificGeneral } from "../mapping/providers/gam/model-specific-general.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const expected = new Set([
  "220", "222", "223", "224", "225", "218", "219", "226", "228",
  "2126", "2120", "2121", "2122", "2123", "2125",
  "231", "232", "230", "245", "246", "233", "229"
]);

test("GAM: aporta identidad y carga propias a las generales de familia repetidas, sin perder la fuente", () => {
  const changed: string[] = [];
  for (const record of gam.products) {
    const before = JSON.stringify(record);
    const specific = resolveGamModelSpecificGeneral(record);
    if (specific !== null) {
      assert.ok(record.reference && record.model && record.longDescription);
      changed.push(record.reference);
      assert.ok(specific.includes(record.model));
      assert.ok(specific.endsWith(record.longDescription.trim()));
      assert.ok(specific.includes("\n\n"));
      assert.ok(specific.includes(" kg."));
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.product.description_general, specific, record.reference);
      assert.equal(prepared.product.description, record.shortDescription?.trim() ?? null);
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
      assert.deepEqual(prepared.product.spec, record.specs);
    }
    assert.equal(JSON.stringify(record), before);
  }
  assert.equal(gam.products.length, 983);
  assert.deepEqual(new Set(changed), expected);
});

test("GAM: los Reach Stacker diferencian alturas y pesos publicados", () => {
  for (const reference of ["2120", "2121", "2122", "2123", "2125", "2126"]) {
    const record = find(reference);
    const result = resolveGamModelSpecificGeneral(record);
    assert.ok(result);
    const height = record.specs?.["Altura de elevación (m)"];
    const weight = record.specs?.Peso;
    assert.ok(typeof height === "string");
    assert.ok(typeof weight === "string");
    assert.ok(result.includes(`${height.replace(/ metros?$/u, "")} m`));
    assert.ok(result.includes(`${weight.replace(/ KG$/u, "").trim()} kg`));
  }
});

test("GAM: bloquea mezclas de identidad, cargas, energía y procedencia", () => {
  const logitrans = find("220");
  const reachStacker = find("2126");
  const changes: readonly ProductRecord[] = [
    { ...logitrans, providerId: "gomariz" },
    { ...logitrans, condition: "Segunda mano" },
    { ...logitrans, reference: "221" },
    { ...logitrans, model: "Logiflex MS" },
    { ...logitrans, externalReference: "Logiflex MS" },
    { ...logitrans, title: "Apilador semi eléctrico 2000 kg Logitrans Logiflex SE" },
    { ...logitrans, title: "Apilador manual 1000 kg Logitrans Logiflex SE" },
    { ...logitrans, shortDescription: "Venta de Apilador Logitrans nuevo" },
    { ...logitrans, specs: { ...logitrans.specs, "Capacidad de carga (kg)": "2000 KG" } },
    { ...logitrans, specs: { ...logitrans.specs, "Capacidad de carga (kg)": "1000 - 2000 KG" } },
    { ...logitrans, specs: { ...logitrans.specs, Modelo: "Self Maxi" } },
    { ...logitrans, specs: { ...logitrans.specs, Marca: "HYSTER" } },
    { ...logitrans, specs: { ...logitrans.specs, Motorización: "Diésel" } },
    { ...logitrans, url: logitrans.url.replace("online.gamrentals.com", "example.com") },
    { ...logitrans, url: `${logitrans.url}?q=1` },
    { ...logitrans, longDescription: "Descripción individual que sí identifica Logiflex SE." },
    { ...reachStacker, reference: "2120" },
    { ...reachStacker, specs: { ...reachStacker.specs, "Altura de elevación (m)": "NA" } },
    { ...reachStacker, specs: { ...reachStacker.specs, Peso: "9999 libras" } },
    { ...reachStacker, specs: { ...reachStacker.specs, "Capacidad de carga (kg)": "2000 KG" } },
    { ...reachStacker, title: "Reach Stacker Hyster RS46-29XD/62" }
  ];
  for (const [index, changed] of changes.entries()) {
    assert.equal(resolveGamModelSpecificGeneral(changed), null, String(index));
  }
});

test("GAM: conserva generales que no tienen evidencia suficiente o contradicen el título", () => {
  for (const reference of ["221", "227", "6236", "5949", "1218", "2028", "2305", "5996", "237", "299"]) {
    assert.equal(resolveGamModelSpecificGeneral(find(reference)), null, reference);
  }
});

test("GAM: no afecta a los originales Gomariz", async () => {
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  assert.equal(gomariz.products.length, 143);
  for (const record of gomariz.products) assert.equal(resolveGamModelSpecificGeneral(record), null);
});
