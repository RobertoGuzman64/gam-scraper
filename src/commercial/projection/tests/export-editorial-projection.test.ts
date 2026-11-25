import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import { planCommercialExport } from "../export-projection.js";
import { projectCommercialPresentation } from "../presentation-projection.js";
import { normalizePreparedEditorialPresentation } from "../../../preparation/editorial/writing/prepared-editorial-presentation.js";
import { accreditCommercialPlan } from "../../diagnostics/commercial-accreditation.js";
import { hasLoadCapacityDisagreement } from "../../validation/technical-specifications.js";
import { selectAccreditedCommercialInputs } from "../../../testing/builders/commercial-publication-selection.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { fileURLToPath } from "node:url";
import { catalog, logos, source, published, entry, plan } from "./export-projection-fixture.js";

test("no crea keywords de una variante que contradice el título publicado", () => {
  const original = source("400");
  const conflicting: ProductRecord = {
    ...original, brand: "CTE", model: "B-LIFT 18HV", title: "Plataforma CTE B-LIFT 18HD",
    specs: { Marca: "CTE", Modelo: "B-LIFT 18HV" }
  };
  const projected = projectCommercialPresentation(conflicting, published(conflicting), "Plataformas sobre camión");
  assert.deepEqual(projected.metadata.keywords, [
    "plataformas-sobre-camion", "cte", "plataforma-cte-b-lift-18hd"
  ]);
  const consistent = { ...conflicting, title: "Plataforma CTE B-LIFT 18HV" };
  assert.ok(projectCommercialPresentation(consistent, published(consistent), "Plataformas sobre camión")
    .metadata.keywords.includes("b-lift-18hv"));
  const unambiguous = { ...conflicting, title: "Plataforma CTE sobre camión" };
  assert.ok(projectCommercialPresentation(unambiguous, published(unambiguous), "Plataformas sobre camión")
    .metadata.keywords.includes("b-lift-18hv"));
  assert.deepEqual(projected.spec, conflicting.specs);
  assert.equal(projected.title, conflicting.title);
});

test("descarta keywords de códigos de variante contradictorios sin inventar una identidad", () => {
  const original = source("400");
  const conflicting: ProductRecord = {
    ...original, brand: "JLG", model: "E300AJ", title: "Plataforma JLG E300AJP",
    specs: { Marca: "JLG", Modelo: "E300AJ" }
  };
  const projected = projectCommercialPresentation(conflicting, published(conflicting), "Articuladas eléctricas");
  assert.deepEqual(projected.metadata.keywords, [
    "articuladas-electricas", "jlg", "plataforma-jlg-e300ajp"
  ]);
  assert.equal(projected.spec.Modelo, "E300AJ");
  for (const title of ["Plataforma JLG E300AJ", "Plataforma JLG articulada eléctrica"]) {
    const candidate = { ...conflicting, title };
    assert.ok(projectCommercialPresentation(candidate, published(candidate), "Articuladas eléctricas")
      .metadata.keywords.includes("e300aj"));
  }
});

test("acredita resumen normalizado y detecta cualquier alteración comercial no prevista", () => {
  const input = entry("409");
  const published = { ...input.published,
    title: "Plataforma articulada 16M JCB AB123",
    description_title: "Plataforma articulada 16M JCB AB123",
    description: "➨ JCB AB123 de ocasión ➨ Venta de plataforma articulada de 16 metros ⭐Capacidad 227 kg" };
  const source = { ...input.source, title: published.title, shortDescription: published.description };
  const mapped = { ...input.mapped, product: { ...input.mapped.product, title: published.title, description: published.description } };
  const entryWithSummary: CommercialBaselineInput = { ...input, source, published, mapped };
  const before = JSON.stringify(entryWithSummary);
  const result = planCommercialExport([entryWithSummary], "gam", "a".repeat(64), catalog, logos, null, null);
  assert.equal(result.products[0]?.title, "Plataforma articulada 16 m JCB AB123");
  assert.equal(result.products[0]?.description,
    "JCB AB123 de ocasión. Venta de plataforma articulada de 16 metros. Capacidad 227 kg");
  const audit = accreditCommercialPlan([entryWithSummary], result, catalog, logos, null);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.summary.changedFields, 0);
  assert.ok(audit.decisions[0]?.differences.some((item) => item.field === "description" && item.status === "normalized"));
  assert.equal(JSON.stringify(entryWithSummary), before);
  const product = result.products[0];
  assert.ok(product);
  const broken = { ...product, description: "Capacidad 999 kg" };
  assert.ok(accreditCommercialPlan([entryWithSummary], { ...result, products: [broken] }, catalog, logos, null)
    .blocking.some((item) => item.reason === "presentacion-description-incompatible"));
});

test("la motorización se resuelve en preparación para cualquier proveedor con el hecho acreditado", () => {
  const original: ProductRecord = {
    ...source("MOT-1"), providerId: "gomariz", brand: "LGMG", model: "S0607E-2",
    title: "Plataforma de tijera LGMG S0607E-2"
  };
  const technical: ImportCandidate = { ...published(original), spec: { Motor: "Eléctrico" } };
  const editorial = normalizePreparedEditorialPresentation(original, technical);
  assert.equal(editorial.title, "Plataforma de tijera eléctrica LGMG S0607E-2");
  assert.equal(projectCommercialPresentation(original, editorial, null).title, editorial.title);
  assert.equal(projectCommercialPresentation(original, technical, null).title, original.title);
  assert.deepEqual(editorial.spec, technical.spec);
  assert.equal(normalizePreparedEditorialPresentation(original, editorial).title, editorial.title);
  assert.equal(normalizePreparedEditorialPresentation(original,
    { ...technical, spec: { Motor: "Eléctrico, Gasolina" } }).title, original.title);
  const otherProvider: ProductRecord = { ...original, providerId: "gam" };
  assert.equal(normalizePreparedEditorialPresentation(otherProvider,
    { ...technical, providerId: "gam" }).title, editorial.title);
  const truck: ProductRecord = { ...original, title: "Camión cesta SOCAGE IVECO 35S14" };
  assert.equal(normalizePreparedEditorialPresentation(truck, { ...technical, title: truck.title }).title, truck.title);
  const diesel: ProductRecord = { ...original, title: "Manipulador telescópico JCB 540-140", model: "540-140" };
  assert.equal(normalizePreparedEditorialPresentation(diesel, {
    ...technical, title: diesel.title, spec: { Motor: "Diésel" }
  }).title, "Manipulador telescópico diésel JCB 540-140");
});

test("reconoce la marca compuesta de Gomariz solo cuando ambas partes constan en el título", () => {
  const original: ProductRecord = {
    ...source("MOT-2"), providerId: "gomariz", brand: "Iveco Socage", model: "35S14",
    title: "Camión cesta SOCAGE IVECO 35S14"
  };
  const item = projectCommercialPresentation(original, published(original), null);
  assert.ok(item.metadata.tags.includes("iveco-socage"));
  assert.ok(item.metadata.keywords.includes("35s14"));
  assert.ok(!projectCommercialPresentation({ ...original, title: "Camión cesta SOCAGE 35S14" },
    { ...published(original), title: "Camión cesta SOCAGE 35S14" }, null).metadata.tags.includes("iveco-socage"));
});

test("distingue unidades por año verificable y recurre a la referencia cuando el año coincide", () => {
  const first = entry("U1");
  const second = entry("U2");
  const third = entry("U3");
  const withYears: CommercialBaselineInput[] = [
    { ...first, source: { ...first.source, year: "2020" } },
    { ...second, source: { ...second.source, year: "2021" } },
    { ...third, source: { ...third.source, year: "2021" } }
  ];
  const before = JSON.stringify(withYears);
  const output = plan(withYears);
  assert.deepEqual(output.products.map((item) => item.title), [
    "JCB AB123 · Año 2020", "JCB AB123 · Año 2021 · Ref. U2", "JCB AB123 · Año 2021 · Ref. U3"
  ]);
  assert.deepEqual(output.products.map((item) => item.description_title), output.products.map((item) => item.title));
  assert.equal(JSON.stringify(withYears), before);
  assert.equal(accreditCommercialPlan(withYears, output, catalog, logos, null).summary.blocking, 0);
  const reversed = plan([...withYears].reverse());
  assert.deepEqual(new Map(reversed.products.map((item) => [item.reference, item.title])),
    new Map(output.products.map((item) => [item.reference, item.title])));
  const sameYear = withYears.map((item) => ({ ...item, source: { ...item.source, year: "2020" } }));
  assert.deepEqual(plan(sameYear).products.map((item) => item.title), [
    "JCB AB123 · Ref. U1", "JCB AB123 · Ref. U2", "JCB AB123 · Ref. U3"
  ]);
});

test("la acreditación rechaza sufijos de unidad alterados y no admite títulos coincidentes reintroducidos", () => {
  const inputs = [entry("R1"), entry("R2")];
  const output = plan(inputs);
  const first = output.products[0];
  const second = output.products[1];
  if (!first || !second) throw new Error("Falta una unidad de prueba");
  assert.equal(output.summary.exported, 2);
  const altered = { ...first, title: "JCB AB123 · Ref. R2" };
  const audit = accreditCommercialPlan(inputs, { ...output, products: [altered, second] }, catalog, logos, null);
  assert.ok(audit.blocking.some((item) => item.reason === "presentacion-title-incompatible"));
  assert.ok(audit.pending.some((item) => item.reason === "titulo-unidad-no-diferenciada"));
  assert.equal(accreditCommercialPlan(inputs, output, catalog, logos, null).summary.blocking, 0);
});

test("no atribuye motorización ausente ni cambia una que contradice el dato técnico", () => {
  const original: ProductRecord = {
    ...source("MOT-3"), providerId: "gomariz", model: "AR14J",
    title: "Plataforma articulada diésel LGMG AR14J"
  };
  const technical = published(original);
  assert.equal(projectCommercialPresentation(original, { ...technical, spec: { Motor: "Eléctrico" } }, null).title,
    original.title);
  assert.equal(projectCommercialPresentation(original, { ...technical, spec: {} }, null).title, original.title);
});

test("la capacidad corroborada se aplica sin referencias ni excepciones por máquina", () => {
  const cases = [
    {
      reference: "1145", model: "MPC14", title: "Transpaleta YALE MPC14 2000Kg", nominal: "1400 KG",
      summary: "Transporte fácil de cargas de hasta 1,4 toneladas.", expected: "Transpaleta YALE MPC14 1400 kg",
      general: "Descripción técnica sin capacidad discordante."
    },
    {
      reference: "6837", model: "ERP25VL", title: "Carretilla elevadora eléctrica 3500 Kg YALE ERP25VL",
      nominal: "2500 KG", summary: "Capacidad de carga de 2500 kg.",
      expected: "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL",
      general: "La unidad cuenta con una capacidad de carga indicada de 3500 kg para labores de manutención."
    }
  ] as const;
  for (const item of cases) {
    const record: ProductRecord = { ...source(item.reference), brand: "YALE", model: item.model,
      title: item.title, shortDescription: item.summary, longDescription: item.general,
      specs: { Marca: "YALE", Modelo: item.model, "Capacidad de carga (kg)": item.nominal } };
    const publishedRecord = published(record);
    const normalized = normalizePreparedEditorialPresentation(record, publishedRecord);
    const projected = projectCommercialPresentation(record, normalized, "Carretillas");
    assert.equal(projected.title, item.expected);
    assert.equal(projected.description_title, item.expected);
    assert.equal(normalized.title, item.expected);
    assert.ok(!hasLoadCapacityDisagreement({ title: projected.title, spec: projected.spec }));
    assert.equal(projected.spec["Capacidad de carga (kg)"], item.nominal);
    if (item.reference === "6837") {
      assert.match(projected.description_general ?? "", /capacidad de carga indicada de 2500 kg/u);
      assert.doesNotMatch(projected.description_general ?? "", /3500 kg/u);
    } else assert.equal(projected.description_general, item.general);
    assert.equal(normalizePreparedEditorialPresentation(record, normalized).title, item.expected);
    const newUnit: ProductRecord = { ...record, reference: `${item.reference}-nueva`,
      url: `https://example.org/venta/${item.reference}-nueva` };
    const newPublished = published(newUnit);
    assert.equal(normalizePreparedEditorialPresentation(newUnit, newPublished).title, item.expected);
    assert.equal(normalizePreparedEditorialPresentation({ ...record, model: "OTRO" }, publishedRecord).title,
      item.title.replace(/(\d+)\s*Kg/iu, "$1 kg"));
    assert.equal(normalizePreparedEditorialPresentation({ ...record, shortDescription: "Sin capacidad acreditada" },
      publishedRecord).title, item.title.replace(/(\d+)\s*Kg/iu, "$1 kg"));
    assert.equal(JSON.stringify(publishedRecord), JSON.stringify(published(record)));
  }
});

test("la diferenciación parte del título corregido y no crea duplicados de capacidad", () => {
  const original = source("6837");
  const correctable: ProductRecord = { ...original, brand: "YALE", model: "ERP25VL", year: "2015",
    reference: "6837", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6837-2015-yale-erp25vl",
    title: "Carretilla elevadora eléctrica 3500 Kg YALE ERP25VL",
    shortDescription: "Capacidad de carga de 2500 kg.",
    longDescription: "Una carretilla con una capacidad de carga indicada de 3500 kg para manutención.",
    specs: { Marca: "YALE", Modelo: "ERP25VL", "Capacidad de carga (kg)": "2500 KG" } };
  const other: ProductRecord = { ...correctable, reference: "9998", year: "2018",
    url: "https://example.org/venta/9998",
    title: "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL",
    longDescription: "Modelo de capacidad nominal 2500 kg." };
  const wrap = (record: ProductRecord): CommercialBaselineInput => {
    const technical = published(record);
    return { source: record, published: technical, mapped: { status: "ready", issues: [],
      product: { ...technical, categorySellID: null, category: null, attributes: [] } } };
  };
  const output = plan([wrap(correctable), wrap(other)]);
  assert.equal(output.products.length, 2);
  assert.deepEqual(output.products.map((product) => product.title), [
    "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL · Año 2015",
    "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL · Año 2018"
  ]);
  assert.equal(output.exceptions.filter((issue) => issue.reason === "titulo-unidad-no-diferenciada").length, 0);
  assert.equal(output.exceptions.filter((issue) => issue.reason === "capacidad-titulo-spec-discordante").length, 0);
});

test("la acreditación comercial bloquea un error de escala confirmado de GAM sin reescribir datos", async () => {
  const realCatalog = await loadImportCatalog();
  const { brandLogos } = await loadCommercialReference();
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const selected = await selectAccreditedCommercialInputs(root, realCatalog, { gam: ["3993"] });
  const gam = selected.get("gam");
  assert.ok(gam);
  const output = planCommercialExport(gam.entries, "gam", gam.publicationSha256, realCatalog, brandLogos, null, null);
  const original = output.products.find((item) => item.reference === "3993");
  assert.ok(original);
  assert.equal(accreditCommercialPlan(gam.entries, output, realCatalog, brandLogos, null).blocking.some((item) =>
    item.reason === "medida-submetro-atributo-escala-multiplicada"), false);
  const invalid = { ...original, attributes: original.attributes.map((item) =>
    item.attributeID === 60 && typeof item.value === "number"
      ? { ...item, value: item.value * 1000 } : item) };
  const audit = accreditCommercialPlan(gam.entries, { ...output, products: [invalid] }, realCatalog, brandLogos, null);
  assert.ok(audit.blocking.some((item) =>
    item.reason === "medida-submetro-atributo-escala-multiplicada" && item.affected === 1));
  assert.ok(audit.decisions.find((item) => item.reference === "3993")?.blocking.includes(
    "medida-submetro-atributo-escala-multiplicada"));
  assert.deepEqual(output.products[0]?.attributes.filter((item) => item.attributeID === 60),
    [{ attributeID: 60, value: 368 }]);
});
