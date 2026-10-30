import assert from "node:assert/strict";
import test from "node:test";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { normalizeGamRows } from "../../../tools/gam/normalization/normalize-rows.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

const catalog = await loadImportCatalog();
const workingHeight = catalog.attributes.find((attribute) => attribute.name === "Altura de trabajo");
const platformHeight = catalog.attributes.find((attribute) => attribute.name === "Altura de plataforma");
assert.ok(workingHeight);
assert.ok(platformHeight);

const gamRecord = (specs: SpecsMap): ProductRecord => ({
  providerId: "gam",
  categoryKey: "elevacion",
  categoryName: "Elevación",
  url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5845-2015-jlg-10rs",
  title: "Plataforma tijera eléctrica 12M JLG 10RS",
  shortDescription: "Ficha técnica JLG 10RS",
  longDescription: "Información técnica JLG 10RS",
  price: null,
  reference: "5845",
  brand: "JLG",
  model: "10RS",
  year: "2015",
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  condition: "Segunda mano",
  image: null,
  specs
});

test("normalización conserva las unidades de origen de alturas expresadas en metros", () => {
  const result = normalizeSpecsObject({
    "altura de trabajo (m)": "14,4 metros",
    "altura plataforma (m)": "12,4 metros"
  });
  assert.equal(result.normalized["Altura de trabajo (m)"], 14.4);
  assert.equal(result.normalized["Altura plataforma (m)"], 12.4);
  assert.equal(result.normalized["Altura plataforma (mm)"], undefined);
  assert.deepEqual(result.unknownKeys, []);
});

test("los números normalizados conservan la conversión de mm a m", () => {
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": 12000 }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (m)": 12 }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (m)": "12 metros" }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": "12000 mm" }), workingHeight), 12);
});

test("rechaza unidades explícitas incompatibles y alturas contradictorias", () => {
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": "12 m" }), workingHeight), null);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (m)": "12000 mm" }), workingHeight), null);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura de trabajo (mm)": -12000 }), workingHeight), null);
  assert.equal(resolveAttributeValue(gamRecord({
    "Altura de trabajo (mm)": 12000,
    "Altura de trabajo (m)": "12 metros"
  }), workingHeight), 12);
  assert.equal(resolveAttributeValue(gamRecord({
    "Altura de trabajo (mm)": 12000,
    "Altura de trabajo (m)": "13 metros"
  }), workingHeight), null);
});

test("convierte alturas de plataforma sin mezclar mm con m", () => {
  assert.equal(resolveAttributeValue(gamRecord({ "Altura plataforma (mm)": 10000 }), platformHeight), 10);
  assert.equal(resolveAttributeValue(gamRecord({ "Altura plataforma (m)": "10 metros" }), platformHeight), 10);
});

test("la conversión de medidas normalizadas es consistente entre proveedores", () => {
  const gomariz: ProductRecord = {
    ...gamRecord({ "Altura de trabajo (mm)": 6300 }),
    providerId: "gomariz",
    categoryKey: "venta",
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507etijera-electrica-electric-scissor/",
    reference: "TE1858"
  };
  const mercaeleva: ProductRecord = {
    ...gamRecord({ "Altura de trabajo (mm)": 6300 }),
    providerId: "mercaeleva",
    categoryKey: "venta",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/BT-LPE200-8-M239-6301",
    reference: "M239-6301"
  };
  assert.equal(resolveAttributeValue(gomariz, workingHeight), 6.3);
  assert.equal(resolveAttributeValue(mercaeleva, workingHeight), 6.3);
});

test("normaliza medidas explícitas en metros a claves etiquetadas en milímetros", () => {
  const result = normalizeSpecsObject({
    "Radio de giro": "6.02 m",
    "Altura Plataforma": "2.9 metros",
    "Longitud (m)": "4,5",
    "Anchura": "81 cm",
    "Altura de trabajo (mm)": "12000 mm"
  });
  assert.equal(result.normalized["Radio de giro (mm)"], 6020);
  assert.equal(result.normalized["Altura plataforma (mm)"], 2900);
  assert.equal(result.normalized["Longitud (mm)"], 4500);
  assert.equal(result.normalized["Anchura (mm)"], 810);
  assert.equal(result.normalized["Altura de trabajo (mm)"], 12000);
});

test("no convierte medidas ambiguas, contradictorias ni compuestos en números técnicos", () => {
  const examples = [
    { key: "Altura Plataforma", value: "9225 metros", normalized: "Altura plataforma (mm)" },
    { key: "Altura Plataforma", value: "6085mm metros", normalized: "Altura plataforma (mm)" },
    { key: "Altura Plataforma", value: "24V / 150Ah metros", normalized: "Altura plataforma (mm)" },
    { key: "Altura Plataforma", value: "2.168 metros", normalized: "Altura plataforma (mm)" },
    { key: "Radio de giro (mm)", value: "6 m", normalized: "Radio de giro (mm)" },
    { key: "Altura de trabajo (m)", value: "14000 mm", normalized: "Altura de trabajo (m)" },
    { key: "Altura Plataforma", value: "- / 980 mm", normalized: "Altura plataforma (mm)" },
    { key: "Altura Plataforma", value: "-3 metros", normalized: "Altura plataforma (mm)" }
  ] as const;
  for (const example of examples) {
    const result = normalizeSpecsObject({ [example.key]: example.value });
    assert.equal(result.normalized[example.normalized], undefined, `${example.key}: ${example.value}`);
    assert.deepEqual(result.droppedNullLikeKeys, [example.normalized]);
  }
});

test("contrasta medidas reales de GAM sin confundir radios, alturas ni mezclas de unidades", async () => {
  const { readCanonicalCatalog } = await import("../../../infrastructure/filesystem/catalog/canonical-catalog.js");
  const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
  const byReference = new Map(catalog.products.map((record) => [record.reference, record]));
  for (const [reference, expected] of [["6542", 6020], ["1152", 1980], ["1145", 1980], ["912", 1980]] as const) {
    const record = byReference.get(reference);
    assert.ok(record, reference);
    assert.equal(normalizeSpecsObject(record.specs).normalized["Radio de giro (mm)"], expected);
  }
  for (const [reference, expected] of [["2155", 2900], ["157", 3350], ["2265", null], ["2110", null]] as const) {
    const record = byReference.get(reference);
    assert.ok(record, reference);
    assert.equal(normalizeSpecsObject(record.specs).normalized["Altura plataforma (mm)"] ?? null, expected);
  }
  const cleaningWidth = byReference.get("4023");
  assert.ok(cleaningWidth);
  assert.equal(normalizeSpecsObject(cleaningWidth.specs).normalized["Anchura trabajo (mm)"], 700);
});


test("la normalización de CSV GAM publica medidas en la unidad de su clave sin alterar las otras columnas", async () => {
  const row: Record<string, string> = {
    reference: "6542",
    title: "XCMG XGA43K",
    specJson: JSON.stringify({ "Radio de giro": "6.02 m", "Peso": "3200 KG", "Altura Plataforma": "6085mm metros" })
  };
  const headers = ["reference", "title", "specJson"];
  await normalizeGamRows([row], headers, { expandSpecColumns: true, maxValuesPerKey: 10 }, async () => {});
  const result: unknown = JSON.parse(row.specJson ?? "{}");
  assert.deepEqual(result, { "Radio de giro (mm)": 6020, "Peso (kg)": 3200 });
  assert.equal(row.title, "XCMG XGA43K");
  assert.equal(row["spec__Radio de giro (mm)"], "6020");
  assert.equal(row["spec__Altura plataforma (mm)"], undefined);
});


test("el original Gomariz expresado en metros se normaliza sin perder su escala", async () => {
  const { readCanonicalCatalog } = await import("../../../infrastructure/filesystem/catalog/canonical-catalog.js");
  const catalog = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  const source = catalog.products.find((record) => record.reference === "OR1537");
  assert.ok(source);
  const result = normalizeSpecsObject(source.specs);
  assert.equal(result.normalized["Altura plataforma (mm)"], 13000);
  assert.equal(result.normalized["Altura de trabajo (mm)"], 15000);
  assert.equal(result.normalized["Longitud (mm)"], 4540);
  assert.equal(result.normalized["Anchura (mm)"], 1390);
});
