import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { createPreparedSourceFixture } from "../../../testing/builders/prepared-source-fixture.js";
import { originalRecordFingerprint } from "../../identity-fingerprint.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { attachNormalizationPublication, attachNormalizationPublications, inspectNormalizationProduct, inspectNormalizationStage } from "../normalization/normalization-audit.js";
import { discoverNormalizationPatterns } from "../normalization/normalization-patterns.js";
import { contrastNormalizationProduct } from "../normalization/normalization-contrast.js";
import { evaluateNormalizationChecks, summarizeNormalizationChecks, type NormalizationCheck, type NormalizationCheckContext, type NormalizationCheckFinding } from "../normalization/normalization-checks.js";
import { normalizationReentryChecks } from "../normalization/normalization-reentry.js";
import { analyzeNormalizationImpact } from "../normalization/normalization-impact.js";

const prepare = createPreparedSourceFixture();
const record = (specs: SpecsMap): ProductRecord => ({
  providerId: "gam", categoryKey: "plataformas-tijera", categoryName: "Plataformas de tijera",
  url: "https://online.gamrentals.com/es/plataformas/SINTETICA-plataforma-tijera-marca-modelo",
  reference: "SINTETICA", title: "Plataforma de tijera Marca Modelo",
  shortDescription: null, longDescription: null, price: null, brand: "Marca", model: "Modelo",
  year: null, location: null, country: null, horometer: null, serialNumber: null, image: null, specs
});

test("conserva claves, valores, unidades y resultados exactos del normalizador existente", () => {
  const specs = Object.freeze({ "Anchura total": "1,2 m", "Altura de trabajo (m)": "8 m", "Tracción 4x4": false });
  const original = inspectNormalizationStage("original", specs);
  const normalized = normalizeSpecsObject(specs).normalized;
  assert.equal(original.stage, "original");
  assert.deepEqual(original.specifications.map((item) => [item.rawKey, item.rawValue]), Object.entries(specs));
  assert.equal(original.specifications.length, 3);
  for (const observation of original.specifications) {
    if (observation.kind !== "interpretada") assert.fail("Interpretación esperada");
    assert.equal(observation.assessment, "observacion_acreditada");
    assert.deepEqual(observation.normalizedValue, normalized[observation.canonicalKey]);
  }
  assert.equal(original.specifications[0]?.canonicalKey, "Anchura (mm)");
  assert.equal(original.specifications[1]?.canonicalKey, "Altura de trabajo (m)");
});

test("una clave desconocida no se convierte en defecto ni en equivalencia", () => {
  const result = inspectNormalizationStage("preparacion", { "Prestación inédita": "1,2 m" });
  assert.deepEqual(result.specifications, [{ rawKey: "Prestación inédita", rawValue: "1,2 m",
    canonicalKey: "Prestación inédita", kind: "no_reconocida", assessment: "no_evaluable", rule: null }]);
});

test("los conflictos de alias se conservan sin seleccionar un valor", () => {
  const result = inspectNormalizationStage("original", { "Anchura": "1200 mm", "Anchura total": "1500 mm" });
  assert.equal(result.specifications.length, 2);
  for (const observation of result.specifications) {
    if (observation.kind !== "descartada") assert.fail("Conflicto esperado");
    assert.equal(observation.assessment, "hipotesis");
    assert.ok(observation.reasons.includes("alias_conflict"));
    assert.equal("normalizedValue" in observation, false);
  }
});

test("los rechazos condicionales y las ausencias explícitas no tienen la misma evidencia", () => {
  const result = inspectNormalizationStage("original", { "Peso (kg)": "1000 / 1500", "Carga Máxima (kg)": "n/a" });
  assert.deepEqual(result.specifications.map((item) => item.kind === "descartada" ? [item.assessment, item.reasons] : item.kind),
    [["hipotesis", ["conditional_value"]], ["no_evaluable", ["null_like"]]]);
});

test("una magnitud igual en prestaciones distintas no se fusiona", () => {
  const result = inspectNormalizationStage("publicacion", { "Altura de trabajo (m)": "8 m", "Altura plataforma (m)": "8 m" });
  assert.equal(result.stage, "publicacion");
  assert.deepEqual(result.specifications.map((item) => item.canonicalKey), ["Altura de trabajo (m)", "Altura plataforma (m)"]);
  assert.equal(inspectNormalizationStage("original", {}).specifications.length, 0);
});

test("utiliza la preparación real y conserva identidad, familia, huella y procedencia sin mutaciones", () => {
  const source = record({ "Anchura total": "1200 mm", "Altura de trabajo": "8 m" });
  const prepared = prepare(source);
  const before = JSON.stringify([source, prepared]);
  const result = inspectNormalizationProduct(source, prepared);
  assert.equal(result.identity, "gam:ref:sintetica");
  assert.equal(result.providerId, source.providerId);
  assert.equal(result.sourceUrl, source.url);
  assert.equal(result.family, "plataforma-tijera");
  assert.equal(result.originalRecordSha256, originalRecordFingerprint(source));
  assert.deepEqual(result.technicalProvenance, prepared.technicalProvenance ?? null);
  assert.equal(result.original.stage, "original");
  assert.equal(result.prepared.stage, "preparacion");
  assert.equal(result.prepared.specifications.length, Object.keys(prepared.product.spec).length);
  assert.equal(JSON.stringify([source, prepared]), before);
});

test("rechaza preparaciones de otra fuente o con huella de otro original", () => {
  const source = record({ "Peso (kg)": 1200 });
  const prepared = prepare(source);
  assert.throws(() => inspectNormalizationProduct({ ...source, url: "https://example.test/otra" }, prepared), /no conciliada/);
  assert.throws(() => inspectNormalizationProduct({ ...source, providerId: "otro" }, prepared), /no conciliada/);
  assert.ok(prepared.technicalProvenance);
  assert.throws(() => inspectNormalizationProduct({ ...source, specs: { "Peso (kg)": 1300 } }, prepared), /no conciliada/);
});

test("una familia sin identidad editorial acreditable permanece sin resolver", () => {
  const source = { ...record({ "Anchura total": "1200 mm" }), brand: null, model: null };
  const result = inspectNormalizationProduct(source, prepare(source));
  assert.equal(result.family, null);
  assert.equal(result.original.specifications.length, 1);
});

test("no pierde alias equivalentes ni valores cero", () => {
  const result = inspectNormalizationStage("preparacion", { "Anchura": "1,2 m", "Anchura total": "1200 mm", "Horas (h)": 0 });
  assert.equal(result.specifications.length, 3);
  assert.deepEqual(result.specifications.slice(0, 2).map((item) => item.kind === "interpretada" ? item.normalizedValue : item.kind), [1200, 1200]);
  const zero = result.specifications[2];
  assert.equal(zero?.rawValue, 0);
  if (zero?.kind !== "interpretada") assert.fail("Cero válido esperado");
  assert.equal(zero.normalizedValue, 0);
});

const patternProduct = (reference: string, specs: SpecsMap, overrides: Partial<ProductRecord> = {}) => {
  const source = { ...record(specs), reference,
    url: `https://online.gamrentals.com/es/plataformas/${reference}-plataforma-tijera-marca-modelo`, ...overrides };
  const observed = inspectNormalizationProduct(source, prepare(source));
  return { ...observed, prepared: inspectNormalizationStage("preparacion", {}) };
};

const patternsOf = (inputs: Parameters<typeof discoverNormalizationPatterns>[0], kind: ReturnType<typeof discoverNormalizationPatterns>[number]["kind"], key: string) =>
  discoverNormalizationPatterns(inputs).filter((pattern) => pattern.kind === kind && pattern.key === key);

test("descubre alias y representaciones de una misma magnitud entre proveedores sin sustituir el valor", () => {
  const a = patternProduct("A", { "Anchura total": "1,2 m" });
  const b = patternProduct("B", { "Ancho total": "1200 mm" }, {
    providerId: "gomariz", categoryKey: "venta", condition: "Segunda mano",
    url: "https://www.gomarizrent.com/producto/plataforma-tijera-marca-modelo/"
  });
  assert.equal(a.family, "plataforma-tijera");
  assert.equal(b.family, a.family);
  const inputs = [a, b];
  const before = JSON.stringify(inputs);
  const patterns = discoverNormalizationPatterns(inputs);
  for (const kind of ["alias", "unidad", "formato_numerico"]) {
    const pattern = patterns.find((item) => item.kind === kind && item.key === "Anchura (mm)");
    assert.ok(pattern);
    assert.equal(pattern.assessment, "observacion_acreditada");
    assert.equal(pattern.variants.length, 2);
    const occurrences = pattern.variants.flatMap((variant) => variant.occurrences);
    assert.deepEqual(new Set(occurrences.map((item) => item.providerId)), new Set(["gam", "gomariz"]));
    assert.deepEqual(new Set(occurrences.map((item) => item.specification.rawValue)), new Set(["1,2 m", "1200 mm"]));
    if (kind !== "alias") assert.equal(pattern.matchingResults[0]?.signature, "1200");
  }
  assert.equal(JSON.stringify(inputs), before);
  assert.deepEqual(discoverNormalizationPatterns([...inputs].reverse()), patterns);
});

test("descubre formatos en magnitudes distintas sin acreditar igualdad y conserva coincidencias parciales", () => {
  const inputs = [patternProduct("A", { "Peso (kg)": "1,5 kg" }),
    patternProduct("B", { "Peso (kg)": "2.50 kg" }), patternProduct("C", { "Peso (kg)": "1.5 kg" })];
  const patterns = patternsOf(inputs, "formato_numerico", "Peso (kg)");
  assert.equal(patterns.length, 1);
  const pattern = patterns[0];
  assert.equal(pattern?.assessment, "hipotesis");
  assert.equal(pattern?.variants.length, 3);
  assert.equal(pattern?.matchingResults.length, 1);
  assert.equal(pattern?.matchingResults[0]?.signature, "1.5");
  assert.equal(pattern?.matchingResults[0]?.variants.length, 2);
  assert.equal(patternsOf(inputs, "unidad", "Peso (kg)").length, 0);
  assert.equal(patternsOf([patternProduct("D", { "Peso (kg)": "1200 kg" }),
    patternProduct("E", { "Peso (kg)": "1300 kg" })], "formato_numerico", "Peso (kg)").length, 0);
});

test("distingue formatos de dimensiones de las unidades y no mezcla estructuras de distinta cardinalidad", () => {
  const inputs = [patternProduct("A", { "Dimensiones horquillas (mm)": "1200x100x40 mm", "Potencia (kW)": 4 }),
    patternProduct("B", { "Dimensiones horquillas (mm)": "1200×100×40 mm", "Potencia (kW)": [4] }),
    patternProduct("C", { "Dimensiones horquillas (mm)": "1200x100 mm", "Potencia (kW)": [4, 5] })];
  const dimensions = patternsOf(inputs, "formato_numerico", "Dimensiones horquillas (mm)");
  assert.equal(dimensions.length, 1);
  assert.equal(dimensions[0]?.assessment, "observacion_acreditada");
  assert.equal(dimensions[0]?.variants.flatMap((variant) => variant.occurrences).length, 2);
  assert.equal(patternsOf(inputs, "unidad", "Dimensiones horquillas (mm)").length, 0);
  const powers = patternsOf(inputs, "formato_numerico", "Potencia (kW)");
  assert.equal(powers.length, 1);
  assert.equal(powers[0]?.variants.flatMap((variant) => variant.occurrences).length, 2);
  assert.equal(patternsOf(inputs, "unidad", "Potencia (kW)").length, 0);
});

test("separa categorías reconocidas, variantes ortográficas y valores categóricos distintos", () => {
  const inputs = [patternProduct("A", { "Tipo motor": "Diesel", "Tipo Mástil": "simplex", "Tracción 4x4": "yes" }),
    patternProduct("B", { "Tipo motor": "Diésel", "Tipo Mástil": "Simple", "Tracción 4x4": true }),
    patternProduct("C", { "Tipo motor": "Eléctrico", "Tipo Mástil": "Tríplex", "Tracción 4x4": false })];
  for (const [key, assessment] of [["Tipo motor", "observacion_acreditada"], ["Tipo Mástil", "observacion_acreditada"],
    ["Tracción 4x4", "observacion_acreditada"]]) {
    assert.ok(key);
    const patterns = patternsOf(inputs, "valor_categorico", key);
    assert.equal(patterns.length, 1);
    assert.equal(patterns[0]?.assessment, assessment);
    assert.equal(patterns[0]?.variants.flatMap((variant) => variant.occurrences).length, 2);
  }
  const unknown = patternsOf([patternProduct("D", { "Tipo motor": "Motor de combustión" }),
    patternProduct("E", { "Tipo motor": "Motor de combustion" })], "valor_categorico", "Tipo motor");
  assert.equal(unknown[0]?.assessment, "hipotesis");
});

test("descubre claves inéditas y coincidencias ortográficas sin crear nuevas equivalencias", () => {
  const inputs = [patternProduct("A", { "Anchura total": "1200 mm", "Prestación inédita": "7 kg" }),
    patternProduct("B", { "Anchura  total": "1200 mm", "PRESTACION INÉDITA": "8 kg" }),
    patternProduct("C", { "Otra prestación": "7 kg" })];
  const keys = discoverNormalizationPatterns(inputs).filter((pattern) => pattern.kind === "clave_no_reconocida");
  assert.equal(keys.find((pattern) => pattern.key === "anchura total")?.assessment, "hipotesis");
  assert.equal(keys.find((pattern) => pattern.key === "prestacion inedita")?.assessment, "hipotesis");
  assert.equal(keys.find((pattern) => pattern.key === "otra prestacion")?.assessment, "no_evaluable");
  assert.ok(keys.every((pattern) => pattern.matchingResults.length === 0));
  assert.equal(patternsOf(inputs, "alias", "Anchura (mm)").length, 0);
});

test("agrupa rechazos por motivo y estructura sin perder condiciones ni tratar ausencias como oportunidades", () => {
  const inputs = [patternProduct("A", { "Peso (kg)": "1000 / 1500", "Carga Máxima (kg)": "n/a" }),
    patternProduct("B", { "Peso (kg)": "2000 / 2500" }), patternProduct("C", { "Peso (kg)": "3000-3500" }),
    patternProduct("D", { "Anchura": "1200 mm", "Anchura total": "1500 mm" })];
  const rejected = patternsOf(inputs, "rechazo", "Peso (kg)");
  assert.equal(rejected.length, 2);
  assert.deepEqual(rejected.map((item) => item.variants.flatMap((variant) => variant.occurrences).length).sort(), [1, 2]);
  assert.ok(rejected.every((item) => item.assessment === "hipotesis"));
  assert.equal(patternsOf(inputs, "rechazo", "Carga Máxima (kg)").length, 0);
  const conflicts = patternsOf(inputs, "rechazo", "Anchura (mm)");
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.variants.length, 2);
  assert.equal(patternsOf(inputs, "alias", "Anchura (mm)").length, 0);
});

test("no mezcla etapas, prestaciones, familias ni poblaciones de familia desconocida", () => {
  const a = patternProduct("A", { "Anchura": "1,2 m", "Altura de trabajo (m)": "1,2 m" });
  const b = patternProduct("B", { "Anchura total": "1200 mm", "Altura plataforma (m)": "1,2 m" });
  const otherFamily = { ...b, family: "plataforma-articulada" } satisfies typeof b;
  assert.equal(patternsOf([a, otherFamily], "alias", "Anchura (mm)").length, 0);
  const otherStage = { ...b, original: inspectNormalizationStage("original", {}),
    prepared: inspectNormalizationStage("preparacion", { "Anchura total": "1200 mm" }) };
  assert.equal(patternsOf([a, otherStage], "unidad", "Anchura (mm)").length, 0);
  const unknownA = { ...a, family: null };
  const unknownB = { ...b, family: null, sourceCategoryKey: "otra" };
  assert.equal(patternsOf([unknownA, unknownB], "alias", "Anchura (mm)").length, 0);
  assert.equal(patternsOf([unknownA, { ...b, family: null }], "alias", "Anchura (mm)")[0]?.scope.family, null);
  assert.equal(patternsOf([a, b], "unidad", "Altura de trabajo (m)").length, 0);
  assert.equal(patternsOf([a, b], "unidad", "Altura plataforma (m)").length, 0);
  assert.throws(() => discoverNormalizationPatterns([a, a]), /Identidad duplicada/);
});

const publicationSha = "a".repeat(64);
const comparisonProduct = (reference: string, original: SpecsMap, prepared: SpecsMap, published?: SpecsMap) => {
  const source = record(original);
  const identified = { ...source, reference, url: `${source.url}-${reference}` };
  const current = prepare(identified);
  const product = inspectNormalizationProduct(identified, { ...current, product: { ...current.product, spec: prepared } });
  const publication = { ...current.product, spec: published ?? prepared };
  return { source: identified, product, publication, observed: published === undefined ? product :
    attachNormalizationPublication(product, identified, publication, publicationSha) };
};

test("solo concilia publicaciones con identidad, URL, referencia y huella del original acreditado", () => {
  const { source, product, publication } = comparisonProduct("A", { "Anchura": "1,2 m" }, { "Anchura total": "1200 mm" });
  const before = JSON.stringify([source, product, publication]);
  const result = attachNormalizationPublication(product, source, publication, publicationSha);
  assert.equal(result.publication?.sha256, publicationSha);
  assert.equal(result.publication?.observation.stage, "publicacion");
  assert.equal(JSON.stringify([source, product, publication]), before);
  assert.throws(() => attachNormalizationPublication(product, { ...source, specs: {} }, publication, publicationSha), /no conciliada/);
  assert.throws(() => attachNormalizationPublication(product, source, { ...publication, reference: "B" }, publicationSha), /no conciliada/);
  assert.throws(() => attachNormalizationPublication(product, source, { ...publication, sourceUrl: "https://example.test/otra" }, publicationSha), /no conciliada/);
  assert.throws(() => attachNormalizationPublication(product, source, { ...publication, providerId: "otro" }, publicationSha), /no conciliada/);
  assert.throws(() => attachNormalizationPublication(product, source, publication, "invalid"), /no conciliada/);
  assert.throws(() => attachNormalizationPublication(result, source, publication, publicationSha), /duplicada/);
});

test("la conciliación por proveedor conserva fichas sin publicación y rechaza fuentes ausentes o duplicadas", () => {
  const a = comparisonProduct("A", {}, {});
  const b = comparisonProduct("B", {}, {});
  const sources = new Map([[a.product.identity, a.source], [b.product.identity, b.source]]);
  const inputs = [a.product, b.product];
  const result = attachNormalizationPublications(inputs, sources, "gam", [a.publication], publicationSha);
  assert.equal(result[0]?.publication?.sha256, publicationSha);
  assert.equal(result[1]?.publication, undefined);
  assert.ok(inputs.every((item) => item.publication === undefined));
  assert.throws(() => attachNormalizationPublications(inputs, new Map(), "gam", [a.publication], publicationSha), /sin origen único/);
  assert.throws(() => attachNormalizationPublications(inputs, sources, "gam", [a.publication, a.publication], publicationSha), /sin origen único/);
  assert.throws(() => attachNormalizationPublications([a.product, a.product], sources, "gam", [], publicationSha), /incoherente/);
  assert.throws(() => attachNormalizationPublications(inputs, sources, "otro", [], publicationSha), /incoherente/);
  assert.throws(() => attachNormalizationPublications(inputs, sources, "gam", [a.publication], "invalid"), /Huella/);
});

test("distingue representación equivalente, cambio de magnitud y conservación exacta entre las tres etapas", () => {
  const { observed } = comparisonProduct("A", { "Anchura": "1,2 m", "Peso (kg)": "1200 kg", "Altura de trabajo (m)": "8 m" },
    { "Anchura total": "1200 mm", "Peso (kg)": "1300 kg", "Altura de trabajo (m)": "8 m" },
    { "Anchura total": "1200 mm", "Peso (kg)": "1300 kg", "Altura de trabajo (m)": "8 m" });
  const result = contrastNormalizationProduct(observed);
  const prepared = result.filter((item) => item.from === "original" && item.to === "preparacion");
  assert.deepEqual(prepared.map(({ kind, assessment }) => [kind, assessment]), [
    ["representacion_equivalente", "diferencia_legitima"], ["valor_distinto", "hipotesis"], ["sin_cambio", "observacion_acreditada"]]);
  assert.deepEqual(result.filter((item) => item.from === "preparacion" && item.to === "publicacion").map(({ kind }) => kind),
    ["sin_cambio", "sin_cambio", "sin_cambio"]);
  assert.equal(result.filter((item) => item.from === "original" && item.to === "publicacion").length, 3);
});

test("no atribuye correspondencias por igualdad numérica, claves desconocidas ni alias ambiguos", () => {
  const { product } = comparisonProduct("A", { "Altura de trabajo (m)": "8 m", "Prestación inédita": "2",
    "Anchura": "1200 mm", "Anchura total": "1500 mm", "Peso (kg)": "1000 / 1500" },
    { "Altura plataforma (m)": "8 m", "Prestación inédita": "3", "Anchura total": "1200 mm", "Peso (kg)": "1000 kg" });
  const result = contrastNormalizationProduct(product);
  assert.deepEqual(result.map(({ kind }) => kind), ["sin_correspondencia", "no_interpretable", "ambiguo", "ambiguo", "no_interpretable"]);
  assert.ok(result.every(({ assessment }) => assessment !== "diferencia_legitima"));
  assert.ok(result.every(({ to }) => to === "preparacion"));
});

test("la procedencia enlaza una transformación sin afirmar equivalencia ni trasladar la traza actual a la publicación", () => {
  const { observed } = comparisonProduct("A", { "Medida original": "1,2 m" }, { "Anchura total": "1200 mm" }, { "Anchura total": "1200 mm" });
  const trace = { originalRecordSha256: observed.originalRecordSha256, entries: [{ field: "Anchura (mm)", value: "1200 mm",
    mechanism: "src/preparation/technical/technical-presentation.ts", scope: "unit" as const, sourceField: "Medida original", sourceValue: "1,2 m" }] };
  const result = contrastNormalizationProduct({ ...observed, technicalProvenance: trace });
  assert.equal(result[0]?.kind, "transformacion_trazada");
  assert.equal(result[0]?.evidence, trace.entries[0]);
  assert.equal(result[0]?.assessment, "observacion_acreditada");
  assert.equal(result[1]?.kind, "sin_correspondencia");
  assert.equal(result[1]?.evidence, null);
  const wrongTrace = { ...trace, entries: trace.entries.map((entry) => ({ ...entry, value: "1500 mm" })) };
  assert.equal(contrastNormalizationProduct({ ...observed, technicalProvenance: wrongTrace })[0]?.kind, "sin_correspondencia");
  assert.equal(contrastNormalizationProduct({ ...observed, technicalProvenance: { ...trace, originalRecordSha256: "b".repeat(64) } })[0]?.kind, "sin_correspondencia");
});

test("las variantes publicadas conservan su etapa y se agrupan sin duplicar identidades ni ocurrencias", () => {
  const a = comparisonProduct("A", { "Anchura": "1,2 m" }, { "Anchura": "1,2 m" }, { "Anchura": "1,2 m" });
  const b = comparisonProduct("B", { "Anchura total": "1200 mm" }, { "Anchura total": "1200 mm" }, { "Anchura total": "1200 mm" });
  const inputs = [a.observed, b.observed];
  const before = JSON.stringify(inputs);
  const report = analyzeNormalizationImpact(inputs);
  assert.equal(report.groups.length, 3);
  assert.equal(report.impact.uniqueProducts, 2);
  assert.equal(report.impact.occurrences, 6);
  assert.equal(report.impact.patternMemberships, 18);
  assert.equal(report.potential.uniqueProducts, 2);
  assert.equal(report.potential.occurrences, 4);
  assert.equal(report.potential.patternMemberships, 12);
  assert.equal(report.potentialByStage.original.uniqueProducts, 0);
  assert.equal(report.potentialByStage.publicacion.uniqueProducts, 2);
  assert.equal(report.potentialByAssessment.observacion_acreditada.uniqueProducts, 2);
  assert.equal(report.providers[0]?.publishedProducts, 2);
  assert.equal(report.potentialByProvider[0]?.uniqueProducts, 2);
  for (const group of report.groups) {
    assert.equal(group.patterns.length, 3);
    assert.equal(group.byStage.publicacion.occurrences, 2);
    assert.equal(group.contrastSummary.length, 3);
    assert.ok(group.contrastSummary.every((item) => item.occurrences === 2 && item.uniqueProducts === 2));
  }
  assert.equal(JSON.stringify(inputs), before);
  assert.deepEqual(analyzeNormalizationImpact([...inputs].reverse()), report);
});

test("las señales exclusivas del original y las claves aisladas no evaluables no inflan el impacto potencial final", () => {
  const a = comparisonProduct("A", { "Anchura": "1,2 m" }, { "Anchura total": "1200 mm", "Prestación inédita": "x" });
  const b = comparisonProduct("B", { "Anchura total": "1200 mm" }, { "Anchura total": "1200 mm" });
  const report = analyzeNormalizationImpact([a.observed, b.observed]);
  assert.equal(report.impact.uniqueProducts, 2);
  assert.equal(report.potential.uniqueProducts, 0);
  assert.equal(report.providers[0]?.publishedProducts, 0);
  assert.equal(report.providers[0]?.withoutPublication.length, 2);
  assert.equal(report.providers[0]?.publicationSha256.length, 0);
  assert.ok(report.groups.every((group) => group.potential.uniqueProducts === 0));
});

test("no mezcla selecciones de publicación diferentes para un mismo proveedor", () => {
  const a = comparisonProduct("A", {}, {}, {});
  const b = comparisonProduct("B", {}, {});
  const different = attachNormalizationPublication(b.product, b.source, b.publication, "b".repeat(64));
  assert.throws(() => analyzeNormalizationImpact([a.observed, different]), /Selecciones de publicación distintas/);
  assert.throws(() => analyzeNormalizationImpact([a.observed, a.observed]), /Identidad duplicada/);
});

test("un patrón exclusivo de publicación conserva los contrastes de llegada sin duplicar una transición", () => {
  const a = comparisonProduct("A", { "Anchura total": "1200 mm" }, { "Anchura total": "1200 mm" }, { "Anchura": "1,2 m" });
  const b = comparisonProduct("B", { "Anchura total": "1200 mm" }, { "Anchura total": "1200 mm" }, { "Anchura total": "1200 mm" });
  const report = analyzeNormalizationImpact([a.observed, b.observed]);
  const alias = report.groups.find((item) => item.kind === "alias");
  assert.ok(alias);
  assert.deepEqual(alias.patterns.map((item) => item.stage), ["publicacion"]);
  assert.equal(alias.contrastSummary.length, 4);
  assert.ok(alias.contrastSummary.every((item) => item.to === "publicacion" && item.occurrences === 1));
  assert.equal(report.contrasts[0]?.originalRecordSha256, a.observed.originalRecordSha256);
});

const checkContext = (reference: string, published = false): NormalizationCheckContext => {
  const source = { ...record({ "Anchura total": "1,2 m" }), reference };
  const prepared = prepare(source);
  const observation = inspectNormalizationProduct(source, prepared);
  return { source, prepared, observation: published ? attachNormalizationPublication(observation, source, prepared.product, publicationSha) : observation,
    published: published ? prepared.product : null };
};

const checkFinding: NormalizationCheckFinding = {
  cause: "caso-sintetico", specificationKey: "Anchura (mm)", stage: "preparacion", circuit: "prueba",
  assessment: "defecto_reproducible", applicability: "Prestación reconocida", reason: "Contraste sintético",
  evidence: [{ stage: "original", circuit: "prueba", field: "Anchura total", present: true, value: "1,2 m" },
    { stage: "preparacion", circuit: "prueba", field: "Anchura (mm)", present: false }]
};

test("las comprobaciones separan cobertura, ausencia de fuente, exclusión, límites y errores", () => {
  const contexts = [checkContext("A", true), checkContext("B"), checkContext("C"), checkContext("D"), checkContext("E")];
  const before = JSON.stringify(contexts);
  const check: NormalizationCheck = { id: "sintetica", evaluate: ({ observation, published }) => {
    if (observation.reference === "B") return { status: "no_aplicable", reason: "Sin consumidor" };
    if (observation.reference === "C") return { status: "no_evaluable", reason: "Sin evidencia" };
    if (observation.reference === "D") throw new Error("Error sintético");
    return { status: "evaluada", findings: published ? [checkFinding] : [] };
  } };
  const results = evaluateNormalizationChecks([check], "gam", contexts);
  const report = summarizeNormalizationChecks([check], ["gam", "manain"], results);
  const coverage = report.checks[0];
  assert.ok(coverage);
  assert.deepEqual([coverage.population, coverage.eligible, coverage.evaluated, coverage.excluded, coverage.notEvaluable, coverage.errors], [5, 3, 2, 1, 1, 1]);
  assert.deepEqual(coverage.missingProviders, ["manain"]);
  assert.deepEqual(coverage.reasons.map(({ status, count }) => [status, count]), [["error", 1], ["no_aplicable", 1], ["no_evaluable", 1]]);
  assert.deepEqual(report.failures, [{ check: "sintetica", providerId: "gam", reason: "Error sintético", count: 1 }]);
  assert.equal(report.occurrences[0]?.publicationSha256, publicationSha);
  assert.equal(report.occurrences[0]?.originalRecordSha256, contexts[0]?.observation.originalRecordSha256);
  assert.equal(report.occurrences[0]?.identity, contexts[0]?.observation.identity);
  assert.equal(JSON.stringify(contexts), before);
  assert.throws(() => evaluateNormalizationChecks([check, check], "gam", contexts), /identidad única/u);
  assert.throws(() => evaluateNormalizationChecks([check], "manain", contexts), /incoherente/u);
  assert.throws(() => evaluateNormalizationChecks([check], "gam", [...contexts, ...contexts]), /incoherente/u);
});

test("deduplica evidencias exactas e impacto semántico entre comprobaciones y etapas", () => {
  const a = checkContext("A");
  const b = checkContext("B");
  const checks: readonly NormalizationCheck[] = [
    { id: "primera", evaluate: () => ({ status: "evaluada", findings: [checkFinding, checkFinding,
      { ...checkFinding, stage: "original", assessment: "hipotesis" },
      { ...checkFinding, specificationKey: null, assessment: "hipotesis" },
      { ...checkFinding, assessment: "diferencia_legitima" },
      { ...checkFinding, assessment: "no_evaluable" }, { ...checkFinding, assessment: "no_aplicable" }] }) },
    { id: "segunda", evaluate: () => ({ status: "evaluada", findings: [checkFinding] }) }
  ];
  const report = summarizeNormalizationChecks(checks, ["gam"], evaluateNormalizationChecks(checks, "gam", [a, b]));
  assert.equal(report.occurrences.length, 14);
  assert.equal(report.impact.uniqueProducts, 2);
  assert.equal(report.impact.uniqueSpecifications, 2);
  assert.equal(report.potential.occurrences, 8);
  assert.equal(report.potential.uniqueProducts, 2);
  assert.equal(report.potential.uniqueSpecifications, 2);
  assert.equal(report.potential.unresolvedSpecificationOccurrences, 2);
  assert.equal(report.byAssessment.defecto_reproducible.occurrences, 4);
  assert.equal(report.byAssessment.hipotesis.occurrences, 4);
  assert.equal(report.byAssessment.diferencia_legitima.occurrences, 2);
  assert.equal(report.byAssessment.no_evaluable.occurrences, 2);
  assert.equal(report.byAssessment.no_aplicable.occurrences, 2);
  assert.equal(report.groupMemberships, 14);
  assert.equal(report.groups.length, 7);
  for (const group of report.groups) {
    assert.equal(group.impact.uniqueProducts, 2);
    assert.equal(group.byProvider[0]?.providerId, "gam");
    for (const index of group.occurrenceIndices) assert.equal(report.occurrences[index]?.check, group.check);
  }
  assert.deepEqual(report, summarizeNormalizationChecks(checks, ["gam"], evaluateNormalizationChecks(checks, "gam", [b, a])));
});


test("la reentrada separa las tres etapas y excluye únicamente las publicaciones no conciliadas", () => {
  const contexts = [checkContext("A", true), checkContext("B")];
  const report = summarizeNormalizationChecks(normalizationReentryChecks, ["gam", "manain"],
    evaluateNormalizationChecks(normalizationReentryChecks, "gam", contexts));
  assert.deepEqual(report.checks.map(({ population, evaluated, excluded, errors }) => [population, evaluated, excluded, errors]),
    [[2, 2, 0, 0], [2, 2, 0, 0], [2, 1, 1, 0]]);
  assert.ok(report.checks.every(({ missingProviders }) => missingProviders[0] === "manain"));
  assert.equal(report.occurrences.length, 0);
});
