import { buildProductIdentity } from "../identity.js";
import { hasTechnicalLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../validation/technical-specifications.js";
import { preparedTechnicalConsistencyIssues } from "../../preparation/shared/technical/source/technical-consistency.js";
import { sourceSemanticQualityIssues } from "../../preparation/shared/quality/source/semantic-quality.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";

export type PublishedTechnicalIssue = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly code: string;
  readonly key: string | null;
  readonly detail: string;
};

export type PublishedTechnicalPattern = {
  readonly providerId: string;
  readonly code: string;
  readonly cases: number;
  readonly products: number;
  readonly action: string;
  readonly priority: "alta" | "media";
  readonly responsible: string;
  readonly examples: readonly string[];
};

export type PublishedTechnicalQuality = {
  readonly note: string;
  readonly totals: { readonly products: number; readonly affectedProducts: number; readonly findings: number };
  readonly patterns: readonly PublishedTechnicalPattern[];
  readonly cases: readonly PublishedTechnicalIssue[];
};

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

const actionFor = (code: string): string => code.startsWith("spec:")
  ? "Verificar la magnitud y su unidad en la fuente técnica; revisar el normalizador solo si el patrón se repite."
  : code === "capacidad-titulo-spec-discordante" || code === "relacion-capacidad"
    ? "Contrastar capacidad nominal, configuración de la unidad y evidencia de fabricante antes de corregir."
    : code === "relacion-alturas" || code === "relacion-dimensiones"
      ? "Distinguir los conceptos de medida y cotejar los valores acreditados; no inferir conversiones."
      : code === "relacion-motorizacion" || code === "relacion-identidad"
        ? "Contrastar identidad y variante con la documentación original antes de ajustar la normalización."
        : "Revisar la discrepancia entre afirmaciones de la ficha y especificaciones acreditadas.";

const priorityFor = (code: string): PublishedTechnicalPattern["priority"] =>
  code === "relacion-identidad" || code === "relacion-motorizacion" ? "alta" : "media";

const responsibleFor = (code: string): string => code.startsWith("spec:")
  ? "evidencia de origen / normalización técnica (por determinar)"
  : code === "capacidad-titulo-spec-discordante" || code === "relacion-capacidad"
    ? "evidencia de la unidad / preparación técnica (por determinar)"
    : "evidencia de origen / preparación técnica (por determinar)";

const classify = (detail: string): string => {
  if (/^Alturas contradictorias/iu.test(detail)) return "relacion-alturas";
  if (/^Motorización contradictoria/iu.test(detail)) return "relacion-motorizacion";
  if (/^Marca contradictoria|^Modelo contradictorio|^Versión contradictoria/iu.test(detail)) return "relacion-identidad";
  if (/^Capacidad contradictoria/iu.test(detail)) return "relacion-capacidad";
  if (/^Familia contradictoria/iu.test(detail)) return "relacion-familia";
  return "relacion-otros";
};

const asPublishedRecord = (product: ImportCandidate): ProductRecord => ({
  providerId: product.providerId,
  categoryKey: product.providerId === "gomariz" && /^\/venta\//u.test(new URL(product.sourceUrl).pathname) ? "venta" : "",
  categoryName: product.category ?? "",
  url: product.sourceUrl,
  reference: product.reference,
  title: product.title,
  shortDescription: product.description,
  longDescription: product.description_general,
  price: product.price === null ? null : String(product.price),
  brand: typeof product.spec.Marca === "string" ? product.spec.Marca : null,
  model: typeof product.spec.Modelo === "string" ? product.spec.Modelo : null,
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: product.image,
  images: product.images,
  specs: product.spec
});

export const analyzePublishedTechnicalQuality = (products: readonly ImportCandidate[]): PublishedTechnicalQuality => {
  const identities = new Set<string>();
  const cases: PublishedTechnicalIssue[] = [];
  for (const product of products) {
    const identity = buildProductIdentity({ providerId: product.providerId, reference: product.reference,
      serialNumber: null, url: product.sourceUrl }).key;
    if (identities.has(identity)) throw new Error(`Identidad duplicada en auditor semántico técnico: ${identity}`);
    identities.add(identity);
    const issued = new Set<string>();
    const add = (code: string, detail: string, key: string | null = null): void => {
      const issueKey = JSON.stringify([code, key]);
      if (issued.has(issueKey)) return;
      issued.add(issueKey);
      cases.push({ identity, providerId: product.providerId, reference: product.reference,
        url: product.sourceUrl, code, key, detail });
    };
    for (const issue of inspectTechnicalSpecifications(product.spec)) {
      add(`spec:${issue.code}`, `Valor técnico incompatible en «${issue.key}»: ${JSON.stringify(product.spec[issue.key])}`, issue.key);
    }
    if (hasTechnicalLoadCapacityDisagreement(product.title, product.spec)) {
      const key = typeof product.spec["Capacidad de carga (kg)"] === "string"
        ? "Capacidad de carga (kg)" : "Capacidad máxima de elevación";
      add("capacidad-titulo-spec-discordante",
        `Título «${product.title}» frente a «${key}»: ${JSON.stringify(product.spec[key])}`, key);
    }
    const record = asPublishedRecord(product);
    for (const detail of preparedTechnicalConsistencyIssues(record, product.spec)) {
      add(classify(detail), detail);
    }
    for (const detail of sourceSemanticQualityIssues(record)) {
      add(classify(detail), detail);
    }
  }
  cases.sort((a, b) => compare(a.providerId, b.providerId) || compare(a.code, b.code) ||
    compare(a.reference ?? a.url, b.reference ?? b.url) || compare(a.key ?? "", b.key ?? ""));
  const grouped = new Map<string, PublishedTechnicalIssue[]>();
  for (const issue of cases) {
    const key = JSON.stringify([issue.providerId, issue.code]);
    const group = grouped.get(key) ?? [];
    group.push(issue);
    grouped.set(key, group);
  }
  const patterns = [...grouped.values()].map((group): PublishedTechnicalPattern => {
    const head = group[0]!;
    return { providerId: head.providerId, code: head.code, cases: group.length,
      products: new Set(group.map((issue) => issue.identity)).size, action: actionFor(head.code),
      priority: priorityFor(head.code), responsible: responsibleFor(head.code),
      examples: [...new Set(group.map((issue) => issue.reference ?? issue.url))].slice(0, 5) };
  }).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "alta" ? -1 : 1) ||
    b.products - a.products || b.cases - a.cases ||
    compare(a.providerId, b.providerId) || compare(a.code, b.code));
  return {
    note: "Anomalías observadas en especificaciones y afirmaciones de publicaciones acreditadas; no modifican datos ni implican por sí solas un defecto probado. Las reglas reutilizadas solo detectan contradicciones expresamente reconocibles; ausencia de avisos no acredita todas las magnitudes.",
    totals: { products: products.length, affectedProducts: new Set(cases.map((issue) => issue.identity)).size,
      findings: cases.length },
    patterns, cases
  };
};
