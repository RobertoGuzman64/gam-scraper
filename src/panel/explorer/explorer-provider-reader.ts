import { join } from "node:path";
import { readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { CommercialDeliveryPlan, CommercialDeliveryProduct } from "../../commercial/export/commercial-export.js";
import { assertCommercialLineage } from "../evidence/commercial-evidence.js";
import { digest, recordFrom, regularText } from "../evidence/evidence-files.js";
import type { PanelProviderEvidence } from "../evidence/types.js";
import { productIdentity } from "./explorer-identity.js";
import { isDelivery, isEditorialExclusion } from "./explorer-data-validation.js";
import type { EditorialExclusion } from "./explorer-data-validation.js";
import { fromOriginal, fromPublication, toExplorerProduct } from "./explorer-product-view.js";
import { compareOriginalToPublished } from "./field-differences.js";
import type { PanelSpecAddition } from "./types.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { PanelExplorerProduct, PanelProductDecision } from "./types.js";

const readExclusions = async (root: string, evidence: PanelProviderEvidence): Promise<readonly EditorialExclusion[]> => {
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
  return decoded.exclusions;
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
  specAdditions: readonly PanelSpecAddition[]
): PanelExplorerProduct => {
  const after = published ? fromPublication(published) : null;
  const changes = original && after ? compareOriginalToPublished(fromOriginal(original), after) : [];
  const additions = changes.filter((difference) => difference.group === "technical" && difference.change === "added");
  if (specAdditions.length !== additions.length || specAdditions.some((entry, index) =>
    entry.field !== additions[index]?.field || entry.value !== additions[index]?.after)) {
    throw new Error("Clasificaciones precalculadas incompatibles con las incorporaciones publicadas");
  }
  return toExplorerProduct(provider.providerId, reference, sourceUrl, original, published, commercial, decision,
    changes, specAdditions);
};

export const readProviderExplorerProducts = async (
  root: string, evidence: PanelProviderEvidence, commercialRaw: string,
  technicalEvidence: ReadonlyMap<string, readonly PanelSpecAddition[]>
): Promise<readonly PanelExplorerProduct[]> => {
  const publishedPath = join(root, evidence.publication.path);
  const published = await readAccreditedPublication(publishedPath);
  if (published.sha256 !== evidence.publication.sha256 || published.providerId !== evidence.providerId) {
    throw new Error(`Publicación modificada durante lectura: ${evidence.providerId}`);
  }
  if (technicalEvidence.size !== published.products.length) {
    throw new Error(`Clasificaciones precalculadas incompletas: ${evidence.providerId}`);
  }
  const plan = verifiedCommercial(commercialRaw, evidence);
  assertCommercialLineage(evidence.providerId, published.products, plan.products, plan.sources, plan.excluded);
  const originals = await mapOriginals(root, evidence);
  const exclusions = await readExclusions(root, evidence);
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
    const exclusion = commercialExcluded.get(key);
    if (!exported.has(key) && !exclusion) throw new Error(`Falta destino comercial para ${key}`);
    const decision: PanelProductDecision | null = exclusion ? {
      stage: "commercial", reason: exclusion.reason, issues: [], evidenceUrls: []
    } : null;
    const prepared = technicalEvidence.get(key);
    if (!prepared) throw new Error(`Falta evidencia precalculada: ${key}`);
    result.push(buildExplorerProduct(evidence, item.reference, item.sourceUrl, original, item,
      exported.get(key) ?? null, decision, prepared));
  }
  for (const excluded of exclusions) {
    const key = productIdentity(evidence.providerId, excluded.reference, excluded.sourceUrl);
    if (found.has(key)) throw new Error(`Exclusión editorial repetida o publicada: ${key}`);
    found.add(key);
    const original = originals?.get(key) ?? null;
    if (originals && (!original || original.url !== excluded.sourceUrl || original.reference !== excluded.reference)) {
      throw new Error(`Exclusión sin original acreditado: ${key}`);
    }
    result.push(buildExplorerProduct(evidence, excluded.reference, excluded.sourceUrl, original, null, null,
      { stage: "editorial", reason: excluded.reason, issues: excluded.issues, evidenceUrls: excluded.evidenceUrls },
      []));
  }
  if (result.length !== evidence.metrics.originals || originals && found.size !== originals.size) {
    throw new Error(`Población del explorador distinta del corte: ${evidence.providerId}`);
  }
  return result;
};
