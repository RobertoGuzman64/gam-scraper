import { analyzeContentGapCampaigns } from "../coverage/content-gap-campaigns.js";
import { analyzePreparedSpecificationStage } from "../coverage/specification-stages.js";
import { analyzeEditorialKnowledgeUsage } from "../editorial/editorial-reuse.js";
import { reconcileGapCurrentEntries } from "../coverage/content-gap-population.js";
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTechnicalDensity } from "../technical/technical-density.js";
import { analyzeSpecificationCoverage } from "../coverage/specification-coverage.js";
import { analyzeSpecificationOpportunities, analyzePreparedSpecificationOpportunities } from "../coverage/specification-opportunities.js";
import { documentedPlatform } from "../../../preparation/technical/evidence/tests/reviewed-model-fixtures.js";
import type { DescriptionCoverageInput } from "../coverage/description-coverage.js";
import type { ProductRecord, SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";

const input = (reference: string, sourceSpecs: Readonly<Record<string, SpecValue>>,
  preparedSpecs: Readonly<Record<string, SpecValue>>, publishedSpecs: Readonly<Record<string, SpecValue>>,
  brand = "Marca", model = "Modelo"): DescriptionCoverageInput => {
  const url = `https://example.com/maquina/${reference}`;
  const source: ProductRecord = {
    providerId: "gam", reference, url, categoryKey: "maquinas", categoryName: "Maquinaria",
    title: `Equipo ${reference}`, brand, model, shortDescription: null, longDescription: null,
    price: null, year: null, location: null, country: null, horometer: null,
    serialNumber: null, image: null, specs: sourceSpecs
  };
  const product: ImportCandidate = {
    providerId: "gam", sourceUrl: url, reference, title: source.title,
    categorySellID: null, category: "Maquinaria", condition: null, price: null,
    description_title: source.title, description: null, description_general: null,
    image: null, images: [], spec: { Marca: brand, Modelo: model, ...preparedSpecs }, attributes: []
  };
  return { source, prepared: { status: "ready", issues: [], product },
    published: { ...product, spec: { Marca: brand, Modelo: model, ...publishedSpecs } }, origin: "original_canonico" };
};
const analyze = (inputs: readonly DescriptionCoverageInput[]) => analyzeSpecificationOpportunities(
  inputs, analyzeTechnicalDensity(inputs.map((item) => item.published)), analyzeSpecificationCoverage(inputs)
);

test("el objetivo de seis prioriza evidencias propias y no cuenta metadatos como prestaciones", () => {
  const inputs = [
    input("1", { Peso: "100 kg" }, {}, {}),
    input("2", { Capacidad: "200 kg" }, { Capacidad: "200 kg" }, {}),
    input("3", {}, {}, { Peso: "110 kg", Ancho: "1 m", Altura: "2 m", Velocidad: "3 km/h", Capacidad: "200 kg", Motor: "Eléctrico" })
  ];
  const before = JSON.stringify(inputs);
  const result = analyze(inputs);
  assert.equal(result.totals.belowTarget, 2);
  assert.equal(result.totals.missingToTarget, 12);
  assert.equal(result.totals.preparedEvidence, 1);
  assert.equal(result.totals.sourceEvidence, 1);
  assert.equal(result.totals.withoutClues, 0);
  assert.deepEqual(result.cases.map((item) => [item.reference, item.evidence]),
    [["2", "preparada_sin_publicar"], ["1", "origen_sin_preparar"]]);
  assert.deepEqual(result.cases[0]?.preparedKeys, ["Capacidad"]);
  assert.deepEqual(result.cases[1]?.sourceKeys, ["Peso (kg)"]);
  assert.equal(JSON.stringify(inputs), before);
});

test("un modelo idéntico sugiere investigación, sin trasladar sus valores a otra unidad", () => {
  const inputs = [
    input("1", {}, {}, {}, "LG", "A14"),
    input("2", { Alcance: "7 m" }, { Alcance: "7 m" }, { Alcance: "7 m" }, "LG", "A14"),
    input("3", { Alcance: "8 m" }, { Alcance: "8 m" }, { Alcance: "8 m" }, "LG", "A14"),
    input("4", {}, {}, {}, "LG", "A15")
  ];
  const result = analyze(inputs);
  assert.equal(result.totals.sameModelEvidence, 1);
  assert.equal(result.totals.withoutClues, 3);
  const first = result.cases.find((item) => item.reference === "1");
  assert.equal(first?.evidence, "mismo_modelo");
  assert.deepEqual(first?.sameModelKeys, ["Alcance"]);
  assert.deepEqual(result.cases.find((item) => item.reference === "4")?.sameModelKeys, []);
});

test("los patrones familiares se mantienen como hipótesis y las pistas sin evidencia no abren incidencias", () => {
  const inputs = [
    input("1", {}, {}, {}, "LG", "A1"),
    input("2", { "Altura de trabajo": "8 m" }, { "Altura de trabajo": "8 m" }, { "Altura de trabajo": "8 m" }, "LG", "A2"),
    input("3", { "Altura de trabajo": "9 m" }, { "Altura de trabajo": "9 m" }, { "Altura de trabajo": "9 m" }, "LG", "A3"),
    input("4", { "Altura de trabajo": "10 m" }, { "Altura de trabajo": "10 m" }, { "Altura de trabajo": "10 m" }, "LG", "A4"),
    input("5", { "Altura de trabajo": "11 m" }, { "Altura de trabajo": "11 m" }, { "Altura de trabajo": "11 m" }, "LG", "A5")
  ];
  const result = analyze(inputs);
  assert.equal(result.totals.familyObservations, 1);
  assert.equal(result.totals.withoutClues, 4);
  const first = result.cases.find((item) => item.reference === "1");
  assert.equal(first?.evidence, "patron_familiar");
  assert.deepEqual(first?.familyKeys, ["Altura de trabajo (mm)"]);
  assert.deepEqual(first?.sourceKeys, []);
  assert.deepEqual(first?.preparedKeys, []);
  assert.throws(() => analyzeSpecificationOpportunities(inputs, analyzeTechnicalDensity([]), analyzeSpecificationCoverage(inputs)),
    /Poblaciones incompatibles/);
});


test("las oportunidades preparadas excluyen pendientes de publicar y observaciones exclusivamente publicadas", () => {
  const items = [
    input("1", { Peso: "100 kg" }, { Peso: "100 kg" }, {}),
    input("2", { Capacidad: "200 kg" }, {}, { Capacidad: "200 kg" }),
    input("3", {}, {}, { Motor: "Eléctrico" }),
    input("4", {}, {}, { Motor: "Eléctrico" })
  ];
  const published = analyze(items);
  assert.equal(published.totals.preparedEvidence, 1);
  const prepared = analyzePreparedSpecificationOpportunities(items.map(({ source, prepared, origin }) => ({ source, prepared, origin })),
    analyzeTechnicalDensity(items.map((item) => item.prepared.product)));
  assert.equal(prepared.totals.preparedEvidence, 0);
  assert.deepEqual(prepared.cases.find((item) => item.reference === "2")?.sourceKeys, ["Capacidad"]);
  assert.ok(prepared.cases.every((item) => !item.sameModelKeys.includes("Motor")));
});

const denseSpecs = { "Altura de trabajo": "10 m", "Anchura": "1 m", "Longitud": "2 m", Peso: "1000 kg",
  "Altura de plataforma": "8 m", Motor: "Eléctrico" };
const platform = (reference: string, sourceSpecs: Readonly<Record<string, SpecValue>>,
  preparedSpecs: Readonly<Record<string, SpecValue>>, publishedSpecs: Readonly<Record<string, SpecValue>>, model = "A") => {
  const item = input(reference, sourceSpecs, preparedSpecs, publishedSpecs, "Marca", model);
  const title = "Plataforma de tijera";
  return { ...item, source: { ...item.source, title }, published: { ...item.published, title },
    prepared: { ...item.prepared, product: { ...item.prepared.product, title } } };
};

test("la vista de valor alcanza fichas densas y distingue el original de la materialización pendiente", () => {
  const own = platform("1", { ...denseSpecs, "Capacidad de carga": "200 kg" }, denseSpecs, denseSpecs);
  const resolved = platform("2", { ...denseSpecs, "Capacidad de carga": "200 kg" },
    { ...denseSpecs, "Capacidad de carga": "200 kg" }, denseSpecs);
  const results = analyze([own, resolved]);
  const value = results.value;
  assert.equal(results.totals.belowTarget, 0);
  assert.equal(value.totals.evaluated, 2);
  assert.equal(value.totals.atOrAboveMinimumProducts, 2);
  assert.ok(value.cases.some((item) => item.reference === "1" && item.evidence === "origen_sin_preparar" && item.essentialFields.includes("capacidad")));
  assert.ok(value.cases.some((item) => item.reference === "2" && item.evidence === "preparada_sin_publicar"));
  const prepared = analyzePreparedSpecificationOpportunities([own, resolved], analyzeTechnicalDensity([own.prepared.product, resolved.prepared.product]));
  assert.ok(!prepared.value.cases.some((item) => item.reference === "2" && item.essentialFields.includes("capacidad")));
  assert.ok(!prepared.value.cases.some((item) => item.evidence === "preparada_sin_publicar"));
});

test("equivalencias métricas y datos de origen no interpretables no se ofrecen como enriquecimiento", () => {
  const equivalent = platform("1", { ...denseSpecs, "Longitud (mm)": "2000 mm" }, denseSpecs, denseSpecs);
  const invalid = platform("2", { ...denseSpecs, "Capacidad de carga": "200 V" }, denseSpecs, denseSpecs);
  const reconstructed = { ...platform("3", { ...denseSpecs, "Capacidad de carga": "200 kg" }, denseSpecs, denseSpecs),
    origin: "reconstruccion_publicada" as const };
  const { value } = analyze([equivalent, invalid, reconstructed]);
  assert.ok(!value.cases.some((item) => item.reference === "1" && item.field === "Longitud"));
  assert.ok(value.cases.some((item) => item.reference === "2" && item.evidence === "no_evaluable" && item.essentialFields.includes("capacidad")));
  assert.ok(!value.cases.some((item) => item.reference === "3" && ["origen_sin_preparar", "documental_compatible"].includes(item.evidence)));
});

test("los pares de fichas densas son pistas, no transferencias; no mezcla familias y mantiene el orden", () => {
  const items = [platform("1", denseSpecs, denseSpecs, denseSpecs),
    platform("2", denseSpecs, { ...denseSpecs, "Capacidad de carga": "200 kg" }, { ...denseSpecs, "Capacidad de carga": "200 kg" }),
    platform("3", denseSpecs, { ...denseSpecs, "Capacidad de carga": "300 kg" }, { ...denseSpecs, "Capacidad de carga": "300 kg" })];
  const unrelated = { ...items[0]!, source: { ...items[0]!.source, reference: "4", url: "https://example.com/maquina/4", title: "Excavadora" },
    published: { ...items[0]!.published, reference: "4", sourceUrl: "https://example.com/maquina/4", title: "Excavadora" },
    prepared: { ...items[0]!.prepared, product: { ...items[0]!.prepared.product, reference: "4", sourceUrl: "https://example.com/maquina/4", title: "Excavadora" } } };
  const all = [...items, unrelated];
  const before = JSON.stringify(all);
  const { value } = analyze(all);
  const hint = value.cases.find((item) => item.reference === "1" && item.evidence === "mismo_modelo" && item.essentialFields.includes("capacidad"));
  assert.equal(hint?.peerIdentities.length, 2);
  assert.deepEqual(hint?.observations, []);
  assert.ok(!value.cases.some((item) => item.reference === "4" && item.evidence === "mismo_modelo"));
  assert.deepEqual(analyze([...all].reverse()).value, value);
  assert.equal(JSON.stringify(all), before);
});


test("la evidencia documental compatible requiere la decisión del resolutor productivo, no solo el modelo", () => {
  const source = documentedPlatform();
  const fixture = input("control", {}, {}, {});
  const product = { ...fixture.published, providerId: source.providerId, reference: source.reference,
    sourceUrl: source.url, title: source.title, spec: source.specs ?? {} };
  const item: DescriptionCoverageInput = { source, prepared: { status: "ready", issues: [], product },
    published: product, origin: "original_canonico" };
  const compatible = analyze([item]).value.cases.filter((entry) => entry.evidence === "documental_compatible");
  assert.ok(compatible.length > 0);
  assert.ok(compatible.every((entry) => entry.documents.length === 1 && entry.documents[0]?.verification.claimSha256.length === 64));
  const incompatible = { ...item, source: { ...source, longDescription: "Plataforma modificada." } };
  const blocked = analyze([incompatible]).value.cases;
  assert.ok(blocked.some((entry) => entry.evidence === "no_evaluable" && entry.documents.length > 0));
  assert.ok(!blocked.some((entry) => entry.evidence === "documental_compatible"));
});

test("una retirada acreditada de un valor no utilizable no reabre la prestación", () => {
  const item = input("hoja-invalida", { "Altura de elevación (mm)": "#VALUE! mm", "Centro de carga": "500 mm" },
    { "Centro de carga": "500 mm" }, { "Centro de carga": "500 mm" });
  assert.equal(analyzeSpecificationCoverage([item]).totals.accreditedReconciliations, 1);
  assert.ok(!analyze([item]).value.cases.some((entry) => entry.kind === "prestacion" && entry.field.startsWith("Altura de elevación")));
});

const campaignEntry = (item: DescriptionCoverageInput, family: string, providerId = item.source.providerId): DescriptionCoverageInput => {
  const title = `${family} ${item.source.brand} ${item.source.model}`;
  return { ...item, source: { ...item.source, title, providerId }, published: { ...item.published, title, providerId },
    prepared: { ...item.prepared, product: { ...item.prepared.product, title, providerId } } };
};
const campaign = (items: readonly DescriptionCoverageInput[]) => analyzeContentGapCampaigns(items,
  analyzeEditorialKnowledgeUsage(items), analyzePreparedSpecificationStage(items, true));

test("agrupa pistas propias transversales sin mezclar familias y deduplica fichas con varias señales", () => {
  const a = campaignEntry(input("a", { Peso: "2000 kg", Anchura: "2 m" }, {}, {}), "Carretilla elevadora");
  const b = campaignEntry(input("b", { Peso: "3000 kg" }, {}, {}), "Carretilla elevadora", "gomariz");
  const c = campaignEntry(input("c", { Peso: "4000 kg" }, {}, {}), "Plataforma de tijera");
  const items = [a, b, c];
  const before = JSON.stringify(items);
  const result = campaign(items);
  const sourceGroups = result.groups.filter((group) => group.evidenceType === "origen_sin_preparar");
  assert.ok(sourceGroups.some((group) => group.providers.length === 2 && group.products === 2 && group.actionable));
  assert.ok(sourceGroups.some((group) => group.providers.length === 1 && group.products === 1 && group.family !== sourceGroups.find((item) => item.providers.length === 2)?.family));
  assert.equal(result.totals.actionable.products, 3);
  assert.equal(result.totals.actionable.occurrences, 4);
  assert.equal(result.totals.products, 3);
  assert.deepEqual(result, campaign([...items].reverse()));
  assert.equal(JSON.stringify(items), before);
});

test("los indicios de modelos diferentes y las familias desconocidas no se agrupan como trabajo acreditado", () => {
  const known = ["A", "B"].flatMap((model) => [
    campaignEntry(input(`${model}1`, {}, {}, {}, "Marca", model), "Plataforma de tijera"),
    campaignEntry(input(`${model}2`, {}, { Peso: "3000 kg" }, {}, "Marca", model), "Plataforma de tijera"),
    campaignEntry(input(`${model}3`, {}, { Peso: "3200 kg" }, {}, "Marca", model), "Plataforma de tijera")
  ]);
  const unknown = [input("x", { Peso: "1000 kg" }, {}, {}), input("y", { Peso: "1200 kg" }, {}, {})];
  const result = campaign([...known, ...unknown]);
  const models = result.groups.filter((group) => group.evidenceType === "mismo_modelo" && group.cause === "prestacion");
  assert.equal(models.length, 2);
  assert.deepEqual(new Set(models.map((group) => group.variant?.model)), new Set(["A", "B"]));
  assert.ok(models.every((group) => !group.actionable && group.products === 1));
  assert.equal(result.groups.filter((group) => group.evidenceType === "origen_sin_preparar" && group.family === null).length, 2);
});

test("una clave ya preparada queda fuera de la cola productiva y exige conciliación para materializar", () => {
  const item = campaignEntry(input("pendiente", { Peso: "3000 kg" }, { Peso: "3000 kg" }, {}), "Carretilla elevadora");
  const prepared = analyzePreparedSpecificationStage([item], true);
  const knowledge = analyzeEditorialKnowledgeUsage([item]);
  const coverage = analyzeSpecificationCoverage([item]);
  const publishedDensity = analyzeTechnicalDensity([item.published]);
  const sourceHashes = new Map([[item.source.providerId, "huella"]]);
  const report = (matchedHash: string) => analyzeContentGapCampaigns([item], knowledge, prepared, {
    reconciliation: reconcileGapCurrentEntries([item], [item], [item.published], [], sourceHashes, new Map([[item.source.providerId, matchedHash]])),
    matched: [item], coverage, semantics: null, priorities: null, publishedDensity, matchedDensity: prepared.technicalDensity,
    publishedValue: analyze([item]).value.cases
  });
  const verified = report("huella");
  assert.equal(verified.totals.actionable.products, 0);
  assert.equal(verified.totals.byClassification.find((item) => item.classification === "pendiente_materializacion")?.products, 1);
  assert.equal(verified.totals.byClassification.find((item) => item.classification === "pendiente_materializacion")?.occurrences, 1);
  assert.ok(verified.groups.some((group) => group.evidenceType === "preparada_sin_publicar"));
  assert.equal(report("otra").totals.byClassification.find((item) => item.classification === "pendiente_materializacion")?.products, 0);
  assert.ok(report("otra").groups.some((group) => group.cause === "pendiente_publicacion" && group.classification === "bloqueo_evidencia"));
});
