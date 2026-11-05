import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { includeSourceYearInGeneral } from "../../../mapping/source-year-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const providers = ["gam", "gomariz", "mercaeleva"] as const;
const sources = await Promise.all(providers.map(async (provider) =>
  readCanonicalCatalog(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`)));

const find = (provider: typeof providers[number], reference: string): ProductRecord => {
  const source = sources[providers.indexOf(provider)];
  const record = source?.products.find((item) => item.reference === reference);
  assert.ok(record, `${provider}:${reference}`);
  return record;
};

const check = (record: ProductRecord): void => {
  const original = JSON.stringify(record);
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.status, "ready");
  assert.ok(prepared.product.description_general?.includes(`Año de fabricación de esta unidad: ${record.year}.`));
  assert.equal(JSON.stringify(record), original);
};

test("las descripciones recuperan el año de fuente contrastada sin modificar los datos técnicos", () => {
  for (const [provider, reference] of [
    ["gam", "6389"], ["gam", "6806"], ["gomariz", "TE1858"],
    ["mercaeleva", "M062-8951"]
  ] as const) {
    const record = find(provider, reference);
    check(record);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.spec["Año de fabricación"], record.year);
  }
});

test("no incorpora años ambiguos, variantes, fechas de modelo ni fichas en revisión", () => {
  const gam = find("gam", "6389");
  const gomariz = find("gomariz", "TE1858");
  const mercaeleva = find("mercaeleva", "M062-8951");
  const cases: readonly ProductRecord[] = [
    { ...gam, year: "2014" },
    { ...gam, longDescription: `${gam.longDescription ?? ""} Fabricada en 2020.` },
    { ...gam, url: gam.url.replace("6389-", "9999-") },
    { ...gomariz, url: gomariz.url.replace("gomarizrent.com", "example.com") },
    { ...mercaeleva, year: "2024" },
    { ...mercaeleva, specs: { ...mercaeleva.specs, "Año del modelo": "2025" } },
    { ...mercaeleva, model: "OTRO" }
  ];
  for (const record of cases) {
    const source = prepareSourceProduct(record);
    const general = record.longDescription ?? "Descripción de prueba.";
    assert.equal(includeSourceYearInGeneral(record, general, record.shortDescription, record.specs ?? {}), general);
    assert.ok(!source.product.description_general?.includes(`Año de fabricación de esta unidad: ${record.year}.`));
  }
  const changedCanonicalYear = { ...gomariz, year: "2021" };
  const originalGeneral = gomariz.longDescription ?? "Descripción de prueba.";
  assert.equal(includeSourceYearInGeneral(changedCanonicalYear, originalGeneral, gomariz.shortDescription, gomariz.specs ?? {}), originalGeneral);
  const reviewed = find("gomariz", "BA1465");
  const result = prepareSourceProduct(reviewed);
  assert.equal(result.status, "ready");
  assert.ok(result.product.description_general?.includes("Año de fabricación de esta unidad: 2022."));
});
