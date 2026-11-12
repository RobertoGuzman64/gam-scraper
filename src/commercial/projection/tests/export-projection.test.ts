import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import type { BrandLogoReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { planCommercialExport } from "../export-projection.js";
import { projectCommercialPresentation } from "../presentation-projection.js";
import { normalizePreparedEditorialPresentation } from "../../../preparation/shared/editorial/mapping/prepared-editorial-presentation.js";
import { accreditCommercialPlan } from "../../diagnostics/commercial-accreditation.js";
import { hasLoadCapacityDisagreement } from "../../validation/technical-specifications.js";
import { selectAccreditedCommercialInputs } from "../../../testing/builders/commercial-publication-selection.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { fileURLToPath } from "node:url";

const catalog: ImportCatalog = {
  categories: [
    { id: 20, parentId: null, name: "Maquinaria de Ocasión", slug: "ocasion" },
    { id: 29, parentId: 20, name: "Articuladas", slug: "articuladas" }
  ],
  attributes: [
    { id: 115, name: "Marca", type: "TEXT", required: true, unit_option: "" },
    { id: 24, name: "Neumáticos", type: "SELECT", required: false, unit_option: "Macizos / Superelásticos" }
  ],
  relations: [{ categoryID: 29, attributeID: 115 }, { categoryID: 29, attributeID: 24 }]
};
const logos: readonly BrandLogoReference[] = [
  { id: 16, brand: "JCB", slug: "jcb", logo: "https://example.org/jcb.png" },
  { id: 18, brand: "Otras Marcas", slug: "otras-marcas", logo: "https://example.org/otras.png" }
];
const source = (ref: string): ProductRecord => ({
  providerId: "gam", categoryKey: "articuladas", categoryName: "Articuladas",
  url: `https://example.org/venta/${ref}`, reference: ref, externalReference: "VISIBLE-1",
  title: "Compra JCB AB123 | GAM Online", shortDescription: "Resumen acreditado",
  longDescription: "Descripción acreditada", price: null, condition: "Segunda mano",
  brand: "JCB", model: "AB123", year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: "https://example.org/image.jpg", images: ["https://example.org/image.jpg"],
  specs: { Marca: "JCB", Modelo: "AB123" }
});
const published = (record: ProductRecord): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference,
  externalReference: record.externalReference ?? null, title: record.title,
  categorySellID: null, category: null, condition: "Segunda_Mano", price: null,
  description_title: record.title, description: record.shortDescription,
  description_general: record.longDescription, image: record.image, images: record.images ?? [],
  spec: record.specs ?? {}, attributes: []
});
const entry = (reference: string, categorySellID: number | null = 29): CommercialBaselineInput => {
  const original = source(reference);
  const product = published(original);
  return { source: original, published: product, mapped: { status: "ready", issues: [], product: {
    ...product, categorySellID, category: categorySellID === 29 ? "Articuladas" : null,
    attributes: [{ attributeID: 115, value: "JCB" }]
  } } };
};
const plan = (items: readonly CommercialBaselineInput[], environment: "develop" | "production" | null = null,
  companyID: number | null = null) => planCommercialExport(items, "gam", "a".repeat(64), catalog, logos, environment, companyID);

test("deriva contenido, metadata, categoría y atributos sin alterar la publicación técnica", () => {
  const input = entry("100");
  const snapshot = JSON.stringify(input);
  const output = plan([input]);
  assert.equal(output.total, 1);
  assert.equal(output.summary.exported, 1);
  assert.equal(output.summary.categorized, 1);
  assert.equal(output.summary.withLogo, 1);
  assert.equal(output.summary.attributes, 1);
  assert.equal(output.products[0]?.reference, "100");
  assert.equal(output.products[0]?.externalReference, "VISIBLE-1");
  assert.equal(output.products[0]?.title, "JCB AB123");
  assert.equal(output.products[0]?.category, "Articuladas");
  assert.equal(output.products[0]?.categorySellID, 29);
  assert.equal(output.products[0]?.logoID, 16);
  assert.deepEqual(output.products[0]?.attributes, [{ attributeID: 115, value: "JCB" }]);
  assert.deepEqual(output.products[0]?.metadata.tags, ["maquinaria", "segunda-mano", "articuladas", "jcb"]);
  assert.equal(output.products[0]?.metadata.featured, false);
  assert.deepEqual(output.products[0]?.spec, input.published.spec);
  assert.deepEqual(output.products[0]?.images, input.published.images);
  assert.equal(output.products[0]?.companyID, undefined);
  assert.deepEqual(output.exceptions, []);
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(plan([input]), output);
});

test("conserva todas las elegibles incluso sin categoría, y registra exclusiones de lotes y herramientas", () => {
  const unresolved = entry("101", null);
  const batch = entry("102");
  const tool = entry("103");
  const output = plan([unresolved, {
    ...batch,
    source: { ...batch.source, url: "https://example.org/lotes/102" },
    published: { ...batch.published, sourceUrl: "https://example.org/lotes/102" },
    mapped: { ...batch.mapped, product: { ...batch.mapped.product, sourceUrl: "https://example.org/lotes/102" } }
  }, {
    ...tool,
    source: { ...tool.source, categoryKey: "herramientas" }
  }]);
  assert.equal(output.total, 3);
  assert.equal(output.summary.exported, 1);
  assert.equal(output.summary.pendingCategory, 1);
  assert.equal(output.summary.excludedLots, 1);
  assert.equal(output.summary.excludedTools, 1);
  assert.equal(output.products[0]?.categorySellID, null);
  assert.deepEqual(output.products[0]?.attributes, []);
  assert.ok(output.exceptions.some((item) => item.reason === "sin-categoria"));
  assert.equal(output.excluded.length, 2);
  assert.equal(output.excluded[0]?.reason, "lote");
  assert.equal(output.excluded[1]?.reason, "herramienta");
});

test("dos máquinas con la misma referencia comercial mantienen identidades propias", () => {
  const output = plan([entry("104"), entry("105")]);
  assert.deepEqual(output.products.map((item) => item.reference), ["104", "105"]);
  assert.deepEqual(output.products.map((item) => item.externalReference), ["VISIBLE-1", "VISIBLE-1"]);
  assert.notEqual(output.products[0]?.sourceUrl, output.products[1]?.sourceUrl);
});

test("companyID solo se incorpora con entorno explícito", () => {
  assert.equal(plan([entry("106")]).products[0]?.companyID, undefined);
  assert.equal(plan([entry("106")], "production", 208).products[0]?.companyID, 208);
  assert.throws(() => plan([entry("106")], null, 208), /entorno explícito/);
  assert.throws(() => plan([entry("106")], "develop", null), /entorno explícito/);
});

test("asigna Otras Marcas si la marca no tiene logo acreditado, sin inventar precio", () => {
  const sample = entry("107");
  const published = { ...sample.published, title: "Equipo SIN MARCA", spec: { Modelo: "AB123" } };
  const output = plan([{ ...sample, published }]);
  assert.equal(output.products[0]?.logoID, 18);
  assert.equal(output.products[0]?.price, null);
  assert.deepEqual(output.exceptions, []);
  assert.equal(output.summary.withLogo, 1);
  assert.equal(output.summary.withPrice, 0);
});

test("el logo genérico se aplica solo cuando no existe correspondencia acreditada", () => {
  const generic = entry("logo-generico");
  const unidentified = { ...generic, source: { ...generic.source, brand: "FABRICANTE SIN LOGO" },
    published: { ...generic.published, title: "Equipo FABRICANTE SIN LOGO", spec: { Marca: "FABRICANTE SIN LOGO" } } };
  const output = plan([unidentified]);
  assert.equal(output.products[0]?.logoID, 18);
  assert.equal(output.summary.withLogo, 1);
  assert.equal(accreditCommercialPlan([unidentified], output, catalog, logos, null).summary.blocking, 0);
  assert.throws(() => planCommercialExport([unidentified], "gam", "a".repeat(64), catalog,
    logos.filter((logo) => logo.id !== 18), null, null), /Otras Marcas/);
});

test("atribuye solo valores compatibles y registra rechazos sin borrar fichas", () => {
  const sample = entry("108");
  const changed = { ...sample, mapped: { ...sample.mapped, product: {
    ...sample.mapped.product,
    attributes: [{ attributeID: 115, value: "JCB" }, { attributeID: 24, value: "De bandaje" }]
  } } };
  const output = plan([changed]);
  assert.deepEqual(output.products[0]?.attributes, [{ attributeID: 115, value: "JCB" }]);
  assert.ok(output.exceptions.some((item) => item.reason === "atributo-24:opcion-invalida"));
});

test("rechaza identidades cambiadas, duplicadas o categorías no hoja", () => {
  const sample = entry("109");
  assert.throws(() => plan([sample, sample]), /duplicada/);
  assert.throws(() => plan([{ ...sample, published: { ...sample.published, reference: "OTRA" } }]), /discordante/);
  const wrong = { ...sample, mapped: { ...sample.mapped, product: { ...sample.mapped.product, categorySellID: 20 } } };
  assert.throws(() => plan([wrong]), /Categoría comercial no válida/);
});

test("acredita conservación de datos, metadata y referencias visibles compartidas sin mezclarlas", () => {
  const input = [entry("301"), entry("302")];
  const commercial = plan(input);
  const audit = accreditCommercialPlan(input, commercial, catalog, logos, null);
  assert.equal(audit.summary.originals, 2);
  assert.equal(audit.summary.exported, 2);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.summary.lostFields, 0);
  assert.equal(audit.summary.normalizedTitles, 2);
  assert.equal(audit.decisions.length, 2);
  assert.equal(audit.samples.length, 1);
  assert.equal(audit.samples[0]?.count, 2);
});

test("detecta pérdidas, recategorizaciones indebidas, metadata y empresa alteradas", () => {
  const input = entry("303");
  const commercial = plan([input], "production", 208);
  const actual = commercial.products[0];
  assert.ok(actual);
  const broken = {
    ...actual,
    spec: {}, images: [], condition: "Nuevo" as const, categorySellID: null,
    companyID: 970, metadata: { ...actual.metadata, tags: [...actual.metadata.tags, "etiqueta-inesperada"] }
  };
  const audit = accreditCommercialPlan([input], { ...commercial, products: [broken] }, catalog, logos, 208);
  const issues = audit.blocking.map((item) => item.reason);
  assert.ok(issues.includes("campo-spec-changed"));
  assert.ok(issues.includes("campo-images-changed"));
  assert.ok(issues.includes("campo-condition-changed"));
  assert.ok(issues.includes("categoria-distinta-de-decision"));
  assert.ok(issues.includes("companyID-entorno-incoherente"));
  assert.ok(issues.includes("metadata-no-determinista"));
});

test("detecta atributos incompatibles, identidades omitidas y totales inconsistentes", () => {
  const input = [entry("304"), entry("305")];
  const commercial = plan(input);
  const first = commercial.products[0];
  assert.ok(first);
  const corrupted = { ...first, attributes: [{ attributeID: 24, value: "Falso" }] };
  const audit = accreditCommercialPlan(input, {
    ...commercial, products: [corrupted], summary: { ...commercial.summary, exported: 2 }
  }, catalog, logos, null);
  const issues = audit.blocking.map((item) => item.reason);
  assert.ok(issues.includes("atributos-incompatibles"));
  assert.ok(issues.includes("producto-elegible-ausente-o-excluido"));
  assert.ok(issues.includes("totales-incoherentes"));
});

test("admite referencia comercial compartida e identidad basada en número de serie", () => {
  const first = entry("306");
  const withoutRef: CommercialBaselineInput = {
    ...first,
    source: { ...first.source, reference: null, serialNumber: "SERIE-306" },
    published: { ...first.published, reference: null },
    mapped: { ...first.mapped, product: { ...first.mapped.product, reference: null } }
  };
  const commercial = plan([withoutRef]);
  const audit = accreditCommercialPlan([withoutRef], commercial, catalog, logos, null);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.decisions[0]?.status, "categorized");
});

test("distingue exclusiones acreditadas de pérdidas de producto", () => {
  const lot = entry("307");
  const excluded = {
    ...lot,
    source: { ...lot.source, url: "https://example.org/lotes/307" },
    published: { ...lot.published, sourceUrl: "https://example.org/lotes/307" },
    mapped: { ...lot.mapped, product: { ...lot.mapped.product, sourceUrl: "https://example.org/lotes/307" } }
  };
  const commercial = plan([excluded]);
  assert.equal(accreditCommercialPlan([excluded], commercial, catalog, logos, null).summary.blocking, 0);
  const audit = accreditCommercialPlan([excluded], { ...commercial, excluded: [] }, catalog, logos, null);
  assert.ok(audit.blocking.some((item) => item.reason === "exclusion-no-corresponde"));
});

test("ausencia de precio y uso del logo genérico no crean intervenciones comerciales", () => {
  const sample = entry("308");
  const input = { ...sample, published: {
    ...sample.published, title: "Equipo sin marca", spec: { Modelo: "AB123" }
  } };
  const commercial = plan([input]);
  assert.equal(commercial.products[0]?.price, null);
  assert.equal(commercial.products[0]?.logoID, 18);
  assert.deepEqual(commercial.exceptions, []);
  const audit = accreditCommercialPlan([input], commercial, catalog, logos, null);
  assert.equal(audit.summary.pending, 0);
  assert.equal(audit.summary.blocking, 0);
});

test("si existe valor resoluble y no se proyecta, el auditor sí solicita intervención", () => {
  const sample = entry("309");
  const input = { ...sample, mapped: { ...sample.mapped, product: {
    ...sample.mapped.product, attributes: []
  } } };
  const commercial = plan([input]);
  const audit = accreditCommercialPlan([input], commercial, catalog, logos, null);
  assert.deepEqual(audit.pending.map((item) => item.reason), ["atributos-resueltos-no-asignados"]);
  assert.equal(audit.summary.blocking, 0);
});

test("exporta solo maquinaria y acredita exclusión de accesorio con evidencia explícita", () => {
  const sample = entry("2373", null);
  const url = "https://online.gamrentals.com/es/plataformas-elevadoras-bravi/2373-kit-sobre-elevacion-small-e-bravi";
  const source = { ...sample.source, url, categoryKey: "marcas-nuevas", title: "KIT DE ELEVACIÓN BRAVI SMALL-E",
    shortDescription: "Accesorio para la plataforma Bravi Leonardo HD" };
  const input: CommercialBaselineInput = {
    source: { ...source, brand: "BRAVI" },
    published: { ...sample.published, sourceUrl: url },
    mapped: { ...sample.mapped, product: { ...sample.mapped.product, sourceUrl: url } }
  };
  const output = plan([input]);
  assert.equal(output.summary.exported, 0);
  assert.equal(output.summary.excludedAccessories, 1);
  assert.equal(output.summary.excludedTools, 0);
  assert.deepEqual(output.excluded.map((item) => item.reason), ["accesorio"]);
  const accreditation = accreditCommercialPlan([input], output, catalog, logos, null);
  assert.equal(accreditation.summary.blocking, 0);
  assert.equal(accreditation.summary.pending, 0);
});

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

test("la exportación conserva atributos válidos posteriores a rechazos del mismo ID", () => {
  const input = entry("asignacion-valida");
  const updated: CommercialBaselineInput = { ...input, mapped: {
    ...input.mapped, product: { ...input.mapped.product, attributes: [
      { attributeID: 24, value: "De bandaje" },
      { attributeID: 24, value: "Macizos" },
      { attributeID: 115, value: "" },
      { attributeID: 115, value: "JCB" },
      { attributeID: 24, value: "Superelásticos" }
    ] }
  } };
  const output = plan([updated]);
  assert.deepEqual(output.products[0]?.attributes, [
    { attributeID: 24, value: "Macizos" },
    { attributeID: 115, value: "JCB" }
  ]);
  assert.equal(output.summary.attributes, 2);
  assert.deepEqual(output.exceptions.map((item) => item.reason), [
    "atributo-24:opcion-invalida", "atributo-115:tipo-invalido", "atributo-24:atributo-duplicado"
  ]);
  assert.equal(accreditCommercialPlan([updated], output, catalog, logos, null).summary.blocking, 0);
});

test("filtra magnitudes incompatibles, declara las revisiones y acredita la conservación deliberada", () => {
  const input = entry("308");
  const contaminated: CommercialBaselineInput = {
    ...input,
    published: { ...input.published,
      title: "Carretilla JCB AB123 1600 kg",
      spec: { ...input.published.spec, "Capacidad de carga (kg)": "1800 KG",
        "Altura Plataforma": "6085 metros", "Altura de elevación (mm)": "#VALUE! mm" }
    }
  };
  const before = JSON.stringify(contaminated);
  const result = plan([contaminated]);
  const product = result.products[0];
  assert.ok(product);
  assert.equal(product.spec["Altura Plataforma"], undefined);
  assert.equal(product.spec["Altura de elevación (mm)"], undefined);
  assert.equal(product.spec["Capacidad de carga (kg)"], "1800 KG");
  assert.deepEqual(result.exceptions.map(({ reason }) => reason).sort(), [
    "spec-longitud-fisicamente-implausible:Altura Plataforma",
    "spec-residuo-hoja-calculo:Altura de elevación (mm)",
    "capacidad-titulo-spec-discordante"
  ].sort());
  const audit = accreditCommercialPlan([contaminated], result, catalog, logos, null);
  assert.equal(audit.summary.blocking, 0);
  assert.equal(audit.summary.pending, 2);
  assert.ok(audit.decisions[0]?.differences.some((difference) => difference.field === "spec" && difference.status === "normalized"));
  const illegal = { ...product, spec: { ...product.spec, "Altura Plataforma": "6085 metros" } };
  const rejected = accreditCommercialPlan([contaminated], { ...result, products: [illegal] }, catalog, logos, null);
  assert.ok(rejected.blocking.some(({ reason }) => reason === "especificaciones-incompatibles-expuestas"));
  assert.equal(JSON.stringify(contaminated), before);
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
