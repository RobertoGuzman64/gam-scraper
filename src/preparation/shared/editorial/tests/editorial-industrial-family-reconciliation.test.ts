import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { createCategorySlugResolver } from "../../../testing/category-slug-resolver.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { gamElevationIdentityConflict } from "../../../gam/identity/evidence/elevation-identity.js";
import { resolveEditorialSource } from "../domain/editorial-source.js";
import { resolveKnowledgeEditorial } from "../mapping/knowledge-editorial.js";

const original = (reference: string): ProductRecord => accreditedSourceRecord("gam-editorial-historical", reference);
const category = createCategorySlugResolver(await loadImportCatalog());
const another = (source: ProductRecord): ProductRecord => {
  const reference = `${source.reference}-OTRA`;
  return { ...source, reference, url: source.url.replace(`/${source.reference}-`, `/${reference}-`),
    year: null, horometer: null, serialNumber: null };
};

test("RE050 conserva los cuatro grupos históricos y sus semánticas industriales", () => {
  for (const [reference, expected] of [
    ["2738", /Capacidad de arrastre 45300 kg/u],
    ["2625", /4,5 metros/u],
    ["2627", /5,5 metros/u],
    ["159", /BRAVI SPRINT/u],
    ["4762", /XCMG XGA12ACK/u]
  ] as const) {
    const source = original(reference);
    const snapshot = JSON.stringify(source);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description ?? "", expected);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.equal(category(original("2625")), "portaferetro");
  assert.equal(category(original("159")), "preparapedido");
  assert.equal(category(original("5903")), "plataforma-unipersonal-electrica");
  assert.equal(category(original("4762")), "plataforma-articulada-electrica");
});

test("RE050 reutiliza BTS y Orion sin mezclar magnitudes, variante ni firma entre unidades", () => {
  const towingSource = original("2738");
  const towing = another(towingSource);
  const resourced: ProductRecord = {
    ...towing,
    shortDescription: towing.shortDescription?.replace("45300", "30000") ?? null,
    longDescription: towing.longDescription?.replaceAll("45.300", "30.000").replaceAll("13.600", "8.000") ?? null,
    specs: { ...towing.specs, "Capacidad de arrastre": "30000 Kg", "Capacidad de carga (kg)": "8000 KG" }
  };
  const preparedTowing = prepareSourceProduct(resourced);
  assert.equal(preparedTowing.status, "ready");
  assert.match(preparedTowing.product.description ?? "", /Capacidad de arrastre 30000 kg/u);
  assert.match(preparedTowing.product.description_general ?? "", /30\.000 kg/u);
  assert.doesNotMatch(preparedTowing.product.description_general ?? "", /45\.300 kg|13\.600 kg/u);
  assert.equal(resolveKnowledgeEditorial(resourced, resourced).general, null);
  for (const [reference, height] of [["2625", "4,5"], ["2627", "5,5"]] as const) {
    const source = another(original(reference));
    const result = prepareSourceProduct(source);
    assert.equal(result.status, "ready");
    assert.match(result.product.description ?? "", new RegExp(`${height} metros`, "u"));
    assert.equal(category(source), "portaferetro");
  }
});

test("RE050 distingue Bravi recogepedidos y XGA eléctrico sin trasvasar categorías", () => {
  const picker = another(original("159"));
  const residential = another(original("5903"));
  const articulating = another(original("4762"));
  assert.equal(category(picker), "preparapedido");
  assert.equal(category(residential), "plataforma-unipersonal-electrica");
  assert.equal(category(articulating), "plataforma-articulada-electrica");
  assert.equal(category({ ...picker, title: "Plataforma elevadora BRAVI Sprint" }), null);
  assert.equal(category({ ...residential, longDescription: "Máquina genérica" }), null);
  assert.equal(category({ ...articulating, title: "Carretilla elevadora eléctrica XCMG XGA12ACK" }), null);
  for (const source of [picker, residential, articulating]) {
    assert.equal(prepareSourceProduct(source).status, "ready");
    assert.equal(resolveKnowledgeEditorial(source, source).general, null);
  }
});

test("RE050 detecta XGA con modelo de título o resumen incompatible sin resolverlo por conjetura", () => {
  for (const reference of ["4752", "5902"]) {
    const source = original(reference);
    assert.equal(gamElevationIdentityConflict(source), true);
    const result = prepareSourceProduct(source);
    assert.equal(result.status, "review");
    assert.ok(result.issues.includes("Identidad GAM contradictoria entre título, resumen y ficha técnica"));
    assert.match(result.product.title ?? "", /XGA(?:12K|43K)/u);
    assert.notEqual(result.product.title, `Plataforma articulada diésel XCMG ${source.model === "XGA12ACK" ? "XGA12ACK" : "XGA36K"}`);
    assert.equal(result.product.reference, source.reference);
    assert.equal(result.product.sourceUrl, source.url);
  }
  const compatible = another(original("4762"));
  assert.equal(gamElevationIdentityConflict(compatible), false);
  assert.equal(prepareSourceProduct(compatible).status, "ready");
  for (const altered of [
    { ...compatible, providerId: "gomariz" },
    { ...compatible, url: "https://example.invalid/es/plataforma-articulada/xga12ack" }
  ]) {
    assert.equal(resolveEditorialSource(altered), null);
    assert.doesNotMatch(prepareSourceProduct(altered).product.description_general ?? "", /^La ficha técnica de plataforma articulada/u);
  }
});
