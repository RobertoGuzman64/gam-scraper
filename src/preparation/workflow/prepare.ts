import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { buildProductIdentity } from "../../catalog/identity.js";
import type { CanonicalCatalog } from "../../catalog/canonical-catalog.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { prepareImportBatch } from "../prepare.js";
import { buildOfflineDiagnostics, compareOfflinePreparations } from "../documents/offline-diagnostics.js";
import { buildSourceTriage } from "../../catalog/diagnostics/source-triage.js";
import { measurePreparationWork } from "../../catalog/diagnostics/preparation-work.js";
import type { PreparationWorkSummary } from "../../catalog/diagnostics/preparation-work.js";
import type { SourceTriageGroup } from "../../catalog/diagnostics/source-triage.js";
import type { OfflineDiagnostics, PreparationComparison } from "../documents/offline-diagnostics.js";
import { parseOfflinePreparation } from "../documents/offline-document.js";
import type { OfflinePreparation, PreparationFingerprints, PreparationSource } from "../documents/offline-document.js";
import { readCanonicalCatalogWithFingerprint } from "../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { readVerifiedManainRecordSource } from "../../infrastructure/filesystem/catalog/manain-record-source.js";
import { manainRecordPreparationSource } from "./manain-record-source.js";
import { readAppliedIntervention } from "../../infrastructure/filesystem/interventions/intervention-derived.js";
import { loadPreparationInputs } from "../../infrastructure/filesystem/preparation/preparation-inputs.js";
import { offlinePreparationManifest, offlinePreparationManifestPath, readOfflinePreparation } from "../../infrastructure/filesystem/preparation/offline-preparation.js";
import { preparedWorkspaceForOutput, withPreparedStorageWriteLock } from "../../infrastructure/filesystem/preparation/prepared-storage-lock.js";

export type PrepareOptions = {
  readonly providerId: string;
  readonly source: string;
  readonly out: string;
  readonly dryRun: boolean;
  readonly compare: string | null;
  readonly originalSource?: string;
};

export type PrepareResult = {
  readonly preparation: OfflinePreparation;
  readonly diagnostics: OfflineDiagnostics & { readonly sourceTriage: readonly SourceTriageGroup[] };
  readonly comparison: PreparationComparison | null;
  readonly workSummary: PreparationWorkSummary;
  readonly preparationFile: string;
  readonly diagnosticsFile: string;
  readonly manifestFile: string;
  readonly comparisonFile: string | null;
};

const writeExclusive = async (files: readonly { path: string; content: string }[]): Promise<void> => {
  const created: string[] = [];
  try {
    for (const file of files) {
      await writeFile(file.path, file.content, { flag: "wx" });
      created.push(file.path);
    }
  } catch (error) {
    for (const path of created) await rm(path, { force: true });
    throw error;
  }
};

export const assertPreparationInputsCurrent = async (
  options: Pick<PrepareOptions, "source" | "originalSource">,
  expected: {
    readonly catalog: CanonicalCatalog;
    readonly catalogSha256: string;
    readonly fingerprints: PreparationFingerprints;
  }
): Promise<void> => {
  const source = resolve(options.source);
  const derived = options.originalSource === undefined
    ? null : await readAppliedIntervention(source, options.originalSource);
  const snapshot = derived ?? await readCanonicalCatalogWithFingerprint(source);
  const catalog = snapshot.catalog;
  const catalogSha256 = snapshot.catalogSha256;
  if (catalogSha256 !== expected.catalogSha256 || !isDeepStrictEqual(catalog, expected.catalog)) {
    throw new Error("El catálogo de origen cambió durante la preparación; no se guarda una derivación obsoleta");
  }
  const { fingerprints } = await loadPreparationInputs();
  if (!isDeepStrictEqual(fingerprints, expected.fingerprints)) {
    throw new Error("Las reglas de preparación cambiaron durante la ejecución; no se guarda una derivación obsoleta");
  }
};

type VerifiedPreparationInput = {
  readonly source: PreparationSource;
  readonly products: readonly ProductRecord[];
  readonly verifyCurrent: (fingerprints: PreparationFingerprints) => Promise<void>;
};

const prepareVerifiedProducts = async (
  options: Pick<PrepareOptions, "providerId" | "out" | "compare" | "dryRun">,
  input: VerifiedPreparationInput
): Promise<PrepareResult> => {
  const out = resolve(options.out);
  const { fingerprints } = await loadPreparationInputs();
  const prepared = prepareImportBatch(input.products);
  const preparation = parseOfflinePreparation({
    version: 1, quality: "complete", published: true, preparedAt: new Date().toISOString(),
    source: input.source,
    fingerprints,
    totals: prepared.totals,
    identities: input.products.map((product) => buildProductIdentity(product).key),
    products: prepared.products
  }, options.providerId);
  const diagnostics = { ...buildOfflineDiagnostics(preparation), sourceTriage: buildSourceTriage(preparation, input.products) };
  const workSummary = measurePreparationWork(input.products, preparation);
  let comparison: PreparationComparison | null = null;
  if (options.compare) {
    const previous = await readOfflinePreparation(resolve(options.compare), options.providerId);
    comparison = compareOfflinePreparations(preparation, previous);
  }
  const diagnosticsFile = out.slice(0, -"-preparation.json".length) + "-diagnostics.json";
  const manifestFile = offlinePreparationManifestPath(out);
  const comparisonFile = comparison ? out.slice(0, -"-preparation.json".length) + "-comparison.json" : null;
  const workspace = preparedWorkspaceForOutput(out, options.providerId);
  if (!options.dryRun) {
    await input.verifyCurrent(fingerprints);
    await mkdir(dirname(out), { recursive: true });
    const rawPreparation = JSON.stringify(preparation, null, 2);
    const files = [
      { path: out, content: rawPreparation },
      { path: diagnosticsFile, content: JSON.stringify(diagnostics, null, 2) },
      ...(comparison && comparisonFile ? [{ path: comparisonFile, content: JSON.stringify(comparison, null, 2) }] : []),
      { path: manifestFile, content: offlinePreparationManifest(rawPreparation, preparation) }
    ];
    if (workspace) await withPreparedStorageWriteLock(workspace, options.providerId, () => writeExclusive(files));
    else await writeExclusive(files);
  }
  return { preparation, diagnostics, comparison, workSummary, preparationFile: out, diagnosticsFile, manifestFile, comparisonFile };
};

export const prepareSavedCatalog = async (options: PrepareOptions): Promise<PrepareResult> => {
  const source = resolve(options.source);
  const out = resolve(options.out);
  const isDerived = options.originalSource !== undefined;
  if (!out.endsWith("-preparation.json") ||
    (!isDerived && !basename(out).startsWith(basename(source).slice(0, -"-catalog.json".length)))) {
    throw new Error("La salida debe ser -preparation.json y conservar el prefijo del catálogo de origen");
  }
  if (dirname(out) === dirname(source) ||
    (options.originalSource !== undefined && dirname(out) === dirname(resolve(options.originalSource)))) {
    throw new Error("La preparación debe guardarse separada del catálogo de origen");
  }
  const derived = options.originalSource === undefined
    ? null : await readAppliedIntervention(source, options.originalSource);
  const snapshot = derived ?? await readCanonicalCatalogWithFingerprint(source);
  const catalog = snapshot.catalog;
  if (catalog.providerId !== options.providerId) throw new Error("El proveedor solicitado no coincide con el catálogo de origen");
  const sourceHash = snapshot.catalogSha256;
  if (derived === null) {
    const manifest: unknown = JSON.parse(await readFile(join(dirname(source), `${basename(source).slice(0, -"-catalog.json".length)}-catalog.manifest.json`), "utf8"));
    if (!manifest || typeof manifest !== "object" || !("catalogSha256" in manifest) || manifest.catalogSha256 !== sourceHash) {
      throw new Error("El catálogo ha cambiado durante la lectura de la preparación");
    }
  }
  return prepareVerifiedProducts(options, {
    source: {
      providerId: catalog.providerId, prefix: catalog.prefix, scope: catalog.scope,
      catalogSha256: sourceHash, productCount: catalog.productCount,
      ...(derived === null ? {} : { intervention: derived.provenance })
    },
    products: catalog.products,
    verifyCurrent: (fingerprints) => assertPreparationInputsCurrent(options, { catalog, catalogSha256: sourceHash, fingerprints })
  });
};

export const prepareVerifiedManainRecord = async (
  workspace: string, options: Pick<PrepareOptions, "out" | "compare" | "dryRun">
): Promise<PrepareResult> => {
  const verified = await readVerifiedManainRecordSource(workspace);
  const out = resolve(options.out);
  if (!out.endsWith("-preparation.json") || !basename(out).startsWith("manain-record-") ||
    dirname(out) === dirname(verified.recordFile)) {
    throw new Error("La preparación Manain debe guardarse aparte y conservar el prefijo manain-record");
  }
  const source = manainRecordPreparationSource(verified);
  return prepareVerifiedProducts({ ...options, providerId: "manain" }, {
    source, products: verified.originalProducts,
    verifyCurrent: async (fingerprints) => {
      const [current, rules] = await Promise.all([
        readVerifiedManainRecordSource(workspace), loadPreparationInputs()
      ]);
      if (!isDeepStrictEqual(manainRecordPreparationSource(current), source) ||
        !isDeepStrictEqual(current.originalProducts, verified.originalProducts) ||
        !isDeepStrictEqual(rules.fingerprints, fingerprints)) {
        throw new Error("El origen o las reglas de Manain cambiaron durante la preparación; no guardar");
      }
    }
  });
};
