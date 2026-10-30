import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveMercaelevaGeneralDescription } from "../mapping/providers/mercaeleva/general-description.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { mercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";

const source = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: convierte el anuncio telegráfico coherente en prosa y conserva sus datos", () => {
  for (const [reference, model, year, hours, article] of [
    ["M571-2568", "450 AJ", "2015", "2857 h", "541"],
    ["M976-1043", "450 AJ", "2015", "2838 h", "656"],
    ["M044-4093", "450 AJ SII", "2013", "3666 h", "445"]
  ] as const) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const text = resolveMercaelevaGeneralDescription(record);
    assert.ok(text);
    for (const fragment of ["Plataforma articulada diésel", model, "16 m", year, hours, article]) {
      assert.ok(text.includes(fragment), `${reference}: ${fragment}`);
    }
    assert.equal(text.includes("ALTURA DE TRABAJO"), false);
    const result = prepareSourceProduct(record);
    assert.equal(result.product.description_general, text);
    assert.equal(result.product.description, record.shortDescription ?? mercaelevaShortDescription(record));
    assert.equal(result.product.sourceUrl, record.url);
    assert.equal(result.product.reference, record.reference);
    assert.deepEqual(result.product.spec, record.specs);
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: un conflicto o un detalle no estructurado impiden reescribir la general", () => {
  for (const reference of [
    "M486-0114", "M827-8304", "M958-0132", "M928-9933", "M818-7811", "M104-0836"
  ]) {
    const record = find(reference);
    assert.equal(resolveMercaelevaGeneralDescription(record), null, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
  }
});

test("Mercaeleva: exige coincidencia de identidad, procedencia, horas, altura, año y motor", () => {
  const record = find("M571-2568");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, categoryKey: "alquiler" },
    { ...record, reference: "M571-2569" },
    { ...record, url: record.url.replace("sales.mercaeleva.com", "example.com") },
    { ...record, brand: "Genie" },
    { ...record, model: "450 AJ SII" },
    { ...record, title: record.title?.replace("16 MT", "18 MT") ?? null },
    { ...record, title: record.title?.replace("DIESEL", "ELECTRICA") ?? null },
    { ...record, year: "2014" },
    { ...record, horometer: "2838" },
    { ...record, longDescription: `${record.longDescription} SEGUNDA VIDA` },
    { ...record, longDescription: record.longDescription?.replace("HORAS 2857", "HORAS 2587") ?? null },
    { ...record, longDescription: record.longDescription?.replace("Ref. 541", "Ref. 542") ?? null },
    { ...record, specs: { ...record.specs, Modelo: "450 AJ SII" } },
    { ...record, specs: { ...record.specs, "Artículo No.": "542" } },
    { ...record, specs: { ...record.specs, "Horas laborales": "2838 h" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "18 m" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2014" } },
    { ...record, specs: { ...record.specs, "Tipo de motor": "Eléctrico" } },
    { ...record, specs: { ...record.specs, "Título adicional": "PLATAFORMA TIJERA DIESEL 16 MT" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": ["16 m", "18 m"] } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveMercaelevaGeneralDescription(variant), null, String(index));
  }
});

test("Mercaeleva: respeta el resto del corte disponible sin perder generales existentes", () => {
  const expected = new Set(["M571-2568", "M976-1043", "M044-4093"]);
  const affected = source.products.filter((record) => resolveMercaelevaGeneralDescription(record) !== null);
  assert.deepEqual(new Set(affected.map((record) => record.reference)), expected);
  for (const record of source.products) {
    const output = prepareSourceProduct(record);
    const improved = resolveMercaelevaGeneralDescription(record);
    if (improved) assert.equal(output.product.description_general, improved);
    else assert.ok(output.product.description_general || !record.longDescription?.trim());
    assert.equal(output.product.reference, record.reference);
    assert.equal(output.product.sourceUrl, record.url);
  }
});
