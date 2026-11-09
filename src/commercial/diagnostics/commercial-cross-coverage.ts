import { analyzePublishedEditorialQuality } from "../../catalog/diagnostics/editorial-quality.js";
import type { EditorialIssueCode } from "../../catalog/diagnostics/editorial-quality.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import { commercialReference } from "./commercial-baseline.js";
import { analyzePresentationConsistency } from "./presentation-consistency.js";

export type CommercialCrossCoverageFinding = {
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly area: "identidad" | "imagenes" | "editorial";
  readonly reason: string;
  readonly origin: "heredada" | "introducida";
};

export type CommercialCrossCoverageAudit = {
  readonly products: number;
  readonly findings: readonly CommercialCrossCoverageFinding[];
  readonly signals: readonly {
    readonly area: CommercialCrossCoverageFinding["area"];
    readonly reason: string;
    readonly origin: CommercialCrossCoverageFinding["origin"];
    readonly affected: number;
    readonly examples: readonly string[];
  }[];
};

const editorialCodes = new Set<EditorialIssueCode>([
  "corta_igual_titulo", "descripciones_iguales", "general_no_supera_corta",
  "general_repetida_entre_modelos", "general_sin_modelo", "general_telegrafica",
  "general_repeticion_interna"
]);

const normalizedVisibleReference = (value: string): string | null => {
  const normalized = value.normalize("NFKC").toUpperCase().replace(/[\s-]/gu, "");
  return /^[A-Z]{1,6}\d{3,12}$/u.test(normalized) ? normalized : null;
};

export const analyzeCommercialCrossCoverage = (
  published: readonly ImportCandidate[], commercial: readonly ImportCandidate[]
): CommercialCrossCoverageAudit => {
  const originals = new Map<string, ImportCandidate>();
  for (const product of published) {
    if (originals.has(product.sourceUrl)) throw new Error(`Origen técnico duplicado: ${product.sourceUrl}`);
    originals.set(product.sourceUrl, product);
  }
  const covered = commercial.map((product) => {
    const original = originals.get(product.sourceUrl);
    if (!original || original.providerId !== product.providerId || original.reference !== product.reference) {
      throw new Error(`Producto comercial sin identidad técnica correspondiente: ${product.sourceUrl}`);
    }
    return original;
  });
  const findings: CommercialCrossCoverageFinding[] = [];
  const add = (product: ImportCandidate, area: CommercialCrossCoverageFinding["area"],
    reason: string, origin: CommercialCrossCoverageFinding["origin"]): void => {
    findings.push({ reference: product.reference, sourceUrl: product.sourceUrl, area, reason, origin });
  };

  const publishedEditorial = analyzePublishedEditorialQuality(covered.map((product, index) => ({
    ...product, category: commercial[index]?.category ?? null
  })));
  const commercialEditorial = analyzePublishedEditorialQuality(commercial);
  const existingEditorial = new Set(publishedEditorial.cases.flatMap((item) => item.issues
    .filter((issue) => editorialCodes.has(issue.code))
    .map((issue) => `${item.url}\u0000${issue.code}`)));
  const commercialByUrl = new Map(commercial.map((product) => [product.sourceUrl, product]));
  for (const item of commercialEditorial.cases) {
    const product = commercialByUrl.get(item.url);
    if (!product) continue;
    for (const issue of item.issues) {
      if (!editorialCodes.has(issue.code)) continue;
      const original = originals.get(item.url);
      const changed = original !== undefined && (issue.code === "general_repetida_entre_modelos" ||
        issue.code === "general_sin_modelo" || issue.code === "general_telegrafica" ||
        issue.code === "general_repeticion_interna" ?
        original.description_general !== product.description_general :
        original.title !== product.title || original.description !== product.description ||
        original.description_general !== product.description_general);
      const origin = !existingEditorial.has(`${item.url}\u0000${issue.code}`) && changed ?
        "introducida" : "heredada";
      add(product, "editorial", issue.code, origin);
    }
  }

  const originalImages = new Set(analyzePresentationConsistency(covered).findings
    .filter((finding) => finding.code === "imagen-de-otro-modelo")
    .map((finding) => finding.sourceUrl));
  for (const item of analyzePresentationConsistency(commercial).findings) {
    if (item.code !== "imagen-de-otro-modelo") continue;
    const product = commercialByUrl.get(item.sourceUrl);
    if (product) add(product, "imagenes", item.code,
      originalImages.has(item.sourceUrl) ? "heredada" : "introducida");
  }

  const references = new Map<string, { variants: Set<string>; products: ImportCandidate[] }>();
  for (const product of commercial) {
    const visible = commercialReference(product);
    if (!visible) continue;
    const key = normalizedVisibleReference(visible);
    if (!key) continue;
    const groupKey = `${product.providerId}\u0000${key}`;
    const group = references.get(groupKey) ?? { variants: new Set<string>(), products: [] };
    group.variants.add(visible.normalize("NFKC").trim().toUpperCase());
    group.products.push(product);
    references.set(groupKey, group);
  }
  for (const group of references.values()) {
    if (group.variants.size < 2) continue;
    for (const product of group.products) add(product, "identidad", "referencia-visible-formato-ambiguo", "heredada");
  }

  findings.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl, "es") ||
    a.area.localeCompare(b.area, "es") || a.reason.localeCompare(b.reason, "es"));
  const groups = new Map<string, { area: CommercialCrossCoverageFinding["area"]; reason: string;
    origin: CommercialCrossCoverageFinding["origin"]; examples: string[]; affected: number }>();
  for (const finding of findings) {
    const key = `${finding.area}\u0000${finding.reason}\u0000${finding.origin}`;
    const group = groups.get(key) ?? { area: finding.area, reason: finding.reason,
      origin: finding.origin, examples: [], affected: 0 };
    group.affected += 1;
    if (group.examples.length < 5) group.examples.push(finding.sourceUrl);
    groups.set(key, group);
  }
  return { products: commercial.length, findings,
    signals: [...groups.values()].sort((a, b) => a.origin === b.origin ?
      b.affected - a.affected || a.reason.localeCompare(b.reason, "es") :
      a.origin === "introducida" ? -1 : 1) };
};
