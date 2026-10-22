import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { buildProductIdentity } from "../../catalog/identity.js";
import { prepareImportBatch } from "../../catalog/import/preparation/prepare.js";
import { buildOfflineDiagnostics, compareOfflinePreparations } from "../../catalog/import/preparation/offline-diagnostics.js";
import type { OfflineDiagnostics, PreparationComparison } from "../../catalog/import/preparation/offline-diagnostics.js";
import { parseOfflinePreparation } from "../../catalog/import/preparation/offline-document.js";
import type { OfflinePreparation } from "../../catalog/import/preparation/offline-document.js";
import { readCanonicalCatalog } from "../../infrastructure/filesystem/canonical-catalog.js";
import { loadPreparationInputs } from "../../infrastructure/filesystem/preparation-inputs.js";
import { offlinePreparationManifest, offlinePreparationManifestPath, readOfflinePreparation } from "../../infrastructure/filesystem/offline-preparation.js";

export type PrepareOptions = {
  readonly providerId: string;
  readonly source: string;
  readonly out: string;
  readonly dryRun: boolean;
  readonly compare: string | null;
};

export type PrepareResult = {
  readonly preparation: OfflinePreparation;
  readonly diagnostics: OfflineDiagnostics;
  readonly comparison: PreparationComparison | null;
  readonly preparationFile: string;
  readonly diagnosticsFile: string;
  readonly manifestFile: string;
  readonly comparisonFile: string | null;
};

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");

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

export const prepareSavedCatalog = async (options: PrepareOptions): Promise<PrepareResult> => {
  const source = resolve(options.source);
  const out = resolve(options.out);
  if (!out.endsWith("-preparation.json") || !basename(out).startsWith(basename(source).slice(0, -"-catalog.json".length))) {
    throw new Error("La salida debe ser -preparation.json y conservar el prefijo del catálogo de origen");
  }
  if (dirname(out) === dirname(source)) throw new Error("La preparación debe guardarse separada del catálogo de origen");
  const catalog = await readCanonicalCatalog(source);
  if (catalog.providerId !== options.providerId) throw new Error("El proveedor solicitado no coincide con el catálogo canónico");
  const sourceText = await readFile(source, "utf8");
  const sourceHash = sha(sourceText);
  const manifest: unknown = JSON.parse(await readFile(join(dirname(source), `${catalog.prefix}-catalog.manifest.json`), "utf8"));
  if (!manifest || typeof manifest !== "object" || !("catalogSha256" in manifest) || manifest.catalogSha256 !== sourceHash) {
    throw new Error("El catálogo ha cambiado durante la lectura de la preparación");
  }
  const { catalog: target, fingerprints } = await loadPreparationInputs();
  const prepared = prepareImportBatch(catalog.products, target);
  const preparation = parseOfflinePreparation({
    version: 1, quality: "complete", published: true, preparedAt: new Date().toISOString(),
    source: {
      providerId: catalog.providerId, prefix: catalog.prefix, scope: catalog.scope,
      catalogSha256: sourceHash, productCount: catalog.productCount
    },
    fingerprints,
    totals: prepared.totals,
    identities: catalog.products.map((product) => buildProductIdentity(product).key),
    products: prepared.products
  }, options.providerId);
  const diagnostics = buildOfflineDiagnostics(preparation);
  let comparison: PreparationComparison | null = null;
  if (options.compare) {
    const previous = await readOfflinePreparation(resolve(options.compare), options.providerId);
    comparison = compareOfflinePreparations(preparation, previous);
  }
  const diagnosticsFile = out.slice(0, -"-preparation.json".length) + "-diagnostics.json";
  const manifestFile = offlinePreparationManifestPath(out);
  const comparisonFile = comparison ? out.slice(0, -"-preparation.json".length) + "-comparison.json" : null;
  if (!options.dryRun) {
    await mkdir(dirname(out), { recursive: true });
    const rawPreparation = JSON.stringify(preparation, null, 2);
    const files = [
      { path: out, content: rawPreparation },
      { path: diagnosticsFile, content: JSON.stringify(diagnostics, null, 2) },
      ...(comparison && comparisonFile ? [{ path: comparisonFile, content: JSON.stringify(comparison, null, 2) }] : []),
      { path: manifestFile, content: offlinePreparationManifest(rawPreparation, preparation) }
    ];
    await writeExclusive(files);
  }
  return { preparation, diagnostics, comparison, preparationFile: out, diagnosticsFile, manifestFile, comparisonFile };
};
