import { recoverMercaelevaDocumentedEquipmentTechnicalSpecs } from "../../technical/evidence/documented-equipment-technical-specs.js";
import { recoverMercaelevaDocumentedPlatformTechnicalSpecs } from "../../technical/evidence/documented-platform-technical-specs.js";
import { readMercaelevaSource } from "../../../../testing/builders/mercaeleva-source-fixture.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveMercaelevaGeneralDescription } from "../mapping/general-description.js";
import { resolveMercaelevaDocumentedAdditionalPlatformGeneral } from "../mapping/documented-additional-platform-general.js";
import { resolveMercaelevaPreviousGenerationPlatformGeneral } from "../mapping/documented-previous-generation-platform-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { verifiedUnitContextEditorial } from "../../../shared/editorial/evidence/verified-unit-context-editorial.js";
import { mercaelevaShortDescription } from "../mapping/descriptions.js";
import { reconcileMercaelevaVerifiedReachTruckFamily } from "../../technical/reconciliation/mercaeleva.js";

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
    assert.equal(result.product.description_general, resolveMercaelevaDocumentedAdditionalPlatformGeneral(record) ?? resolveMercaelevaPreviousGenerationPlatformGeneral(record) ?? text);
    assert.equal(result.product.description, record.shortDescription ?? mercaelevaShortDescription(record));
    assert.equal(result.product.sourceUrl, record.url);
    assert.equal(result.product.reference, record.reference);
    assert.deepEqual(result.product.spec, recoverMercaelevaDocumentedEquipmentTechnicalSpecs(record, recoverMercaelevaDocumentedPlatformTechnicalSpecs(record, record.specs ?? {})));
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: transforma solo la retráctil conciliada y preserva la altura como cota no acreditada", async () => {
  const catalog = await readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json");
  const record = catalog.products.find((item) => item.reference === "M547-2372");
  assert.ok(record);
  const canonical = JSON.stringify(record);
  assert.equal(resolveMercaelevaGeneralDescription(record), null);
  const reconciled = reconcileMercaelevaVerifiedReachTruckFamily(record);
  const general = resolveMercaelevaGeneralDescription(reconciled);
  assert.ok(general);
  for (const fragment of ["Toyota 6FBRE14", "1350 kg", "6.500 mm", "14.696 horas", "2000", "MER1123", "debe comprobarse"]) {
    assert.ok(general.includes(fragment), fragment);
  }
  assert.doesNotMatch(general, /TRANSPALET ELECTRICO|ALTURA DE TRABAJO/u);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.product.description_general, general);
  assert.equal(prepared.product.reference, record.reference);
  assert.equal(prepared.product.sourceUrl, record.url);
  assert.equal(JSON.stringify(record), canonical);
  for (const variant of [
    { ...reconciled, model: "6FBRE16" },
    { ...reconciled, title: reconciled.title?.replace("1350 KG", "1500 KG") ?? null },
    { ...reconciled, url: `${reconciled.url}?source=other` },
    { ...reconciled, horometer: "14900" },
    { ...reconciled, longDescription: reconciled.longDescription?.replace("6.500 mm", "8.500 mm") ?? null },
    { ...reconciled, longDescription: reconciled.longDescription?.replace("14696", "14960") ?? null },
    { ...reconciled, specs: { ...reconciled.specs, "Capacidad máxima de elevación": "1500 kg" } },
    { ...reconciled, specs: { ...reconciled.specs, "Artículo No.": "MER1124" } },
    { ...reconciled, specs: { ...reconciled.specs, "Tipo de motor": "Diésel" } }
  ]) assert.equal(resolveMercaelevaGeneralDescription(variant), null);
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
    const editorial: Readonly<Record<string, { readonly sourceDigest: string; readonly general?: string }>> = verifiedUnitContextEditorial;
    if (editorial[`mercaeleva:${record.reference}`]?.general) {
      assert.equal(output.product.description_general, editorial[`mercaeleva:${record.reference}`]?.general);
    } else if (improved) {
      assert.equal(output.product.description_general, resolveMercaelevaDocumentedAdditionalPlatformGeneral(record) ?? resolveMercaelevaPreviousGenerationPlatformGeneral(record) ?? improved);
    }
    else assert.ok(output.product.description_general || !record.longDescription?.trim());
    assert.equal(output.product.reference, record.reference);
    assert.equal(output.product.sourceUrl, record.url);
  }
});

const publishedSources = await readMercaelevaSource();
const publishedRecord = (reference: string): ProductRecord => {
  const record = publishedSources.find((entry) => entry.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Mercaeleva: normaliza únicamente telegramas de plataformas acreditados, sin suprimir datos", () => {
  const improved = publishedSources.filter((record) => resolveMercaelevaGeneralDescription(record) !== null);
  assert.equal(publishedSources.length, 221);
  assert.equal(improved.length, 135);
  assert.equal(new Set(improved.map((record) => record.reference)).size, 135);
  for (const record of publishedSources) {
    const original = JSON.stringify(record);
    const text = resolveMercaelevaGeneralDescription(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.equal(prepared.product.reference, record.reference);
    if (text) {
      assert.ok(prepared.product.description_general, record.reference ?? "sin referencia");
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
