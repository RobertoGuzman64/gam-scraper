import { normalizationSerializationChecks, type NormalizationSerializationOutcomes } from "../../../catalog/diagnostics/normalization/normalization-serialization.js";
import { createHash } from "node:crypto";
import { basename, relative } from "node:path";
import type { PublicationTechnicalProvenance, ProductTechnicalProvenance } from "../../../contracts/technical-provenance.js";
import type { ImportCandidate, ImportCatalog } from "../../../commercial/legacy-export/contracts.js";
import { prepareImportBatch } from "../../../preparation/product/batch-identity.js";
import { projectCommercialCategory } from "../../../commercial/projection/category-projection.js";
import type { PreparedProduct } from "../../../preparation/contracts.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalogSnapshot } from "../legacy-export/import-catalog-loader.js";
import { normalizationAttributeChecks } from "../../../catalog/diagnostics/normalization/normalization-attributes.js";
import { CAMPAIGN_PROVIDERS } from "../../../contracts/campaign-providers.js";
import { attachNormalizationPublications, inspectNormalizationProduct } from "../../../catalog/diagnostics/normalization/normalization-audit.js";
import { evaluateNormalizationChecks, summarizeNormalizationChecks, type NormalizationCheck, type NormalizationCheckContext } from "../../../catalog/diagnostics/normalization/normalization-checks.js";
import { normalizationDimensionalChecks } from "../../../catalog/diagnostics/normalization/normalization-dimensional.js";
import { semanticStageChecks } from "../../../catalog/diagnostics/normalization/normalization-semantic.js";
import { semanticReconciliationChecks } from "../../../catalog/diagnostics/normalization/normalization-reconciliation.js";
import { normalizationEquivalenceChecks } from "../../../catalog/diagnostics/normalization/normalization-equivalence.js";
import { normalizationReentryChecks } from "../../../catalog/diagnostics/normalization/normalization-reentry.js";
import { analyzeNormalizationImpact } from "../../../catalog/diagnostics/normalization/normalization-impact.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../catalog/publications/accredited-publication.js";
import { accreditedPublicationOriginalSources } from "../catalog/publications/accredited-publication-original.js";
import { editorialAuditFingerprints, loadEditorialAuditPopulation } from "./editorial-audit-population.js";
import { auditProviderCoverage, collectAuditProviderResults } from "../../../shared/audit-provider-results.js";

export type NormalizationPublicationProvenanceReader = (workspace: string, publicationPath: string, providerId: string,
  publicationSha256: string) => Promise<PublicationTechnicalProvenance | null>;

export type NormalizationSerializationReader = (records: readonly ProductRecord[]) => Promise<ReadonlyMap<string, NormalizationSerializationOutcomes>>;

const traceKey = (reference: string | null, sourceUrl: string): string => JSON.stringify([reference, sourceUrl]);
const publicationTraces = async (reader: NormalizationPublicationProvenanceReader | undefined, workspace: string, path: string,
  publication: { readonly providerId: string; readonly sha256: string; readonly products: readonly ImportCandidate[] }): Promise<{
    readonly traces: ReadonlyMap<string, ProductTechnicalProvenance>;
    readonly error?: string;
  }> => {
  const traces = new Map<string, ProductTechnicalProvenance>();
  if (!reader || basename(path) === "publishable.json") return { traces };
  try {
    const document = await reader(workspace, relative(workspace, path), publication.providerId, publication.sha256);
    if (!document) return { traces };
    for (const item of document.products) traces.set(traceKey(item.reference, item.sourceUrl), item.technicalProvenance);
    if (document.providerId !== publication.providerId || document.products.length !== publication.products.length ||
      traces.size !== document.products.length || publication.products.some((item) => !traces.has(traceKey(item.reference, item.sourceUrl)))) {
      throw new Error("Población de trazas técnicas distinta de la publicación acreditada");
    }
    return { traces };
  } catch (error) {
    return { traces: new Map(), error: error instanceof Error ? error.message : String(error) };
  }
};

const commercialMappings = (records: readonly ProductRecord[], observations: ReturnType<typeof attachNormalizationPublications>,
  catalog: ImportCatalog): { readonly mapped: ReadonlyMap<string, PreparedProduct>; readonly error?: string } => {
  try {
    const selected = records.filter((_source, index) => observations[index]?.publication !== undefined);
    const prepared = prepareImportBatch(selected, catalog).products;
    const mapped = new Map<string, PreparedProduct>();
    for (const [index, source] of selected.entries()) {
      const product = prepared[index];
      if (!product) throw new Error(`Proyección comercial incompleta: ${source.url}`);
      mapped.set(source.url, projectCommercialCategory(source, product, catalog));
    }
    return { mapped };
  } catch (error) { return { mapped: new Map(), error: error instanceof Error ? error.message : String(error) }; }
};

export const buildNormalizationAudit = async (workspace: string, checks: readonly NormalizationCheck[] = [...normalizationReentryChecks, ...normalizationDimensionalChecks,
  ...semanticStageChecks, ...semanticReconciliationChecks, ...normalizationEquivalenceChecks, ...normalizationAttributeChecks, ...normalizationSerializationChecks], readPublicationProvenance?: NormalizationPublicationProvenanceReader,
  readSerialization?: NormalizationSerializationReader) => {
  const fingerprints = await editorialAuditFingerprints();
  const commercialRequested = checks.some((check) => normalizationAttributeChecks.some(({ id }) => id === check.id));
  const metadata = commercialRequested ? await loadImportCatalogSnapshot().then(({ catalog, categoryRaw, attributeRaw }) => ({
    catalog, catalogSha256: createHash("sha256").update(JSON.stringify([categoryRaw, attributeRaw])).digest("hex")
  })).catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) })) : undefined;
  const results = await collectAuditProviderResults(CAMPAIGN_PROVIDERS, async (providerId) => {
    const { records, prepared, provenance } = await loadEditorialAuditPopulation(workspace, providerId, fingerprints);
    if (records.length === 0 || records.length !== provenance.source.productCount) {
      throw new Error(`Población original incompleta en normalización: ${providerId}`);
    }
    const path = await resolveAccreditedPublication(workspace, providerId);
    if (!path) throw new Error(`No existe publicación acreditada de ${providerId}`);
    const publication = await readAccreditedPublication(path);
    if (publication.providerId !== providerId || publication.products.length === 0) {
      throw new Error(`Población publicada incompatible en normalización: ${providerId}`);
    }
    const originals = await accreditedPublicationOriginalSources(workspace, path, providerId);
    const observations = records.map((source, index) => {
      const product = prepared[index];
      if (!product) throw new Error(`Preparación incompleta en normalización: ${providerId}`);
      return inspectNormalizationProduct(source, product);
    });
    const attached = attachNormalizationPublications(observations, originals, providerId, publication.products, publication.sha256);
    const contexts: NormalizationCheckContext[] = [];
    if (checks.length > 0) {
      const serialization = providerId === "gam" && readSerialization && checks.some(({ id }) => normalizationSerializationChecks.some((check) => check.id === id))
        ? await readSerialization(records).then((mapped) => ({ mapped })).catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) })) : undefined;
      const lineage = await publicationTraces(readPublicationProvenance, workspace, path, publication);
      const publishedByUrl = new Map(publication.products.map((product) => [product.sourceUrl, product]));
      const commercial = metadata && "catalog" in metadata ? commercialMappings(records, attached, metadata.catalog) : undefined;
      const commercialError = metadata && "error" in metadata ? metadata.error : commercial?.error;
      for (const [index, observation] of attached.entries()) {
        const source = records[index];
        const preparation = prepared[index];
        const published = observation.publication ? publishedByUrl.get(observation.sourceUrl) : null;
        if (!source || !preparation || published === undefined) throw new Error(`Contexto de normalización incompleto: ${observation.identity}`);
        const mapped = commercial?.mapped.get(observation.sourceUrl);
        const serialized = serialization && "mapped" in serialization ? serialization.mapped.get(source.url) : undefined;
        const serializationError = serialization && "error" in serialization ? serialization.error : serialization && !serialized ? "Resultado CSV–seed no conciliado con el origen" : undefined;
        contexts.push({ observation, source, prepared: preparation, published,
          ...(serialized === undefined ? {} : { serialization: serialized }),
          ...(serializationError === undefined ? {} : { serializationError }),
          ...(mapped && metadata && "catalog" in metadata ? { commercial: { ...metadata, mapped } } : {}),
          ...(commercialError === undefined ? {} : { commercialError }),
          publishedProvenance: published ? lineage.traces.get(traceKey(published.reference, published.sourceUrl)) ?? null : null,
          ...(lineage.error === undefined ? {} : { publicationProvenanceError: lineage.error }) });
      }
    }
    const diagnostics = evaluateNormalizationChecks(checks, providerId, contexts);
    const source = { providerId, ...provenance, publication: { path: relative(workspace, path),
      sha256: publication.sha256, runId: publication.runId, productCount: publication.products.length } };
    return { providerId, value: { source, observations: attached, diagnostics } };
  }, (providerId) => providerId);
  const sources = results.evaluated.map((item) => item.source);
  const population = { expected: CAMPAIGN_PROVIDERS, selected: CAMPAIGN_PROVIDERS,
    processed: sources.map((source) => source.providerId),
    unavailable: results.failures.filter((failure) => failure.category === "INCOMPLETE_SOURCE").map((failure) => failure.source),
    incomplete: results.failures.filter((failure) => failure.category === "ERROR").map((failure) => failure.source) };
  const report = analyzeNormalizationImpact(results.evaluated.flatMap((item) => item.observations));
  const diagnostics = summarizeNormalizationChecks(checks, CAMPAIGN_PROVIDERS, results.evaluated.flatMap((item) => item.diagnostics));
  return { version: 1, complete: results.failures.length === 0 && sources.length === CAMPAIGN_PROVIDERS.length && diagnostics.failures.length === 0,
    provenance: { population, sources, fingerprints, preparation: "Vista recalculada en memoria con las reglas actuales, no preparación histórica" },
    auditCoverage: auditProviderCoverage(results), ...report, diagnostics };
};
