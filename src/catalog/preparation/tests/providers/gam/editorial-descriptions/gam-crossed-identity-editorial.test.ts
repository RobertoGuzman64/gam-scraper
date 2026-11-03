import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamCrossedIdentityEditorial } from "../../../../mapping/providers/gam/identity/crossed-identity-editorial.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { verifiedCanonicalBriefEditorial } from "../../../../evidence/verified-canonical-brief-editorial.js";
import { verifiedPhase163Editorial } from "../../../../evidence/verified-phase163-editorial.js";

const catalog = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const refs = [
  "6650", "5730", "6998", "6849", "6915", "6857", "6164", "1894", "4023", "2242",
  "1936", "3442", "5949", "2305", "4029", "2794", "2795", "2796", "2797", "1144"
] as const;

const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((candidate) => candidate.reference === reference);
  assert.ok(record, reference);
  return record;
};

const normalize = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase().replace(/[^a-z0-9]/gu, "");

test("corrige descripciones cruzadas usando identidad y datos del anuncio acreditado", () => {
  for (const reference of refs) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const evidence = resolveGamCrossedIdentityEditorial(record);
    assert.ok(evidence, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description, evidence.short, reference);
    assert.notEqual(prepared.product.description, record.shortDescription, reference);
    const model = reference === "4029" ? "BCS S16H" : record.model;
    assert.ok(model && normalize(evidence.short).includes(normalize(model)), reference);
    assert.equal(JSON.stringify(record), original, reference);
    assert.deepEqual(prepared.product.spec, prepareSourceProduct({ ...record }).product.spec, reference);
    if (evidence.general) {
      const revised: Readonly<Record<string, { readonly general: string }>> = verifiedCanonicalBriefEditorial;
      const phase163: Readonly<Record<string, { readonly general: string }>> = verifiedPhase163Editorial;
      assert.equal(prepared.product.description_general, phase163[`gam:${reference}`]?.general ?? revised[`gam:${reference}`]?.general ?? evidence.general, reference);
    }
  }
});

test("no atribuye características de Ibiza Dogma, Hyster H2.0FT ni Tennant BCS S16L a otra variante", () => {
  for (const [reference, forbidden] of [
    ["5949", /dogma|250\s*W|50\s*km de autonomía/iu],
    ["2305", /H2\.0FT/iu],
    ["4029", /S16L|13\.490\s*m²/iu]
  ] as const) {
    const prepared = prepareSourceProduct(find(reference));
    assert.doesNotMatch(prepared.product.description ?? "", forbidden, reference);
    const general = prepared.product.description_general ?? "";
    if (reference === "2305") {
      assert.match(general, /H2\.0FT, modelo diferente del C1\.5L/iu);
    } else if (reference === "4029") {
      assert.match(general, /S16H.*S16L.*no se debe trasladar/isu);
    } else {
      assert.match(general, /Ibiza Titanium.*Ibiza Dogma/isu);
      assert.match(general, /no se asigna una autonomía, batería o equipamiento efectivo/iu);
      assert.doesNotMatch(general, /Titanium.{0,60}50 km de autonomía/iu);
    }
    assert.match(`${find(reference).shortDescription ?? ""} ${find(reference).longDescription ?? ""}`, forbidden);
  }
  assert.match(prepareSourceProduct(find("6857")).product.description ?? "", /carece de placa identificativa/iu);
});

test("rechaza alterar proveedor, referencia, identidad, URL, especificaciones o cualquier texto de origen", () => {
  for (const reference of refs) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, reference: "OTRA" },
      { ...record, title: "Otro modelo" },
      { ...record, brand: "OTRA" },
      { ...record, model: "OTRO MODELO" },
      { ...record, externalReference: "OTRA REFERENCIA EXTERNA" },
      { ...record, url: `${record.url}?test=1` },
      { ...record, shortDescription: "Nueva descripción corta" },
      { ...record, longDescription: "Nueva descripción general" },
      { ...record, specs: { ...record.specs, Modelo: "OTRO MODELO" } }
    ];
    for (const variant of variants) {
      assert.equal(resolveGamCrossedIdentityEditorial(variant), null, reference);
    }
  }
});

const usedUnitShortRefs = ["6666", "5258", "6863", "6865", "6852", "6103", "6584"] as const;

test("corrige resúmenes de unidades usadas sin inventar identidad ni variante", () => {
  for (const reference of usedUnitShortRefs) {
    const record = find(reference);
    const evidence = resolveGamCrossedIdentityEditorial(record);
    assert.ok(evidence, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description, evidence.short, reference);
    assert.notEqual(prepared.product.description, record.shortDescription, reference);
    assert.equal(evidence.general, null, reference);
    assert.equal(resolveGamCrossedIdentityEditorial({ ...record, providerId: "gomariz" }), null, reference);
    assert.equal(resolveGamCrossedIdentityEditorial({ ...record, title: "Otra variante" }), null, reference);
    assert.equal(resolveGamCrossedIdentityEditorial({ ...record, specs: { ...record.specs, Marca: "OTRA" } }), null, reference);
  }
  assert.match(prepareSourceProduct(find("6584")).product.description ?? "", /trilateral el[eé]ctrica/iu);
  assert.doesNotMatch(prepareSourceProduct(find("6584")).product.description ?? "", /di[eé]sel/iu);
  assert.doesNotMatch(prepareSourceProduct(find("6865")).product.description ?? "", /nueva/iu);
  assert.match(prepareSourceProduct(find("6852")).product.description ?? "", /marca contradictoria/iu);
});
