import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readFileSync } from "node:fs";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { reconstructMercaelevaSource } from "../../diagnostics/description-source.js";
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
  const expected = new Set(["M571-2568", "M976-1043", "M044-4093", "M239-6301"]);
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

const published = JSON.parse(readFileSync(
  "catalogs/providers/mercaeleva/publications/9a8db5bd6929fdc7fce8ceb7e63705b9b168a34161cc52d9536269cff26442e2/mercaeleva-publishable.json", "utf8"
)) as readonly ImportCandidate[];
const publishedSources = published.map(reconstructMercaelevaSource);
const publishedRecord = (reference: string): ProductRecord => {
  const record = publishedSources.find((entry) => entry.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: normaliza únicamente telegramas de plataformas acreditados, sin suprimir datos", () => {
  const improved = publishedSources.filter((record) => resolveMercaelevaGeneralDescription(record) !== null);
  assert.equal(publishedSources.length, 220);
  assert.equal(improved.length, 135);
  assert.equal(new Set(improved.map((record) => record.reference)).size, 135);
  for (const record of publishedSources) {
    const original = JSON.stringify(record);
    const text = resolveMercaelevaGeneralDescription(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, record.specs);
    if (text) {
      assert.equal(prepared.product.description_general, text, record.reference ?? "sin referencia");
      assert.ok(text.includes(record.brand ?? ""));
      assert.ok(text.includes(record.model ?? ""));
      assert.ok(text.includes(record.year ?? ""));
      assert.ok(text.includes(String(record.specs?.["Artículo No."] ?? "")));
      assert.ok(!text.includes("ALTURA DE TRABAJO"));
    }
    assert.equal(JSON.stringify(record), original);
  }
  for (const reference of ["M563-8693", "M140-0406", "M057-0589", "M971-8124",
    "M940-4770", "M239-6301", "M879-4639", "M570-8735", "M017-2019"]) {
    assert.ok(resolveMercaelevaGeneralDescription(publishedRecord(reference)), reference);
  }
  for (const reference of ["M887-9469", "M028-8481", "M486-0114", "M018-7013", "M620-2142", "M838-0666", "M582-1882"]) {
    assert.equal(resolveMercaelevaGeneralDescription(publishedRecord(reference)), null, reference);
  }
});

test("Mercaeleva: rechaza divergencias entre el telegrama, los atributos y la identidad", () => {
  const record = publishedRecord("M563-8693");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, reference: "M563-8694" },
    { ...record, title: record.title?.replace("14 MT", "16 MT") ?? null },
    { ...record, brand: "JLG" },
    { ...record, model: "OTRO" },
    { ...record, year: "2022" },
    { ...record, horometer: "198 h" },
    { ...record, longDescription: `${record.longDescription} SEGUNDA VIDA` },
    { ...record, specs: { ...record.specs, "Artículo No.": "1283" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "16 m" } },
    { ...record, specs: { ...record.specs, "Tipo de motor": "Diesel" } },
    { ...record, specs: { ...record.specs, "Horas laborales": "198 h" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2022" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveMercaelevaGeneralDescription(variant), null, String(index));
  }
});

test("Mercaeleva: no sintetiza capacidades ni uso contradictorios en carretillas", () => {
  const record = publishedRecord("M940-4770");
  assert.ok(resolveMercaelevaGeneralDescription(record)?.includes("2000 kg"));
  for (const variant of [
    { ...record, title: record.title?.replace("2000 KG", "2500 KG") ?? null },
    { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": "2500 kg" } },
    { ...record, specs: { ...record.specs, "Tipo de motor": "Diesel" } },
    { ...record, specs: { ...record.specs, "Horas laborales": "16 617 h" } },
    { ...record, specs: { ...record.specs, "Año de fabricación": "2011" } },
    { ...record, horometer: "16000 h" },
    { ...record, longDescription: `${record.longDescription} BATERÍA REVISADA` }
  ]) assert.equal(resolveMercaelevaGeneralDescription(variant), null);
  for (const reference of ["M582-1882", "M011-3720", "M547-2372"]) {
    assert.equal(resolveMercaelevaGeneralDescription(publishedRecord(reference)), null, reference);
  }
});
