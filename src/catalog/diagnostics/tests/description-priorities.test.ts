import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import { analyzeDescriptionPriorities } from "../description-priorities.js";
import { analyzeEditorialQuality, analyzePublishedEditorialQuality } from "../editorial-quality.js";

const words = (quantity: number, prefix: string): string =>
  Array.from({ length: quantity }, (_, index) => `${prefix}${index}`).join(" ");
const pair = (reference: string, prior: [string | null, string | null], current: [string | null, string | null],
  issues: readonly string[] = []): DescriptionCoverageInput => {
  const source: ProductRecord = {
    providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
    url: `https://www.gomarizrent.com/venta/maquinas/${reference}`, reference, title: `Carretilla modelo ${reference}`,
    shortDescription: prior[0], longDescription: prior[1], price: null,
    brand: null, model: null, year: null, location: null, country: null, horometer: null,
    serialNumber: null, image: null, specs: { "Carga nominal": "1000 kg" }
  };
  const candidate = (texts: [string | null, string | null]): ImportCandidate => ({
    providerId: source.providerId, reference, sourceUrl: source.url, title: source.title,
    categorySellID: null, category: source.categoryName, condition: null, price: null,
    description_title: source.title, description: texts[0], description_general: texts[1],
    image: null, images: [], spec: source.specs ?? {}, attributes: []
  });
  return { source, published: candidate(prior), origin: "original_canonico",
    prepared: { product: candidate(current), status: issues.length ? "review" : "ready", issues } };
};
const analyze = (inputs: readonly DescriptionCoverageInput[]) => analyzeDescriptionPriorities(inputs,
  analyzePublishedEditorialQuality(inputs.map((input) => input.published)),
  analyzeEditorialQuality(inputs.map(({ source, prepared }) => ({ source, prepared }))));

test("prioriza vacíos pendientes antes de extremos, y registra separadamente los recuperados", () => {
  const regular = words(120, "general");
  const short = words(18, "resumen");
  const inputs = [
    pair("ambos", [null, null], [null, null]),
    pair("recuperado", [null, null], [short, regular]),
    pair("general-minima", [short, words(2, "escaso")], [short, words(2, "escaso")]),
    pair("larga", [short, words(2500, "largo")], [short, words(2500, "largo")]),
    pair("corta-larga", [words(130, "corta"), regular], [words(130, "corta"), regular]),
    pair("sintetizada", [words(120, "corta"), regular], [short, regular]),
    pair("normal", [short, regular], [short, regular])
  ];
  const first = analyze(inputs);
  assert.deepEqual(first.pending.slice(0, 2).map((item) => [item.reference, item.signal]),
    [["ambos", "corta_ausente"], ["ambos", "general_ausente"]]);
  assert.equal(first.resolved.filter((item) => item.reference === "recuperado" && item.stage === "P0").length, 2);
  assert.equal(first.totals.pendingByStage.P0, 2);
  assert.ok(first.resolved.some((item) => item.reference === "sintetizada" && item.signal === "corta_demasiado_larga"));
  assert.ok(first.pending.some((item) => item.reference === "general-minima" && item.signal === "general_muy_breve"));
  assert.ok(first.pending.some((item) => item.reference === "larga" && item.signal === "general_desproporcionada"));
  assert.ok(first.pending.some((item) => item.reference === "corta-larga" && item.signal === "corta_demasiado_larga"));
  assert.deepEqual(first, analyze([...inputs].reverse()));
});

test("compara exclusivamente fichas de la misma familia con muestra suficiente y mantiene técnica aparte", () => {
  const short = words(16, "corta");
  const long = words(200, "general");
  const entries = Array.from({ length: 6 }, (_, index) => pair(String(index), [short, long], [short, long]));
  entries.push(pair("escasa", [short, words(70, "breve")], [short, words(70, "breve")],
    ["Atributo contradictorio: Capacidad de carga"]));
  entries.push(pair("extensa", [words(40, "resumen"), long], [words(40, "resumen"), long]));
  const result = analyze(entries);
  const low = result.pending.find((item) => item.reference === "escasa" && item.signal === "general_insuficiente_en_familia");
  assert.equal(low?.stage, "P2");
  assert.equal(low?.familyMedianWords, 200);
  assert.equal(low?.familySamples, 8);
  assert.equal(result.technical[0]?.reference, "escasa");
  assert.equal(result.technical[0]?.contradictions.length, 1);
  assert.ok(result.pending.some((item) => item.reference === "extensa" && item.signal === "corta_excesiva_en_familia"));
  assert.equal(analyze(entries.slice(0, 4)).pending.some((item) => item.stage === "P2"), false);
});

test("marca regresiones nuevas, no atribuye evidencia externa a reconstrucciones y rechaza identidades cruzadas", () => {
  const short = words(18, "resumen");
  const long = words(100, "general");
  const input = pair("regresion", [short, long], [short, null]);
  const report = analyze([input]);
  const item = report.pending.find((entry) => entry.signal === "general_ausente");
  assert.equal(item?.state, "aparecido");
  assert.equal(report.totals.appeared, 1);
  const reconstructed = analyze([{ ...pair("sin-original", [null, null], [null, null]), origin: "reconstruccion_publicada" }]);
  assert.ok(reconstructed.pending.every((entry) => !entry.evidence.includes("original canónico")));
  assert.throws(() => analyze([input, input]), /duplicada/);
  assert.throws(() => analyze([{ ...input, prepared: { ...input.prepared,
    product: { ...input.prepared.product, reference: "otra" } } }]), /discordante/);
});
