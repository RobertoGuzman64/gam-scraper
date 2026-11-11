import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSpecificationImprovement, parseSpecificationImprovementExceptions, type SpecificationImprovementExceptionRegistry } from "../specification-improvement.js";
import { technicalPriorityFamily } from "../specification-family-priorities.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import type { ProductRecord, SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";

const empty: SpecificationImprovementExceptionRegistry = { version: 1, exceptions: [] };
const six = { Peso: "3000 kg", Anchura: "2 m", Longitud: "5 m", Autonomía: "8 h", Motor: "Diésel", Tracción: "4x4" };
const input = (reference: string, title: string, specs: Readonly<Record<string, SpecValue>>, options: {
  readonly providerId?: string; readonly model?: string; readonly path?: string
} = {}): DescriptionCoverageInput => {
  const providerId = options.providerId ?? "gam";
  const url = `https://example.com/${options.path ?? "maquina"}/${reference}`;
  const source: ProductRecord = {
    providerId, reference, url, categoryKey: "maquinas", categoryName: "Maquinaria",
    title, brand: "Marca", model: options.model ?? `Modelo ${reference}`, shortDescription: null, longDescription: null,
    price: null, year: null, location: null, country: null, horometer: null,
    serialNumber: null, image: null, specs
  };
  const product: ImportCandidate = {
    providerId, sourceUrl: url, reference, title, categorySellID: null,
    category: "Maquinaria", condition: null, price: null, description_title: title,
    description: null, description_general: null, image: null, images: [],
    spec: { Marca: "Marca", Modelo: options.model ?? `Modelo ${reference}`, ...specs }, attributes: []
  };
  return { source, published: product, prepared: { status: "ready", issues: [], product }, origin: "original_canonico" };
};

const articulatedCohort = (): DescriptionCoverageInput[] => [
  input("1", "Plataforma articulada", { ...six, "Altura de elevación": "14 m" }),
  input("2", "Plataforma articulada", { ...six, "Altura de plataforma": "12 m" }),
  input("3", "Plataforma articulada", { ...six, "Altura de trabajo": "18 m" }),
  input("4", "Plataforma articulada", six)
];

test("el mínimo de seis es deuda real y se separa de la diferenciación respaldada por cohorte", () => {
  const items = [...articulatedCohort(), input("5", "Barredora industrial", { Peso: "200 kg", Motor: "Eléctrico" })];
  const report = analyzeSpecificationImprovement(items, empty);
  assert.equal(report.totals.coveragePending, 1);
  assert.equal(report.totals.differentiationPending, 1);
  assert.equal(report.totals.totalPending, 2);
  assert.equal(report.cases.find((item) => item.reference === "4")?.field,
    "Altura vertical declarada (trabajo, plataforma o elevación)");
  assert.deepEqual(report.cases.find((item) => item.reference === "4")?.evidence,
    { kind: "cohorte", observed: 3, comparable: 4 });
  assert.equal(report.totals.priorityP1, 1);
  assert.equal(report.totals.priorityP3, 1);
  assert.ok(report.campaigns.some((item) => item.family === "plataformas articuladas" &&
    item.kind === "diferenciacion" && item.pending === 1));
});

test("las alturas conservan sus magnitudes: basta una altura vertical y nunca se traslada su cifra", () => {
  const report = analyzeSpecificationImprovement(articulatedCohort().slice(0, 3), empty);
  assert.equal(report.totals.totalPending, 0);
  assert.equal(report.cases.length, 0);
});

test("las reglas se aplican a subfamilias, sin exigir alcance horizontal a tijeras", () => {
  const items = [
    ...articulatedCohort(),
    input("10", "Plataforma de tijera", { ...six, "Altura de elevación": "8 m" }),
    input("11", "Plataforma de tijera", { ...six, "Altura de plataforma": "9 m" })
  ];
  const report = analyzeSpecificationImprovement(items, empty);
  assert.equal(report.totals.differentiationPending, 1);
  assert.equal(report.families.find((item) => item.name === "plataformas de tijera")?.pending, 0);
  assert.equal(report.families.find((item) => item.name === "plataformas articuladas")?.differentiation, 1);
});

test("dos pares del mismo modelo permiten una oportunidad concreta aunque la cohorte global no alcance el umbral", () => {
  const items = [
    input("21", "Plataforma telescópica", { ...six, "Alcance horizontal": "10 m" }, { model: "S65" }),
    input("22", "Plataforma telescópica", { ...six, "Alcance horizontal": "10 m" }, { model: "S65" }),
    input("23", "Plataforma telescópica", six, { model: "S65" })
  ];
  const report = analyzeSpecificationImprovement(items, empty);
  assert.equal(report.totals.differentiationPending, 1);
  assert.deepEqual(report.cases[0]?.evidence, { kind: "mismo_modelo", observed: 2, comparable: 2 });
});

test("un atributo frecuente en otra subfamilia o proveedor no obliga a la unidad", () => {
  const report = analyzeSpecificationImprovement([
    input("31", "Plataforma articulada", { ...six, "Alcance horizontal": "8 m" }),
    input("32", "Plataforma articulada", { ...six, "Alcance horizontal": "9 m" }),
    input("33", "Plataforma articulada", six, { providerId: "gomariz" }),
    input("34", "Plataforma de tijera", six)
  ], empty);
  assert.equal(report.totals.differentiationPending, 0);
});

test("el título y la categoría URL se contrastan: conflicto específico no genera diferencias", () => {
  const contradictory = input("41", "Miniexcavadora de cadenas", six,
    { path: "mini-cargadoras-segunda-mano" });
  const byCategory = input("42", "GENIE Z45/25", six,
    { path: "plataformas-elevadoras-articuladas-diesel-segunda-mano" });
  assert.equal(technicalPriorityFamily(contradictory), null);
  assert.equal(technicalPriorityFamily(byCategory)?.name, "plataformas articuladas");
  assert.equal(technicalPriorityFamily(input("43", "Lote de 4 plataformas articuladas", six,
    { path: "plataformas-elevadoras-articuladas-diesel-segunda-mano" })), null);
});

test("las excepciones individuales acreditadas cierran y se reabren al cambiar la ficha", () => {
  const items = articulatedCohort();
  const first = analyzeSpecificationImprovement(items, empty);
  const caseToControl = first.cases.find((item) => item.reference === "4");
  assert.ok(caseToControl);
  const registry = parseSpecificationImprovementExceptions({ version: 1, exceptions: [{
    id: caseToControl.id, fingerprint: caseToControl.fingerprint, reviewedBy: "Responsable técnico",
    reviewedAt: "2026-11-11T00:00:00Z", rationale: "No aplicable para la variante acreditada",
    evidence: "Manual técnico correspondiente a esta variante"
  }] });
  const controlled = analyzeSpecificationImprovement(items, registry);
  assert.equal(controlled.totals.totalPending, 0);
  assert.equal(controlled.totals.controlledExceptions, 1);
  assert.equal(controlled.totals.staleExceptions, 0);
  const updated = [...items.slice(0, 3), input("4", "Plataforma articulada", { ...six, "Combustible": "Diésel" })];
  const changed = analyzeSpecificationImprovement(updated, registry);
  assert.equal(changed.totals.totalPending, 1);
  assert.equal(changed.totals.staleExceptions, 1);
  const enriched = [...items.slice(0, 3), input("4", "Plataforma articulada", { ...six, "Altura de trabajo": "18 m" })];
  assert.equal(analyzeSpecificationImprovement(enriched, empty).totals.totalPending, 0);
  assert.equal(analyzeSpecificationImprovement(enriched, registry).totals.staleExceptions, 1);
});

test("las excepciones inválidas, duplicados y alteraciones de entradas se detectan", () => {
  assert.throws(() => parseSpecificationImprovementExceptions({ version: 1, exceptions: [{ id: "x" }] }), /evidencia/);
  assert.throws(() => parseSpecificationImprovementExceptions({ version: 2, exceptions: [] }), /incompatible/);
  const entry = { id: "x", fingerprint: "a".repeat(64), reviewedBy: "Técnico",
    reviewedAt: "2026-11-11T00:00:00Z", rationale: "Dato no aplicable", evidence: "Manual técnico" };
  assert.throws(() => parseSpecificationImprovementExceptions({ version: 1, exceptions: [entry, entry] }), /duplicada/);
  const items = articulatedCohort();
  const before = JSON.stringify(items);
  assert.throws(() => analyzeSpecificationImprovement([...items, ...items], empty), /duplicada/);
  analyzeSpecificationImprovement(items, empty);
  assert.equal(JSON.stringify(items), before);
});
