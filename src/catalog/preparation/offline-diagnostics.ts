import type { PreparedProduct } from "./contracts.js";
import type { OfflinePreparation } from "./offline-document.js";
import { buildImportDiagnostics } from "../legacy-export/import-diagnostics.js";
import type { ImportDiagnostics } from "../legacy-export/import-diagnostics.js";

export type IssueCategory = "contrato_excel" | "dato_presente_no_mapeado" | "ambiguo" | "dato_no_observado" | "origen_por_contrastar" | "identidad" | "no_determinado" | "contradiccion" | "rechazo_seguridad" | "no_normalizable";
export type IssueDetail = {
  readonly code: string;
  readonly message: string;
  readonly classification: IssueCategory;
  readonly affected: number;
  readonly only: number;
  readonly examples: readonly string[];
};

export const classifyQualityIssue = (issue: string): { code: string; classification: IssueCategory } => {
  if (issue.startsWith("Atributo contradictorio: ")) return { code: `quality.attribute_contradiction:${issue.slice("Atributo contradictorio: ".length)}`, classification: "contradiccion" };
  if (issue.startsWith("Atributo rechazado por seguridad: ")) return { code: `quality.attribute_rejected:${issue.slice("Atributo rechazado por seguridad: ".length)}`, classification: "rechazo_seguridad" };
  if (issue.startsWith("Atributo no normalizable: ")) return { code: `quality.attribute_invalid:${issue.slice("Atributo no normalizable: ".length)}`, classification: "no_normalizable" };
  if (issue.startsWith("Atributo obligatorio ausente: ")) {
    return { code: `excel.required_attribute:${issue.slice("Atributo obligatorio ausente: ".length)}`, classification: "origen_por_contrastar" };
  }
  if (issue === "Identidad GAM contradictoria entre título, resumen y ficha técnica") return { code: "identity.gam_source_conflict", classification: "identidad" };
  if (issue.startsWith("Número de serie ")) return { code: "identity.serial_collision", classification: "identidad" };
  if (issue.startsWith("Referencia duplicada ")) return { code: "identity.duplicate_reference", classification: "identidad" };
  if (issue === "Descripción comercial contradictoria: altura de trabajo") return { code: "description.height_conflict", classification: "contradiccion" };
  if (issue.startsWith("Condición comercial contradictoria")) return { code: "condition.contradictory", classification: "contradiccion" };
  if (issue.startsWith("Condición comercial no confirmada")) return { code: "condition.unknown", classification: "origen_por_contrastar" };
  if (issue === "Tipo de máquina de origen sin confirmar") return { code: "quality.source_category_unconfirmed", classification: "origen_por_contrastar" };
  if (issue.startsWith("Categoría Equipzilla")) return { code: "mapping.category", classification: "dato_presente_no_mapeado" };
  if (issue === "Precio publicado inválido") return { code: "source.price_invalid", classification: "ambiguo" };
  if (issue.startsWith("Precio ")) return { code: "excel.price", classification: "contrato_excel" };
  if (issue.startsWith("Descripción ")) return { code: "excel.description", classification: "contrato_excel" };
  if (issue.startsWith("Imágenes ")) return { code: "excel.images", classification: "contrato_excel" };
  if (issue === "Referencia ausente") return { code: "source.reference_not_observed", classification: "dato_no_observado" };
  if (issue === "Título ausente") return { code: "source.title_not_observed", classification: "dato_no_observado" };
  return { code: `unclassified:${issue}`, classification: "no_determinado" };
};

export const issueCode = (issue: string): string => classifyQualityIssue(issue).code;

export type OfflineDiagnostics = {
  readonly version: 1;
  readonly providerId: string;
  readonly source: OfflinePreparation["source"];
  readonly fingerprints: OfflinePreparation["fingerprints"];
  readonly totals: OfflinePreparation["totals"] & {
    readonly products: number;
    readonly incidences: number;
    readonly reviewSingle: number;
    readonly reviewMultiple: number;
  };
  readonly conditions: Readonly<Record<"Nuevo" | "Segunda_Mano" | "Sin confirmar", { readonly ready: number; readonly review: number }>>;
  readonly issues: readonly IssueDetail[];
  readonly importation: ImportDiagnostics | null;
};

export const buildOfflineDiagnostics = (preparation: OfflinePreparation): OfflineDiagnostics => {
  const conditions = {
    Nuevo: { ready: 0, review: 0 }, Segunda_Mano: { ready: 0, review: 0 },
    "Sin confirmar": { ready: 0, review: 0 }
  };
  const groups = new Map<string, { message: string; classification: IssueCategory; affected: number; only: number; examples: string[] }>();
  let incidences = 0;
  let reviewSingle = 0;
  let reviewMultiple = 0;
  for (const entry of preparation.products) {
    const condition = entry.product.condition ?? "Sin confirmar";
    conditions[condition][entry.status] += 1;
    if (entry.status === "ready") continue;
    const reasons = [...new Set(entry.issues)];
    incidences += reasons.length;
    if (reasons.length === 1) reviewSingle += 1;
    else reviewMultiple += 1;
    const codes = new Set<string>();
    for (const reason of reasons) {
      const { code, classification } = classifyQualityIssue(reason);
      if (codes.has(code)) continue;
      codes.add(code);
      const current = groups.get(code) ?? { message: reason, classification, affected: 0, only: 0, examples: [] };
      current.affected += 1;
      if (reasons.length === 1) current.only += 1;
      if (current.examples.length < 3) current.examples.push(entry.product.reference ?? entry.product.sourceUrl);
      groups.set(code, current);
    }
  }
  return {
    version: 1, providerId: preparation.source.providerId, source: preparation.source,
    fingerprints: preparation.fingerprints,
    totals: { ...preparation.totals, products: preparation.products.length, incidences, reviewSingle, reviewMultiple },
    conditions, importation: preparation.fingerprints.rulesVersion === 2 ? null : buildImportDiagnostics(preparation.products),
    issues: [...groups].map(([code, item]) => ({ code, ...item })).sort((a, b) => b.affected - a.affected || a.code.localeCompare(b.code, "es"))
  };
};

export type PreparationComparison = {
  readonly comparable: boolean;
  readonly reason: string | null;
  readonly previousFingerprints: OfflinePreparation["fingerprints"];
  readonly rulesChanged: boolean;
  readonly snapshotsChanged: boolean;
  readonly reviewToReady: readonly string[];
  readonly readyToReview: readonly string[];
  readonly categoryChanged: readonly string[];
  readonly attributesChanged: readonly string[];
  readonly issuesResolved: Readonly<Record<string, number>>;
  readonly issuesAdded: Readonly<Record<string, number>>;
};

const emptyChanges = {
  reviewToReady: [], readyToReview: [], categoryChanged: [], attributesChanged: [], issuesResolved: {}, issuesAdded: {}
} as const;

export const compareOfflinePreparations = (current: OfflinePreparation, previous: OfflinePreparation): PreparationComparison => {
  const rulesChanged = current.fingerprints.rulesSha256 !== previous.fingerprints.rulesSha256 ||
    current.fingerprints.rulesVersion !== previous.fingerprints.rulesVersion;
  const snapshotsChanged = current.fingerprints.rulesVersion !== previous.fingerprints.rulesVersion ||
    current.fingerprints.rulesVersion === 1 && previous.fingerprints.rulesVersion === 1 && (
      current.fingerprints.categorySnapshotSha256 !== previous.fingerprints.categorySnapshotSha256 ||
      current.fingerprints.attributeSnapshotSha256 !== previous.fingerprints.attributeSnapshotSha256);
  const common = { previousFingerprints: previous.fingerprints, rulesChanged, snapshotsChanged };
  if (current.source.providerId !== previous.source.providerId ||
    current.source.catalogSha256 !== previous.source.catalogSha256 ||
    current.source.productCount !== previous.source.productCount ||
    current.source.prefix !== previous.source.prefix || current.source.scope !== previous.source.scope ||
    new Set([...current.identities, ...previous.identities]).size !== current.identities.length) {
    return { comparable: false, reason: "Origen o cohorte distintos: no se calculan mejoras ni pérdidas", ...common, ...emptyChanges };
  }
  const previousByIdentity = new Map<string, PreparedProduct>(previous.identities.map((identity, index) => [identity, previous.products[index]!]));
  const reviewToReady: string[] = [];
  const readyToReview: string[] = [];
  const categoryChanged: string[] = [];
  const attributesChanged: string[] = [];
  const issuesResolved: Record<string, number> = {};
  const issuesAdded: Record<string, number> = {};
  for (let i = 0; i < current.identities.length; i += 1) {
    const identity = current.identities[i]!;
    const currentProduct = current.products[i]!;
    const previousProduct = previousByIdentity.get(identity)!;
    if (previousProduct.status === "review" && currentProduct.status === "ready") reviewToReady.push(identity);
    if (previousProduct.status === "ready" && currentProduct.status === "review") readyToReview.push(identity);
    if (previousProduct.product.categorySellID !== currentProduct.product.categorySellID) categoryChanged.push(identity);
    const asAttributes = (item: PreparedProduct): string => JSON.stringify([...item.product.attributes].sort((a, b) => a.attributeID - b.attributeID));
    if (asAttributes(previousProduct) !== asAttributes(currentProduct)) attributesChanged.push(identity);
    const before = new Set(previousProduct.issues.map(issueCode));
    const after = new Set(currentProduct.issues.map(issueCode));
    for (const code of before) if (!after.has(code)) issuesResolved[code] = (issuesResolved[code] ?? 0) + 1;
    for (const code of after) if (!before.has(code)) issuesAdded[code] = (issuesAdded[code] ?? 0) + 1;
  }
  return { comparable: true, reason: null, ...common, reviewToReady, readyToReview,
    categoryChanged, attributesChanged, issuesResolved, issuesAdded };
};
