import { join, resolve } from "node:path";
import { buildProductIdentity } from "../../catalog/identity.js";
import { readAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { readPortableOriginal } from "../../infrastructure/filesystem/catalog/portable-original.js";
import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { CommercialDeliveryPlan, CommercialDeliveryProduct, CommercialDeliverySource } from "../../commercial/export/commercial-export.js";
import { assertCommercialLineage, readCommercialFiles } from "../evidence/commercial-evidence.js";
import { digest, isRecord, recordFrom, regularText } from "../evidence/evidence-files.js";
import type { PanelProviderEvidence, PanelProviderId, PanelSnapshot } from "../evidence/types.js";
import { compareOriginalToPublished, comparePublishedToCommercial, compareTechnicalFields } from "./field-differences.js";
import type { PanelExplorerPayload, PanelExplorerProduct, PanelFieldDifference, PanelPresentationCase, PanelProductDecision, PanelProductView, PanelCommercialView } from "./types.js";

const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isWebUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
};
const isSpec = (value: unknown): value is Readonly<Record<string, SpecValue>> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === "string" ||
    typeof item === "boolean" || typeof item === "number" && Number.isFinite(item) ||
    Array.isArray(item) && item.every((part: unknown) => typeof part === "string" ||
      typeof part === "boolean" || typeof part === "number" && Number.isFinite(part)));
const isCommercialProduct = (value: unknown): value is CommercialDeliveryProduct =>
  isRecord(value) && nullableString(value.reference) && nullableString(value.title) &&
  nullableString(value.category) && (value.categorySellID === null || Number.isSafeInteger(value.categorySellID)) &&
  (value.price === null || typeof value.price === "number" && Number.isFinite(value.price)) &&
  nullableString(value.description) && nullableString(value.description_general) && nullableString(value.image) &&
  Array.isArray(value.images) && value.images.every(isWebUrl) && isSpec(value.spec) &&
  Array.isArray(value.attributes) && value.attributes.every((attribute: unknown) => isRecord(attribute) &&
    Number.isSafeInteger(attribute.attributeID) && (typeof attribute.value === "string" ||
      typeof attribute.value === "boolean" || typeof attribute.value === "number" && Number.isFinite(attribute.value)));
const isCommercialSource = (value: unknown): value is CommercialDeliverySource =>
  isRecord(value) && typeof value.identity === "string" && nullableString(value.reference) && isWebUrl(value.sourceUrl);
const isDelivery = (value: unknown): value is CommercialDeliveryPlan =>
  isRecord(value) && value.version === 2 && typeof value.providerId === "string" &&
  Array.isArray(value.products) && value.products.every(isCommercialProduct) &&
  Array.isArray(value.sources) && value.sources.every(isCommercialSource) &&
  Array.isArray(value.excluded) && value.excluded.every((item: unknown) => isRecord(item) &&
    typeof item.identity === "string" && nullableString(item.reference) && isWebUrl(item.sourceUrl) && typeof item.reason === "string");

type EditorialExclusion = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly decision: string;
  readonly reason: string;
  readonly issues: readonly string[];
  readonly evidenceUrls: readonly string[];
};
const isEditorialExclusion = (value: unknown): value is EditorialExclusion =>
  isRecord(value) && typeof value.providerId === "string" && nullableString(value.reference) &&
  isWebUrl(value.sourceUrl) && value.decision === "excluir" && typeof value.reason === "string" && value.reason.length > 0 &&
  Array.isArray(value.issues) && value.issues.every((item: unknown) => typeof item === "string") &&
  Array.isArray(value.evidenceUrls) && value.evidenceUrls.every(isWebUrl);

const identity = (providerId: PanelProviderId, reference: string | null, url: string): string =>
  buildProductIdentity({ providerId, reference, serialNumber: null, url }).key;

const fromOriginal = (item: ProductRecord): PanelProductView => ({
  title: item.title, shortDescription: item.shortDescription,
  generalDescription: item.longDescription, category: item.categoryName,
  price: item.price, image: item.image, images: item.images ?? [], specs: item.specs ?? {}
});
const fromPublication = (item: ImportCandidate): PanelProductView => ({
  title: item.title, shortDescription: item.description,
  generalDescription: item.description_general, category: item.category,
  price: item.price, image: item.image, images: item.images, specs: item.spec
});
const fromCommercial = (item: CommercialDeliveryProduct): PanelCommercialView => ({
  title: item.title, shortDescription: item.description,
  generalDescription: item.description_general, category: item.category,
  price: item.price, image: item.image, images: item.images, specs: item.spec,
  categorySellID: item.categorySellID, attributes: item.attributes
});

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
    const key = identity(evidence.providerId, item.reference, item.url);
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

const renderable = (
  providerId: PanelProviderId, reference: string | null, sourceUrl: string, original: ProductRecord | null,
  published: ImportCandidate | null, commercial: CommercialDeliveryProduct | null, decision: PanelProductDecision | null,
  evidence: PanelProviderEvidence, accreditation: { readonly path: string; readonly sha256: string }
): PanelExplorerProduct => {
  const before = original ? fromOriginal(original) : null;
  const after = published ? fromPublication(published) : null;
  const exported = commercial ? fromCommercial(commercial) : null;
  return {
    identity: identity(providerId, reference, sourceUrl), providerId, reference, sourceUrl,
    stage: !published ? "editorial-excluded" : !commercial ? "commercial-excluded" : "commercial",
    category: exported?.categorySellID === null ? "Sin categoría comercial" :
      exported?.category ?? after?.category ?? before?.category ?? null,
    original: before, published: after, commercial: exported,
    changes: before && after ? compareOriginalToPublished(before, after) : [],
    commercialChanges: after && exported ? comparePublishedToCommercial(after, exported) : [],
    commercialTechnicalChanges: after && exported ? compareTechnicalFields(after.specs, exported.specs, "commercial") : [],
    decision,
    evidence: {
      original: before && evidence.original.status === "verified" ? evidence.original.artifact : null,
      publication: published ? evidence.publication : null,
      commercial: commercial ? evidence.commercial : null,
      accreditation: decision?.stage === "editorial" ? accreditation : null
    }
  };
};

const forProvider = async (
  root: string, evidence: PanelProviderEvidence, commercialRaw: string
): Promise<readonly PanelExplorerProduct[]> => {
  const publishedPath = join(root, evidence.publication.path);
  const published = await readAccreditedPublication(publishedPath);
  if (published.sha256 !== evidence.publication.sha256 || published.providerId !== evidence.providerId) {
    throw new Error(`Publicación modificada durante lectura: ${evidence.providerId}`);
  }
  const plan = verifiedCommercial(commercialRaw, evidence);
  assertCommercialLineage(evidence.providerId, published.products, plan.products, plan.sources, plan.excluded);
  const originals = await mapOriginals(root, evidence);
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
    const key = identity(evidence.providerId, item.reference, item.sourceUrl);
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
    result.push(renderable(evidence.providerId, item.reference, item.sourceUrl, original, item,
      exported.get(key) ?? null, decision, evidence, accreditation.artifact));
  }
  for (const excluded of accreditation.items) {
    const key = identity(evidence.providerId, excluded.reference, excluded.sourceUrl);
    if (found.has(key)) throw new Error(`Exclusión editorial repetida o publicada: ${key}`);
    found.add(key);
    const original = originals?.get(key) ?? null;
    if (originals && (!original || original.url !== excluded.sourceUrl || original.reference !== excluded.reference)) {
      throw new Error(`Exclusión sin original acreditado: ${key}`);
    }
    result.push(renderable(evidence.providerId, excluded.reference, excluded.sourceUrl, original, null, null,
      { stage: "editorial", reason: excluded.reason, issues: excluded.issues, evidenceUrls: excluded.evidenceUrls },
      evidence, accreditation.artifact));
  }
  if (result.length !== evidence.metrics.originals || originals && found.size !== originals.size) {
    throw new Error(`Población del explorador distinta del corte: ${evidence.providerId}`);
  }
  return result;
};

export const selectPresentationCases = (products: readonly PanelExplorerProduct[]): readonly PanelPresentationCase[] => {
  const cases: PanelPresentationCase[] = [];
  const focuses: readonly { providerId: PanelProviderId; focus: PanelPresentationCase["focus"] }[] = [
    { providerId: "gam", focus: "content" },
    { providerId: "gomariz", focus: "technical" },
    { providerId: "mercaeleva", focus: "commercial" }
  ];
  for (const { providerId, focus } of focuses) {
    const ranked = products.filter((item) => item.providerId === providerId && item.stage === "commercial" && item.original !== null)
      .map((item) => ({ item, rank: focus === "commercial" ?
        item.commercialChanges.filter((change) => change.change === "added" || change.change === "changed").length :
        item.changes.filter((change) => change.group === focus && change.change === "changed").length * 2 +
        item.changes.filter((change) => change.group === focus && change.change === "added").length }))
      .filter((item) => item.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.item.identity.localeCompare(b.item.identity));
    const chosen = ranked[0];
    if (chosen) cases.push({ identity: chosen.item.identity, providerId, focus });
  }
  const exclusion = products.filter((item) => item.stage === "editorial-excluded" && item.decision?.stage === "editorial")
    .sort((a, b) => (a.providerId === "gam" ? -1 : 1) - (b.providerId === "gam" ? -1 : 1) ||
      a.identity.localeCompare(b.identity))[0];
  if (exclusion) cases.push({ identity: exclusion.identity, providerId: exclusion.providerId, focus: "exclusion" });
  return cases;
};

export const readPanelExplorer = async (workspace: string, snapshot: PanelSnapshot): Promise<PanelExplorerPayload> => {
  const root = resolve(workspace);
  const stored = await readCommercialFiles(root);
  if (stored.selectedSha256 !== snapshot.commercialManifest.sha256) {
    throw new Error("Corte comercial cambiado durante la lectura del panel");
  }
  const products: PanelExplorerProduct[] = [];
  for (const provider of snapshot.providers) {
    const file = stored.files.find((item) => item.name === `${provider.providerId}-commercial.json`);
    if (!file) throw new Error(`Fichero comercial no disponible: ${provider.providerId}`);
    products.push(...await forProvider(root, provider, file.content));
  }
  if (products.length !== snapshot.totals.originals) throw new Error("Totales del explorador incoherentes");
  return { products, cases: selectPresentationCases(products),
    originalComparisonsAvailable: snapshot.providers.every((provider) => provider.original.status === "verified") };
};
