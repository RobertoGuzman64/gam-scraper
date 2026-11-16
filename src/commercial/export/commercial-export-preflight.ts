import { basename, dirname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { loadImportCatalogSnapshot } from "../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import type { CommercialEnvironment } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { checkHistoricalReferenceIntegrity } from "../../infrastructure/filesystem/legacy-export/reference-integrity.js";
import type { HistoricalReferenceMismatch } from "../../infrastructure/filesystem/legacy-export/reference-integrity.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { assertCurrentCommercialInventory, readCommercialPublicationInput } from "./commercial-inputs.js";
import { prepareCommercialExportProvider } from "./commercial-export.js";
import { loadFindingRecognitionRegistry } from "../../infrastructure/filesystem/catalog/finding-recognition-store.js";
import type { AuditProviderFailure } from "../../shared/audit-provider-results.js";

export type CommercialExportPublicationEvidence = {
  readonly providerId: string;
  readonly runId: string;
  readonly publicationSha256: string;
  readonly products: number;
  readonly selection: string;
  readonly sourceCatalogSha256: string | null;
  readonly sourceProductCount: number | null;
};

export type CommercialExportPreflight = {
  readonly publications: readonly CommercialExportPublicationEvidence[];
  readonly failures: readonly AuditProviderFailure[];
  readonly globalFailures: readonly string[];
  readonly historicalReferences: readonly HistoricalReferenceMismatch[] | null;
  readonly historicalReferenceWarning: string | null;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const issue = (providerId: string, error: unknown): AuditProviderFailure => {
  const detail = error instanceof Error ? error.message : String(error);
  return { source: providerId, providerId,
    category: detail.startsWith("No se conserva el original acreditado de ") ||
      detail.startsWith("Falta el original canónico para ") ? "INCOMPLETE_SOURCE" : "ERROR", detail };
};

const publicationEvidence = async (
  path: string, providerId: string
): Promise<CommercialExportPublicationEvidence> => {
  const publication = await readAccreditedPublication(path);
  let sourceCatalogSha256: string | null = null;
  let sourceProductCount: number | null = null;
  if (basename(path) !== "publishable.json") {
    const raw: unknown = JSON.parse(await readFile(join(dirname(path), "manifest.json"), "utf8"));
    if (record(raw) && record(raw.source) &&
      typeof raw.source.catalogSha256 === "string" && Number.isSafeInteger(raw.source.productCount)) {
      sourceCatalogSha256 = raw.source.catalogSha256;
      sourceProductCount = Number(raw.source.productCount);
    }
  }
  return { providerId, runId: publication.runId, publicationSha256: publication.sha256,
    products: publication.products.length, selection: path, sourceCatalogSha256, sourceProductCount };
};

export const inspectCommercialExportPreflight = async (
  directory: string, environment: CommercialEnvironment | null
): Promise<CommercialExportPreflight> => {
  const root = resolve(directory);
  const publications: CommercialExportPublicationEvidence[] = [];
  const failures: AuditProviderFailure[] = [];
  const globalFailures: string[] = [];
  let historicalReferences: readonly HistoricalReferenceMismatch[] | null = null;
  let historicalReferenceWarning: string | null = null;
  try { historicalReferences = await checkHistoricalReferenceIntegrity(root); }
  catch (error) { historicalReferenceWarning = error instanceof Error ? error.message : String(error); }
  const catalog = await loadImportCatalogSnapshot().then((result) => result.catalog).catch((error: unknown) => {
    globalFailures.push(`Catálogo comercial: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  const references = await loadCommercialReference().catch((error: unknown) => {
    globalFailures.push(`Referencias comerciales: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  const registry = await loadFindingRecognitionRegistry(root).catch((error: unknown) => {
    globalFailures.push(`Reconocimientos comerciales: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  for (const providerId of LEGACY_CAMPAIGN_PROVIDERS) {
    try {
      const path = await resolveAccreditedPublication(root, providerId);
      if (!path) throw new Error(`No existe publicación activa de ${providerId}`);
      const evidence = await publicationEvidence(path, providerId);
      publications.push(evidence);
      if (catalog) {
        const input = await readCommercialPublicationInput(root, path, catalog);
        await assertCurrentCommercialInventory(root, [input]);
        if (references && registry) prepareCommercialExportProvider(input, catalog, references, registry, environment);
      }
      if (references && environment !== null && references.companies[providerId]?.[environment] === undefined) {
        throw new Error(`No existe companyID del proveedor ${providerId} para ${environment}`);
      }
    } catch (error) { failures.push(issue(providerId, error)); }
  }
  return { publications, failures, globalFailures, historicalReferences, historicalReferenceWarning };
};
