import type { ImportCandidate } from "../legacy-export/contracts.js";
import { hasConflictingModelVariant } from "./presentation-consistency.js";
import { commercialAttributeYear } from "../validation/year-consistency.js";

export type CommercialOutputConsistencyReason =
  "referencia-titulo-contradictoria" | "modelo-variante-titulo-contradictorio" |
  "modelo-variante-subtitulo-contradictorio" | "motorizacion-titulo-resumen-contradictoria" |
  "ano-titulo-atributo-contradictorio";

export type CommercialOutputConsistencyFinding = {
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: "title" | "description_title" | "description";
  readonly reason: CommercialOutputConsistencyReason;
  readonly evidence: readonly string[];
};

export type CommercialOutputConsistencyAudit = {
  readonly products: number;
  readonly findings: readonly CommercialOutputConsistencyFinding[];
  readonly signals: readonly {
    readonly reason: CommercialOutputConsistencyReason;
    readonly affected: number;
    readonly examples: readonly string[];
  }[];
};

const referenceSuffix = /(?:^|\s)[·|]?\s*Ref\.\s*([\p{L}\p{N}-]+)\s*$/iu;
const explicitYear = /\b(?:a[nñ]o(?: de fabricaci[oó]n)?(?:\s+de|\s*:)?|fabricad[ao]\s+en|de)\s+((?:19|20)\d{2})\b/giu;
const measurementAfterYear = /^\s*(?:kg|mm|cm|m|kw|kva|w|litros?|horas?|t)\b/iu;

const normalizedReference = (value: string): string => value.normalize("NFKC").trim().toUpperCase();

const explicitFuel = (value: string | null): "diesel" | "electrico" | null => {
  if (!value || /\bh[ií]brid[ao]s?\b/iu.test(value)) return null;
  const diesel = /\b(?:di[eé]sel|gas[oó]leo)\b/iu.test(value);
  const electric = /\bel[eé]ctric[ao]s?\b/iu.test(value);
  return diesel === electric ? null : diesel ? "diesel" : "electrico";
};

const manufactureYearsInTitle = (title: string | null): readonly number[] => {
  if (!title) return [];
  const years = new Set<number>();
  for (const match of title.matchAll(explicitYear)) {
    if (!match[1] || match.index === undefined ||
      measurementAfterYear.test(title.slice(match.index + match[0].length))) continue;
    years.add(Number(match[1]));
  }
  return [...years];
};

export const analyzeCommercialOutputConsistency = (
  products: readonly ImportCandidate[]
): CommercialOutputConsistencyAudit => {
  const findings: CommercialOutputConsistencyFinding[] = [];
  const add = (product: ImportCandidate, field: CommercialOutputConsistencyFinding["field"],
    reason: CommercialOutputConsistencyReason, evidence: readonly string[]): void => {
    findings.push({ reference: product.reference, sourceUrl: product.sourceUrl, field, reason, evidence });
  };
  for (const product of products) {
    const title = product.title ?? "";
    const suffix = referenceSuffix.exec(title);
    if (suffix?.[1] && product.reference &&
      normalizedReference(suffix[1]) !== normalizedReference(product.reference)) {
      add(product, "title", "referencia-titulo-contradictoria", [suffix[1], product.reference]);
    }
    if (hasConflictingModelVariant(product)) {
      add(product, "title", "modelo-variante-titulo-contradictorio",
        [title, String(product.spec.Modelo ?? "")]);
    }
    if (product.description_title && product.description_title !== product.title &&
      hasConflictingModelVariant({ ...product, title: product.description_title })) {
      add(product, "description_title", "modelo-variante-subtitulo-contradictorio",
        [product.description_title, String(product.spec.Modelo ?? "")]);
    }
    const titleFuel = explicitFuel(title);
    const summaryFuel = explicitFuel(product.description);
    if (titleFuel && summaryFuel && titleFuel !== summaryFuel) {
      add(product, "description", "motorizacion-titulo-resumen-contradictoria", [titleFuel, summaryFuel]);
    }
    const attributeYear = commercialAttributeYear(product.attributes);
    if (attributeYear !== null) {
      for (const year of manufactureYearsInTitle(title)) {
        if (year !== attributeYear) {
          add(product, "title", "ano-titulo-atributo-contradictorio", [String(year), String(attributeYear)]);
          break;
        }
      }
    }
  }
  const grouped = new Map<CommercialOutputConsistencyReason, { affected: number; examples: string[] }>();
  for (const finding of findings) {
    const group = grouped.get(finding.reason) ?? { affected: 0, examples: [] };
    group.affected += 1;
    if (group.examples.length < 5) group.examples.push(finding.sourceUrl);
    grouped.set(finding.reason, group);
  }
  return { products: products.length, findings,
    signals: [...grouped].map(([reason, value]) => ({ reason, ...value }))
      .sort((a, b) => b.affected - a.affected || a.reason.localeCompare(b.reason, "es")) };
};
