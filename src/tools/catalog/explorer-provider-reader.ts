import { join } from "node:path";
import { readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CommercialDeliveryPlan, CommercialDeliveryProduct } from "../../commercial/export/commercial-export.js";
import { assertCommercialLineage } from "../../panel/evidence/commercial-evidence.js";
import { digest, recordFrom, regularText } from "../../panel/evidence/evidence-files.js";
import type { PanelUnitKnowledgeEvidence } from "../../panel/evidence/knowledge-evidence.js";
import type { PanelProviderEvidence } from "../../panel/evidence/types.js";
import { productIdentity } from "../../panel/explorer/explorer-identity.js";
import { isDelivery, isEditorialExclusion } from "../../panel/explorer/explorer-data-validation.js";
import type { EditorialExclusion } from "../../panel/explorer/explorer-data-validation.js";
import { readPublicationTechnicalProvenance } from "../../panel/evidence/read-technical-provenance.js";
import { originalRecordFingerprint } from "../../catalog/identity-fingerprint.js";
import { fromOriginal, fromPublication, toExplorerProduct } from "../../panel/explorer/explorer-product-view.js";
import { compareOriginalToPublished } from "../../panel/explorer/field-differences.js";
import { classifyPublishedTechnicalAdditions } from "../../preparation/technical-spec-classification.js";
import { resolvePanelFieldProvenance } from "./panel-field-provenance.js";
import type { ProductTechnicalProvenance } from "../../contracts/technical-provenance.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { PanelExplorerProduct, PanelProductDecision } from "../../panel/explorer/types.js";

const readExclusions = async (root: string, evidence: PanelProviderEvidence): Promise<{
  readonly items: readonly EditorialExclusion[];
  readonly artifact: { readonly path: string; readonly sha256: string };
}> => {
  const prefix = evidence.publication.path.slice(0, -`${evidence.providerId}-publishable.json`.length);
  const relative = `${prefix}accreditation.json`;
  const raw = await regularText(join(root, relative));
  const decoded = recordFrom(raw, relative);
  if (decoded.approved !== true || !Array.isArray(decoded.exclusions) ||
    !decoded.exclusions.every(isEditorialExclusion) ||
    decoded.exclusions.length !== evidence.metrics.excludedEditorial ||
    decoded.exclusions.some((item: EditorialExclusion) => item.providerId !== evidence.providerId)) {
    throw new Error(`Exclusiones editoriales incoherentes: ${evidence.providerId}`);
  }
  return { items: decoded.exclusions, artifact: { path: relative, sha256: digest(raw) } };
};

const mapOriginals = async (root: string, evidence: PanelProviderEvidence): Promise<ReadonlyMap<string, ProductRecord> | null> => {
  if (evidence.original.status !== "verified") return null;
  const raw = await regularText(join(root, evidence.original.artifact.path));
  if (digest(raw) !== evidence.original.artifact.sha256) {
    throw new Error(`Original modificado durante lectura del explorador: ${evidence.providerId}`);
  }
  const catalog = await readPortableOriginal(root, evidence.providerId);
  if (catalog.productCount !== evidence.metrics.originals || catalog.products.length !== evidence.metrics.originals) {
    throw new Error(`Población original discordante: ${evidence.providerId}`);
  }
  const result = new Map<string, ProductRecord>();
  for (const item of catalog.products) {
    const key = productIdentity(evidence.providerId, item.reference, item.url);
    if (result.has(key)) throw new Error(`Originales con identidad duplicada: ${evidence.providerId}: ${key}`);
    result.set(key, item);
  }
  return result;
};

const verifiedCommercial = (
  raw: string, evidence: PanelProviderEvidence
): CommercialDeliveryPlan => {
  if (digest(raw) !== evidence.commercial.sha256) {
    throw new Error(`Comercial modificado durante lectura: ${evidence.providerId}`);
  }
  const decoded: unknown = JSON.parse(raw);
  if (!isDelivery(decoded) || decoded.providerId !== evidence.providerId ||
    decoded.products.length !== evidence.metrics.exported ||
    decoded.excluded.length !== evidence.metrics.excludedCommercial) {
    throw new Error(`Paquete comercial incompatible con explorador: ${evidence.providerId}`);
  }
  return decoded;
};

const buildExplorerProduct = (
  provider: PanelProviderEvidence, reference: string | null, sourceUrl: string,
  original: ProductRecord | null, published: ImportCandidate | null,
  commercial: CommercialDeliveryProduct | null, decision: PanelProductDecision | null,
  accreditation: { readonly path: string; readonly sha256: string },
  knowledge: PanelUnitKnowledgeEvidence | null, emitted: ProductTechnicalProvenance | null = null
): PanelExplorerProduct => {
  const after = published ? fromPublication(published) : null;
  const changes = original && after ? compareOriginalToPublished(fromOriginal(original), after) : [];
  if (emitted && emitted.entries.some((entry) => !changes.some((difference) =>
    difference.group === "technical" && difference.change === "added" &&
    difference.field === entry.field && difference.after === entry.value))) {
    throw new Error("Evidencia productiva incompatible con especificaciones publicadas");
  }
  const provenance = resolvePanelFieldProvenance(original, after, changes, provider, knowledge, reference, sourceUrl, emitted);
  const specAdditions = classifyPublishedTechnicalAdditions(original, emitted, provider.providerId, reference, sourceUrl,
    provider.original.status === "verified", changes.filter((difference) =>
      difference.group === "technical" && difference.change === "added").map((difference) =>
      ({ field: difference.field, value: difference.after ?? "" })));
  return toExplorerProduct(provider.providerId, reference, sourceUrl, original, published, commercial, decision,
    provider, accreditation, changes, provenance, specAdditions);
};

export const readProviderExplorerProducts = async (
  root: string, evidence: PanelProviderEvidence, commercialRaw: string, knowledge: PanelUnitKnowledgeEvidence | null
): Promise<readonly PanelExplorerProduct[]> => {
  const publishedPath = join(root, evidence.publication.path);
  const published = await readAccreditedPublication(publishedPath);
  if (published.sha256 !== evidence.publication.sha256 || published.providerId !== evidence.providerId) {
    throw new Error(`Publicación modificada durante lectura: ${evidence.providerId}`);
  }
  const plan = verifiedCommercial(commercialRaw, evidence);
  assertCommercialLineage(evidence.providerId, published.products, plan.products, plan.sources, plan.excluded);
  const originals = await mapOriginals(root, evidence);
  const publishedTraces = await readPublicationTechnicalProvenance(
    root, evidence.publication.path, evidence.providerId, evidence.publication.sha256
  );
  if (publishedTraces && publishedTraces.products.length !== published.products.length) {
    throw new Error("La procedencia técnica no cubre la publicación completa");
  }
  const traces = new Map((publishedTraces?.products ?? []).map((item) =>
    [productIdentity(evidence.providerId, item.reference, item.sourceUrl), item.technicalProvenance] as const));
  if (publishedTraces && traces.size !== publishedTraces.products.length) {
    throw new Error("Procedencias de publicación duplicadas");
  }
  const accreditation = await readExclusions(root, evidence);
  const exported = new Map<string, CommercialDeliveryProduct>();
  for (const [index, source] of plan.sources.entries()) {
    const item = plan.products[index];
    if (!item || exported.has(source.identity)) throw new Error(`Fuente comercial mal alineada: ${evidence.providerId}`);
    exported.set(source.identity, item);
  }
  const commercialExcluded = new Map(plan.excluded.map((item) => [item.identity, item]));
  const found = new Set<string>();
  const result: PanelExplorerProduct[] = [];
  for (const item of published.products) {
    const key = productIdentity(evidence.providerId, item.reference, item.sourceUrl);
    if (found.has(key)) throw new Error(`Identidad publicada duplicada: ${key}`);
    found.add(key);
    const original = originals?.get(key) ?? null;
    if (originals && (!original || original.url !== item.sourceUrl || original.reference !== item.reference)) {
      throw new Error(`Original y publicado no corresponden: ${evidence.providerId}: ${key}`);
    }
    const trace = traces.get(key) ?? null;
    if (publishedTraces && !trace) throw new Error(`Falta traza de publicación para ${key}`);
    if (trace && original && originalRecordFingerprint(original) !== trace.originalRecordSha256) {
      throw new Error(`Traza técnica para otra identidad o variante: ${key}`);
    }
    const exclusion = commercialExcluded.get(key);
    if (!exported.has(key) && !exclusion) throw new Error(`Falta destino comercial para ${key}`);
    const decision: PanelProductDecision | null = exclusion ? {
      stage: "commercial", reason: exclusion.reason, issues: [], evidenceUrls: []
    } : null;
    result.push(buildExplorerProduct(evidence, item.reference, item.sourceUrl, original, item,
      exported.get(key) ?? null, decision, accreditation.artifact, knowledge, trace));
  }
  for (const excluded of accreditation.items) {
    const key = productIdentity(evidence.providerId, excluded.reference, excluded.sourceUrl);
    if (found.has(key)) throw new Error(`Exclusión editorial repetida o publicada: ${key}`);
    found.add(key);
    const original = originals?.get(key) ?? null;
    if (originals && (!original || original.url !== excluded.sourceUrl || original.reference !== excluded.reference)) {
      throw new Error(`Exclusión sin original acreditado: ${key}`);
    }
    result.push(buildExplorerProduct(evidence, excluded.reference, excluded.sourceUrl, original, null, null,
      { stage: "editorial", reason: excluded.reason, issues: excluded.issues, evidenceUrls: excluded.evidenceUrls },
      accreditation.artifact, knowledge));
  }
  if (result.length !== evidence.metrics.originals || originals && found.size !== originals.size) {
    throw new Error(`Población del explorador distinta del corte: ${evidence.providerId}`);
  }
  return result;
};
