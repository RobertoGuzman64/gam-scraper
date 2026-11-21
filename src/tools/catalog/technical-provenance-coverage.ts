import { matchesDocumentedTechnicalIdentity } from "../../preparation/shared/technical/evidence/reviewed-catalog-model-identity.js";
import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { readPublicationTechnicalProvenance } from "../../panel/evidence/read-technical-provenance.js";
import { readPanelExplorer } from "../../panel/explorer/read-panel-explorer.js";
import { productIdentity } from "../../panel/explorer/explorer-identity.js";
import type { PanelSpecAddition } from "../../panel/explorer/types.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";
import { classifyPublishedTechnicalSpec } from "../../preparation/technical-spec-classification.js";
import type { TechnicalSpecEvidence } from "../../contracts/technical-provenance.js";
import type { PanelProviderId } from "../../panel/evidence/types.js";
import { evaluateGrayProvenance } from "./gray-provenance-evaluation.js";
import { withdrawnTechnicalSpecs } from "./withdrawn-technical-specs.js";
import type { GrayProvenanceBlocker } from "./gray-provenance-evaluation.js";

type Kind = PanelSpecAddition["kind"];
type Counter = { own: number; reused: number; pending: number };
const emptyCounter = (): Counter => ({ own: 0, reused: 0, pending: 0 });
const addCounter = (left: Readonly<Counter>, right: Readonly<Counter>): Counter => ({
  own: left.own + right.own, reused: left.reused + right.reused, pending: left.pending + right.pending
});
type ProviderCoverage = {
  readonly providerId: PanelProviderId;
  readonly additions: number;
  readonly classification: Readonly<Counter>;
  readonly replayed: number;
  readonly unitSource: number;
  readonly modelDocument: number;
  readonly reviewedModelFacts: number;
  readonly unitDocument: number;
  readonly documentReference: number;
  readonly unknownSource: number;
  readonly missing: number;
  readonly historicalEmitted: number;
  readonly pendingWithUnknownSource: number;
  readonly unitByClassification: Readonly<Counter>;
  readonly modelDocumentByClassification: Readonly<Counter>;
  readonly reviewedModelFactsByClassification: Readonly<Counter>;
  readonly unitDocumentByClassification: Readonly<Counter>;
  readonly documentReferenceByClassification: Readonly<Counter>;
  readonly unknownByClassification: Readonly<Counter>;
  readonly missingByClassification: Readonly<Counter>;
};

export type GrayProvenanceCase = {
  readonly providerId: PanelProviderId;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly originalRecordSha256: string;
  readonly field: string;
  readonly value: string;
  readonly mechanism: string | null;
  readonly scope: TechnicalSpecEvidence["scope"] | null;
  readonly documentUrl: string | null;
  readonly sourceField: string | null;
  readonly blocker: GrayProvenanceBlocker;
};

export type TechnicalClassificationDifference = {
  readonly providerId: PanelProviderId;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: string;
  readonly value: string;
  readonly historical: Kind;
  readonly motor: Kind;
  readonly mechanism: string | null;
  readonly scope: TechnicalSpecEvidence["scope"] | null;
  readonly documentUrl: string | null;
  readonly reviewedFact: boolean;
};

type MotorComparison = {
  readonly providerId: PanelProviderId;
  readonly historical: Readonly<Counter>;
  readonly motor: Readonly<Counter>;
  readonly resolvedPending: number;
  readonly unresolvedPending: number;
  readonly historicalAtRisk: number;
};

export type TechnicalClassificationEquivalence = {
  readonly mode: "motor-offline-rehearsal";
  readonly historical: Readonly<Counter>;
  readonly motor: Readonly<Counter>;
  readonly byHistorical: Readonly<Record<Kind, Readonly<Counter>>>;
  readonly resolvedPending: number;
  readonly unresolvedPending: number;
  readonly unresolvedCases: readonly GrayProvenanceCase[];
  readonly unresolvedBlockers: Readonly<Partial<Record<GrayProvenanceBlocker, number>>>;
  readonly historicalAtRisk: number;
  readonly providers: readonly MotorComparison[];
  readonly differences: readonly TechnicalClassificationDifference[];
};

export type TechnicalProvenanceCoverage = {
  readonly version: 1;
  readonly mode: "historical-rehearsal";
  readonly classificationChanged: false;
  readonly totals: Omit<ProviderCoverage, "providerId">;
  readonly providers: readonly ProviderCoverage[];
  readonly mechanisms: Readonly<Record<string, number>>;
  readonly unattributedMechanisms: Readonly<Record<string, number>>;
  readonly grayCases: readonly GrayProvenanceCase[];
  readonly grayBlockers: Readonly<Partial<Record<GrayProvenanceBlocker, number>>>;
  readonly equivalence: TechnicalClassificationEquivalence;
  readonly withdrawn: {
    readonly fromPreparation: number;
    readonly stillInHistoricalPublication: number;
    readonly cases: readonly {
      readonly providerId: PanelProviderId;
      readonly reference: string;
      readonly field: string;
      readonly value: string;
      readonly published: boolean;
      readonly reason: string;
    }[];
  };
};

const initial = (): Omit<ProviderCoverage, "providerId"> => ({
  additions: 0, classification: { own: 0, reused: 0, pending: 0 },
  replayed: 0, unitSource: 0, modelDocument: 0, reviewedModelFacts: 0, unitDocument: 0, documentReference: 0,
  unknownSource: 0, missing: 0,
  historicalEmitted: 0, pendingWithUnknownSource: 0,
  unitByClassification: emptyCounter(), modelDocumentByClassification: emptyCounter(),
  reviewedModelFactsByClassification: emptyCounter(),
  unitDocumentByClassification: emptyCounter(), documentReferenceByClassification: emptyCounter(),
  unknownByClassification: emptyCounter(),
  missingByClassification: emptyCounter()
});

const add = (left: Omit<ProviderCoverage, "providerId">, right: Omit<ProviderCoverage, "providerId">): Omit<ProviderCoverage, "providerId"> => ({
  additions: left.additions + right.additions,
  classification: {
    own: left.classification.own + right.classification.own,
    reused: left.classification.reused + right.classification.reused,
    pending: left.classification.pending + right.classification.pending
  },
  replayed: left.replayed + right.replayed,
  unitSource: left.unitSource + right.unitSource,
  modelDocument: left.modelDocument + right.modelDocument,
  reviewedModelFacts: left.reviewedModelFacts + right.reviewedModelFacts,
  unitDocument: left.unitDocument + right.unitDocument,
  documentReference: left.documentReference + right.documentReference,
  unknownSource: left.unknownSource + right.unknownSource,
  missing: left.missing + right.missing,
  historicalEmitted: left.historicalEmitted + right.historicalEmitted,
  pendingWithUnknownSource: left.pendingWithUnknownSource + right.pendingWithUnknownSource,
  unitByClassification: addCounter(left.unitByClassification, right.unitByClassification),
  modelDocumentByClassification: addCounter(left.modelDocumentByClassification, right.modelDocumentByClassification),
  reviewedModelFactsByClassification: addCounter(left.reviewedModelFactsByClassification, right.reviewedModelFactsByClassification),
  unitDocumentByClassification: addCounter(left.unitDocumentByClassification, right.unitDocumentByClassification),
  documentReferenceByClassification: addCounter(left.documentReferenceByClassification, right.documentReferenceByClassification),
  unknownByClassification: addCounter(left.unknownByClassification, right.unknownByClassification),
  missingByClassification: addCounter(left.missingByClassification, right.missingByClassification)
});

const specKey = (field: string, value: string): string => JSON.stringify([field, value]);

export const inspectTechnicalProvenanceCoverage = async (workspace: string): Promise<TechnicalProvenanceCoverage> => {
  const root = resolve(workspace);
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const totals: ProviderCoverage[] = [];
  const recordsByProvider = new Map<PanelProviderId, ReadonlyMap<string, ProductRecord>>();
  const mechanisms = new Map<string, number>();
  const unattributedMechanisms = new Map<string, number>();
  const grayCases: GrayProvenanceCase[] = [];
  const grayBlockers = new Map<GrayProvenanceBlocker, number>();
  const unresolvedCases: GrayProvenanceCase[] = [];
  const unresolvedBlockers = new Map<GrayProvenanceBlocker, number>();
  const byHistorical: Record<Kind, Counter> = { own: emptyCounter(), reused: emptyCounter(), pending: emptyCounter() };
  const motorProviders: MotorComparison[] = [];
  const differences: TechnicalClassificationDifference[] = [];
  for (const provider of snapshot.providers) {
    const originals = await readPortableOriginal(root, provider.providerId);
    const records = new Map(originals.products.map((item) =>
      [productIdentity(provider.providerId, item.reference, item.url), item] as const));
    recordsByProvider.set(provider.providerId, records);
    if (records.size !== originals.products.length || records.size !== provider.metrics.originals) {
      throw new Error(`Originales inválidos para cobertura: ${provider.providerId}`);
    }
    const stored = await readPublicationTechnicalProvenance(
      root, provider.publication.path, provider.providerId, provider.publication.sha256);
    const historicalEmitted = stored?.products.reduce((sum, item) =>
      sum + item.technicalProvenance.entries.length, 0) ?? 0;
    let additions = 0;
    const classification: Record<Kind, number> = { own: 0, reused: 0, pending: 0 };
    const motor = emptyCounter();
    let resolvedPending = 0;
    let historicalAtRisk = 0;
    let replayed = 0;
    let unitSource = 0;
    let modelDocument = 0;
    let reviewedModelFacts = 0;
    let unitDocument = 0;
    let documentReference = 0;
    let unknownSource = 0;
    let missing = 0;
    let pendingWithUnknownSource = 0;
    const unitByClassification = emptyCounter();
    const modelDocumentByClassification = emptyCounter();
    const reviewedModelFactsByClassification = emptyCounter();
    const unitDocumentByClassification = emptyCounter();
    const documentReferenceByClassification = emptyCounter();
    const unknownByClassification = emptyCounter();
    const missingByClassification = emptyCounter();
    for (const item of explorer.products.filter((product) => product.providerId === provider.providerId && product.published)) {
      const original = records.get(item.identity);
      if (!original || !item.published) throw new Error(`Publicación sin fuente: ${item.identity}`);
      const prepared = prepareSourceProduct(original);
      const trace = prepared.technicalProvenance;
      if (!trace || trace.originalRecordSha256 !== originalRecordFingerprint(original)) {
        throw new Error(`Ensayo sin identidad de procedencia: ${item.identity}`);
      }
      const evidence = new Map<string, TechnicalSpecEvidence>(trace.entries.map((entry) =>
        [specKey(entry.field, entry.value), entry] as const));
      for (const addition of item.specAdditions) {
        additions += 1;
        classification[addition.kind] += 1;
        const entry = evidence.get(specKey(addition.field, addition.value));
        const motorKind = classifyPublishedTechnicalSpec(original, trace, addition.field, addition.value);
        motor[motorKind] += 1;
        byHistorical[addition.kind][motorKind] += 1;
        if (addition.kind === "pending" && motorKind !== "pending") resolvedPending += 1;
        if (addition.kind !== "pending" && motorKind === "pending") historicalAtRisk += 1;
        if (motorKind !== addition.kind) {
          differences.push({ providerId: provider.providerId, reference: original.reference,
            sourceUrl: original.url, field: addition.field, value: addition.value,
            historical: addition.kind, motor: motorKind, mechanism: entry?.mechanism ?? null,
            scope: entry?.scope ?? null,
            documentUrl: entry && "document" in entry ? entry.document?.url ?? null : null,
            reviewedFact: entry !== undefined && "verification" in entry && entry.verification !== undefined });
        }
        if (addition.kind === "pending") {
          const assessment = evaluateGrayProvenance(original, addition.field, addition.value, entry);
          const grayCase: GrayProvenanceCase = { providerId: provider.providerId, reference: original.reference,
            sourceUrl: original.url, originalRecordSha256: trace.originalRecordSha256,
            field: addition.field, value: addition.value, ...assessment };
          grayCases.push(grayCase);
          grayBlockers.set(assessment.blocker, (grayBlockers.get(assessment.blocker) ?? 0) + 1);
          if (motorKind === "pending") {
            unresolvedCases.push(grayCase);
            unresolvedBlockers.set(assessment.blocker, (unresolvedBlockers.get(assessment.blocker) ?? 0) + 1);
          }
        }
        if (!entry) {
          missing += 1;
          missingByClassification[addition.kind] += 1;
          continue;
        }
        replayed += 1;
        mechanisms.set(entry.mechanism, (mechanisms.get(entry.mechanism) ?? 0) + 1);
        if (entry.scope === "unit") {
          if (entry.sourceField === "longDescription" && entry.sourceValue !== original.longDescription ||
            entry.sourceField === "year" && entry.sourceValue !== original.year ||
            entry.sourceField !== "longDescription" && entry.sourceField !== "year" &&
              original.specs?.[entry.sourceField] !== entry.sourceValue) {
            throw new Error(`Evidencia de campo inconsistente: ${item.identity}`);
          }
          unitSource += 1;
          unitByClassification[addition.kind] += 1;
        } else if (entry.scope === "model-document" || entry.scope === "unit-document" ||
          entry.scope === "document-reference") {
          if (!matchesDocumentedTechnicalIdentity(original, entry)) {
            throw new Error(`Fuente documental incompatible: ${item.identity}`);
          }
          if (entry.scope === "model-document") {
            modelDocument += 1;
            modelDocumentByClassification[addition.kind] += 1;
            if (entry.verification) {
              reviewedModelFacts += 1;
              reviewedModelFactsByClassification[addition.kind] += 1;
            }
          } else if (entry.scope === "unit-document") {
            unitDocument += 1;
            unitDocumentByClassification[addition.kind] += 1;
          } else {
            documentReference += 1;
            documentReferenceByClassification[addition.kind] += 1;
          }
        } else {
          unknownSource += 1;
          unknownByClassification[addition.kind] += 1;
          unattributedMechanisms.set(entry.mechanism, (unattributedMechanisms.get(entry.mechanism) ?? 0) + 1);
          if (addition.kind === "pending") pendingWithUnknownSource += 1;
        }
      }
    }
    if (additions !== replayed + missing || replayed !== unitSource + modelDocument + unitDocument + documentReference + unknownSource) {
      throw new Error(`Cobertura técnica inconsistente: ${provider.providerId}`);
    }
    if (motor.own + motor.reused + motor.pending !== additions) {
      throw new Error(`Ensayo de clasificación incompleto: ${provider.providerId}`);
    }
    motorProviders.push({ providerId: provider.providerId, historical: { ...classification },
      motor, resolvedPending, unresolvedPending: classification.pending - resolvedPending, historicalAtRisk });
    totals.push({ providerId: provider.providerId, additions, classification, replayed,
      unitSource, modelDocument, reviewedModelFacts, unitDocument, documentReference, unknownSource, missing, historicalEmitted, pendingWithUnknownSource,
      unitByClassification, modelDocumentByClassification, reviewedModelFactsByClassification,
      unitDocumentByClassification, documentReferenceByClassification,
      unknownByClassification, missingByClassification });
  }
  if (grayCases.length !== totals.reduce(add, initial()).classification.pending) {
    throw new Error("La auditoría gris no cubre todas las incorporaciones pendientes");
  }
  for (const mechanism of mechanisms.keys()) {
    if (!mechanism.startsWith("src/preparation/") || !mechanism.endsWith(".ts") ||
      !(await stat(resolve(root, mechanism))).isFile()) {
      throw new Error(`Mecanismo de procedencia inexistente: ${mechanism}`);
    }
  }
  const aggregate = totals.reduce(add, initial());
  const motor = motorProviders.reduce((result, item) => addCounter(result, item.motor), emptyCounter());
  const resolvedPending = byHistorical.pending.own + byHistorical.pending.reused;
  const historicalAtRisk = byHistorical.own.pending + byHistorical.reused.pending;
  if (motor.own + motor.reused + motor.pending !== aggregate.additions ||
    resolvedPending + byHistorical.pending.pending !== aggregate.classification.pending ||
    unresolvedCases.length !== byHistorical.pending.pending ||
    [...unresolvedBlockers.values()].reduce((sum, count) => sum + count, 0) !== unresolvedCases.length ||
    historicalAtRisk + resolvedPending !== differences.length ||
    motorProviders.reduce((sum, item) => sum + item.historicalAtRisk, 0) !== historicalAtRisk) {
    throw new Error("Equivalencia técnica inconsistente");
  }
  const withdrawn = withdrawnTechnicalSpecs.map((item) => {
    const original = explorer.products.find((product) => product.providerId === item.providerId &&
      product.reference === item.reference);
    if (!original || !original.original || !original.published) {
      throw new Error(`Ficha retirada sin comparación original/publicada: ${item.providerId}:${item.reference}`);
    }
    const prepared = recordsByProvider.get(item.providerId)?.get(original.identity);
    if (!prepared || prepared.specs?.[item.field] !== undefined) {
      throw new Error(`La spec retirada no corresponde a enriquecimiento técnico: ${item.providerId}:${item.reference}`);
    }
    const fresh = prepareSourceProduct(prepared);
    if (fresh.product.spec[item.field] !== undefined ||
      fresh.technicalProvenance?.entries.some((entry) => entry.field === item.field)) {
      throw new Error(`La spec retirada reaparece en preparación: ${item.providerId}:${item.reference}:${item.field}`);
    }
    const published = original.published.specs[item.field] === item.value;
    if (original.published.specs[item.field] !== undefined && !published) {
      throw new Error(`Valor distinto para una spec retirada: ${item.providerId}:${item.reference}:${item.field}`);
    }
    return { ...item, published };
  });
  return { version: 1, mode: "historical-rehearsal", classificationChanged: false,
    withdrawn: { fromPreparation: withdrawn.length,
      stillInHistoricalPublication: withdrawn.filter((item) => item.published).length, cases: withdrawn },
    providers: totals, totals: aggregate,
    equivalence: { mode: "motor-offline-rehearsal", historical: aggregate.classification,
      motor, byHistorical, resolvedPending, unresolvedPending: byHistorical.pending.pending,
      unresolvedCases, unresolvedBlockers: Object.fromEntries([...unresolvedBlockers.entries()]
        .sort(([first], [second]) => first.localeCompare(second))),
      historicalAtRisk, providers: motorProviders, differences },
    mechanisms: Object.fromEntries(
      [...mechanisms.entries()].sort(([first], [second]) => first.localeCompare(second))),
    unattributedMechanisms: Object.fromEntries([...unattributedMechanisms.entries()]
      .sort(([firstName, firstCount], [secondName, secondCount]) =>
        secondCount - firstCount || firstName.localeCompare(secondName))),
    grayCases, grayBlockers: Object.fromEntries([...grayBlockers.entries()]
      .sort(([first], [second]) => first.localeCompare(second))) };
};

export const runTechnicalProvenanceCoverage = async (args: readonly string[]): Promise<void> => {
  if (args.length > 1 || args.length === 1 && args[0] !== "--json") {
    throw new Error("Uso: node dist/tools/catalog/technical-provenance-coverage.js [--json]");
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const report = await inspectTechnicalProvenanceCoverage(root);
  if (args[0] === "--json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const totals = report.totals;
  process.stdout.write(`PROCEDENCIA MOTOR | ensayo sobre ${totals.additions} incorporaciones históricas | ${totals.replayed} reproducidas con mecanismo | ${totals.unitSource} fuente propia acreditada | ${totals.modelDocument} referencias documentales de modelo | ${totals.unitDocument} referencias documentales de unidad | ${totals.documentReference} documentos con identidad parcial | ${totals.unknownSource} origen no acreditado | ${totals.missing} sin reproducción | ${totals.historicalEmitted} evidencias en publicaciones existentes\n`);
  for (const provider of report.providers) {
    process.stdout.write(`  ${provider.providerId} | ${provider.replayed}/${provider.additions} reproducidas | ${provider.unitSource} propias | ${provider.modelDocument} docs modelo | ${provider.unitDocument} docs unidad | ${provider.documentReference} referencias con identidad parcial | ${provider.unknownSource} origen desconocido | ${provider.missing} sin traza | ${provider.pendingWithUnknownSource} grises sin origen acreditado\n`);
  }
  process.stdout.write(`Clasificación calculada por el motor: ${totals.classification.own} azules, ${totals.classification.reused} naranjas y ${totals.classification.pending} grises en el corte publicado; ${totals.historicalEmitted} evidencias históricas emitidas. La reproducción no demuestra qué mecanismo se ejecutó históricamente.\n`);
  process.stdout.write(`RETIRADAS | ${report.withdrawn.fromPreparation} specs ya ausentes de la preparación | ${report.withdrawn.stillInHistoricalPublication} todavía presentes en publicaciones históricas que requieren regeneración acreditada. No se consideran reclasificadas.\n`);
  const equivalence = report.equivalence;
  process.stdout.write(`COMPROBACIÓN MOTOR | ${equivalence.motor.own} azules, ${equivalence.motor.reused} naranjas y ${equivalence.motor.pending} grises | ${equivalence.differences.length} discrepancias entre el explorador y el ensayo del motor. Sin cambios en las publicaciones.\n`);
  process.stdout.write(`Bloqueos de las ${equivalence.unresolvedPending} incorporaciones pendientes en el corte publicado: ${Object.entries(equivalence.unresolvedBlockers).map(([blocker, count]) => `${blocker}: ${count}`).join(" | ")}\n`);
  for (const provider of equivalence.providers) {
    process.stdout.write(`  ${provider.providerId} | motor ${provider.motor.own}/${provider.motor.reused}/${provider.motor.pending} | pendientes ${provider.unresolvedPending}\n`);
  }
  process.stdout.write(`Fuente propia acreditada: ${totals.unitByClassification.own} azules, ${totals.unitByClassification.reused} naranjas y ${totals.unitByClassification.pending} grises. Pendientes de fuente: ${totals.unknownByClassification.own} azules, ${totals.unknownByClassification.reused} naranjas y ${totals.unknownByClassification.pending} grises. Sin reproducción: ${totals.missing} incorporaciones.\n`);
  process.stdout.write(`Documentación de modelo por clasificación: ${totals.modelDocumentByClassification.own} azules, ${totals.modelDocumentByClassification.reused} naranjas y ${totals.modelDocumentByClassification.pending} grises. Documento de unidad: ${totals.unitDocumentByClassification.own} azules, ${totals.unitDocumentByClassification.reused} naranjas y ${totals.unitDocumentByClassification.pending} grises. Documentos con identidad parcial: ${totals.documentReferenceByClassification.own} azules, ${totals.documentReferenceByClassification.reused} naranjas y ${totals.documentReferenceByClassification.pending} grises. Las referencias no implican validación en línea del documento.\n`);
  const outstanding = Object.entries(report.unattributedMechanisms).slice(0, 8);
  process.stdout.write(`Mayores mecanismos pendientes: ${outstanding.map(([name, count]) => `${name} (${count})`).join(" | ")}\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runTechnicalProvenanceCoverage(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`PROCEDENCIA MOTOR | ERROR | ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
