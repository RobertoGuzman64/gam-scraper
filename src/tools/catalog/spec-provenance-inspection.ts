import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import { recoverGamStabilizedTechnicalSpecs } from "../../preparation/gam/technical/gam-technical-recovery.js";
import { recoverDocumentedTechnicalSpecs } from "../../preparation/shared/technical/recovery/documented-technical-recovery.js";
import { readPanelSnapshot } from "../../panel/evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../../panel/explorer/read-panel-explorer.js";
import { compareTechnicalFields } from "../../panel/explorer/field-differences.js";
import { productIdentity } from "../../panel/explorer/explorer-identity.js";
import type { PanelProviderEvidence, PanelProviderId } from "../../panel/evidence/types.js";
import type { PanelExplorerProduct, PanelSpecAddition } from "../../panel/explorer/types.js";

type ReplayMechanism = "gamRecovery" | "documentedRecovery" | "originalYear";
type Reproduction = "exact" | "not-reproduced";
type Reason = "verified-original-year-source-compatible" | "verified-original-field-source-compatible" |
  "documented-value-matches-source-scope-not-proven" |
  "exact-value-match-not-historical-provenance" | "not-reproduced-by-inspected-mechanisms";

type InspectionTotals = {
  additions: number;
  own: number;
  reused: number;
  pending: number;
  reproduced: number;
  classifiedReproduced: number;
  pendingReproduced: number;
  notReproduced: number;
  gamRecovery: number;
  documentedRecovery: number;
  originalYear: number;
};

export type SpecProvenanceCandidate = {
  readonly providerId: PanelProviderId;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: string;
  readonly value: string;
  readonly currentKind: PanelSpecAddition["kind"];
  readonly reproduction: Reproduction;
  readonly mechanisms: readonly ReplayMechanism[];
  readonly reason: Reason;
  readonly historicalApplication: "not-demonstrated";
  readonly sourceKindProof: "original-field-compatible" | "not-demonstrated";
};

export type SpecProvenanceInspection = {
  readonly version: 1;
  readonly mode: "solo-lectura";
  readonly classificationChanged: false;
  readonly mechanisms: Readonly<Record<ReplayMechanism, string>>;
  readonly totals: Readonly<InspectionTotals>;
  readonly providers: readonly {
    readonly providerId: PanelProviderId;
    readonly originalPath: string;
    readonly originalSha256: string;
    readonly publicationPath: string;
    readonly publicationSha256: string;
    readonly totals: Readonly<InspectionTotals>;
  }[];
  readonly candidates: readonly SpecProvenanceCandidate[];
};

const mechanisms: Readonly<Record<ReplayMechanism, string>> = {
  gamRecovery: "recoverGamStabilizedTechnicalSpecs",
  documentedRecovery: "recoverDocumentedTechnicalSpecs",
  originalYear: "resolvePanelFieldProvenance"
};

const keyOf = (field: string, value: string): string => JSON.stringify([field, value]);

export const exactAddedKeys = (before: SpecsMap, after: SpecsMap): ReadonlySet<string> =>
  new Set(compareTechnicalFields(before, after)
    .flatMap((difference) => difference.group === "technical" && difference.change === "added" &&
      difference.after !== null ? [keyOf(difference.field, difference.after)] : []));

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const count = (): InspectionTotals => ({ additions: 0, own: 0, reused: 0, pending: 0, reproduced: 0,
  classifiedReproduced: 0, pendingReproduced: 0, notReproduced: 0,
  gamRecovery: 0, documentedRecovery: 0, originalYear: 0 });

const register = (totals: InspectionTotals, candidate: SpecProvenanceCandidate): void => {
  totals.additions += 1;
  totals[candidate.currentKind] += 1;
  if (candidate.reproduction === "exact") {
    totals.reproduced += 1;
    if (candidate.currentKind === "pending") totals.pendingReproduced += 1;
    else totals.classifiedReproduced += 1;
  } else totals.notReproduced += 1;
  for (const mechanism of candidate.mechanisms) totals[mechanism] += 1;
};

const originalRecords = async (root: string, provider: PanelProviderEvidence): Promise<ReadonlyMap<string, ProductRecord>> => {
  if (provider.original.status !== "verified") throw new Error(`Original sin verificar: ${provider.providerId}`);
  const originalPath = join(root, provider.original.artifact.path);
  const expectedSha256 = provider.original.artifact.sha256;
  const check = async (): Promise<void> => {
    if (sha256(await readFile(originalPath)) !== expectedSha256) {
      throw new Error(`Original cambiado durante la inspección: ${provider.providerId}`);
    }
  };
  await check();
  const catalog = await readPortableOriginal(root, provider.providerId);
  await check();
  if (catalog.productCount !== provider.metrics.originals || catalog.products.length !== provider.metrics.originals) {
    throw new Error(`Población original incoherente: ${provider.providerId}`);
  }
  const records = new Map<string, ProductRecord>();
  for (const original of catalog.products) {
    const identity = productIdentity(provider.providerId, original.reference, original.url);
    if (original.providerId !== provider.providerId || records.has(identity)) {
      throw new Error(`Identidad original inválida o repetida: ${identity}`);
    }
    records.set(identity, original);
  }
  return records;
};

const reproducedBy = (original: ProductRecord, product: PanelExplorerProduct): readonly SpecProvenanceCandidate[] => {
  const before = original.specs ?? {};
  const recovered = original.providerId === "gam"
    ? exactAddedKeys(before, recoverGamStabilizedTechnicalSpecs(original, original)) : new Set<string>();
  const documented = exactAddedKeys(before, recoverDocumentedTechnicalSpecs(original, before).documentedSpecs);
  return product.specAdditions.map((addition): SpecProvenanceCandidate => {
    const exactKey = keyOf(addition.field, addition.value);
    const matched: ReplayMechanism[] = [];
    if (recovered.has(exactKey)) matched.push("gamRecovery");
    if (documented.has(exactKey)) matched.push("documentedRecovery");
    if (original.providerId === "gomariz" && original.yearSource === "ficha" &&
      product.provenance.some((evidence) => evidence.group === "technical" &&
        evidence.field === addition.field && evidence.status === "source-compatible" &&
        evidence.sourceField === "year" && evidence.sourceValue === addition.value)) {
      matched.push("originalYear");
    }
    const directProof = product.provenance.some((evidence) => evidence.group === "technical" &&
      evidence.field === addition.field && evidence.status === "source-compatible" &&
      evidence.sourceField !== null && evidence.sourceValue !== null && evidence.proof !== null);
    const reproduction: Reproduction = matched.length > 0 ? "exact" : "not-reproduced";
    const reason: Reason = matched.includes("originalYear") ? "verified-original-year-source-compatible"
      : directProof ? "verified-original-field-source-compatible"
      : matched.includes("documentedRecovery") && addition.kind === "pending"
        ? "documented-value-matches-source-scope-not-proven"
        : matched.length > 0 ? "exact-value-match-not-historical-provenance"
          : "not-reproduced-by-inspected-mechanisms";
    return {
      providerId: product.providerId, reference: original.reference, sourceUrl: original.url,
      field: addition.field, value: addition.value, currentKind: addition.kind,
      reproduction, mechanisms: matched, reason,
      historicalApplication: "not-demonstrated",
      sourceKindProof: directProof ? "original-field-compatible" : "not-demonstrated"
    };
  });
};

export const inspectSpecProvenance = async (workspace: string): Promise<SpecProvenanceInspection> => {
  const root = resolve(workspace);
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const candidates: SpecProvenanceCandidate[] = [];
  const providers: SpecProvenanceInspection["providers"][number][] = [];
  const totals = count();
  for (const provider of snapshot.providers) {
    if (provider.original.status !== "verified") throw new Error(`Original sin verificar: ${provider.providerId}`);
    const records = await originalRecords(root, provider);
    const providerTotals = count();
    for (const product of explorer.products.filter((item) => item.providerId === provider.providerId && item.published !== null)) {
      const original = records.get(product.identity);
      if (!original || original.reference !== product.reference || original.url !== product.sourceUrl) {
        throw new Error(`Ficha publicada sin original acreditado: ${product.identity}`);
      }
      if (product.published === null) throw new Error(`Publicación ausente: ${product.identity}`);
      const reportedAdditions = exactAddedKeys(original.specs ?? {}, product.published.specs);
      if (reportedAdditions.size !== product.specAdditions.length ||
        product.specAdditions.some((addition) => !reportedAdditions.has(keyOf(addition.field, addition.value)))) {
        throw new Error(`Incorporaciones no corresponden a la publicación: ${product.identity}`);
      }
      for (const candidate of reproducedBy(original, product)) {
        candidates.push(candidate);
        register(providerTotals, candidate);
        register(totals, candidate);
      }
    }
    providers.push({ providerId: provider.providerId, originalPath: provider.original.artifact.path,
      originalSha256: provider.original.artifact.sha256, publicationPath: provider.publication.path,
      publicationSha256: provider.publication.sha256, totals: providerTotals });
  }
  if (totals.additions !== explorer.products.reduce((sum, product) => sum + product.specAdditions.length, 0)) {
    throw new Error("Número de incorporaciones discordante con el explorador");
  }
  return { version: 1, mode: "solo-lectura", classificationChanged: false,
    mechanisms, totals, providers, candidates };
};

export const runSpecProvenanceInspection = async (args: readonly string[]): Promise<void> => {
  if (args.length > 1 || args.length === 1 && args[0] !== "--json") {
    throw new Error("Uso: node dist/tools/catalog/spec-provenance-inspection.js [--json]");
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const report = await inspectSpecProvenance(root);
  if (args[0] === "--json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const { totals } = report;
  process.stdout.write(`PROCEDENCIA | ${totals.additions} incorporadas | ${totals.classifiedReproduced} clasificadas reproducibles | ${totals.pendingReproduced} grises reproducibles | ${totals.notReproduced} requieren otro tramo | solo lectura\n`);
  for (const provider of report.providers) {
    const item = provider.totals;
    process.stdout.write(`  ${provider.providerId} | ${item.additions} incorporadas | ${item.reproduced} reproducibles | ${item.notReproduced} sin reproducción | GAM ${item.gamRecovery} | documental ${item.documentedRecovery} | año original ${item.originalYear}\n`);
  }
  const compatible = report.candidates.filter((candidate) => candidate.sourceKindProof === "original-field-compatible").length;
  process.stdout.write(`${compatible} incorporaciones con fuente original directamente compatible. La aplicación histórica de los mecanismos no está demostrada. --json muestra candidatos y motivos.\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runSpecProvenanceInspection(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`PROCEDENCIA | ERROR | ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
