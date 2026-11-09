import type { ImportCandidate } from "../legacy-export/contracts.js";
import { hasLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../validation/technical-specifications.js";

export type PresentationConsistencyFinding = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: "images" | "spec" | "description" | "title";
  readonly code: "imagen-de-otro-modelo" | "unidad-tecnica-malformada" | "magnitud-en-campo-incompatible" |
    "altura-editorial-malformada" | "modelo-de-variante-contradictorio" | "capacidad-no-cualificada-en-campo" |
    "residuo-hoja-calculo" | "longitud-fisicamente-implausible" | "capacidad-titulo-spec-discordante";
  readonly status: "defecto" | "revisar";
};

export type PresentationConsistencyAudit = {
  readonly products: number;
  readonly defects: number;
  readonly reviews: number;
  readonly findings: readonly PresentationConsistencyFinding[];
};

const normalized = (value: string): string => value.normalize("NFKD").toLowerCase()
  .replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]/gu, "");

const variant = (value: string): readonly [string, string] | null => {
  const match = /\bB[ -]?LIFT[ -]?(\d{2,3})\s*(HD|HV)\b/iu.exec(value);
  return match ? [match[1] ?? "", match[2]?.toUpperCase() ?? ""] : null;
};

const conflictingModel = (product: ImportCandidate): boolean => {
  if (product.providerId !== "gam" || !product.title) return false;
  const title = variant(product.title);
  const spec = variant(String(product.spec.Modelo ?? ""));
  return title !== null && spec !== null && title[0] === spec[0] && title[1] !== spec[1];
};

const lacksCapacityContext = (product: ImportCandidate): boolean => {
  const capacity = String(product.spec["Capacidad de carga (kg)"] ?? "");
  const description = `${product.description ?? ""} ${product.description_general ?? ""}`;
  const matches = /\b(\d{2,4})\s*kg\s+con\s+limitaci[oó]n\b/iu.exec(description);
  return matches !== null && normalized(capacity) === normalized(`${matches[1]} kg`);
};

export const analyzePresentationConsistency = (
  products: readonly ImportCandidate[]
): PresentationConsistencyAudit => {
  const imagesByOwner = new Map<string, ImportCandidate[]>();
  for (const product of products) {
    if (!product.image || product.image !== product.images[0]) continue;
    const owners = imagesByOwner.get(product.image) ?? [];
    owners.push(product);
    imagesByOwner.set(product.image, owners);
  }
  const findings: PresentationConsistencyFinding[] = [];
  const add = (product: ImportCandidate, field: PresentationConsistencyFinding["field"],
    code: PresentationConsistencyFinding["code"], status: PresentationConsistencyFinding["status"]): void => {
    findings.push({ providerId: product.providerId, reference: product.reference,
      sourceUrl: product.sourceUrl, field, code, status });
  };
  for (const product of products) {
    for (const image of new Set(product.images.slice(1))) {
      const owners = imagesByOwner.get(image) ?? [];
      if (!owners.some((owner) => owner.providerId === product.providerId &&
        owner.sourceUrl !== product.sourceUrl && owner.spec.Marca !== undefined &&
        normalized(String(owner.spec.Marca)) === normalized(String(product.spec.Marca ?? "")) &&
        owner.spec.Modelo !== undefined && product.spec.Modelo !== undefined &&
        normalized(String(owner.spec.Modelo)) !== normalized(String(product.spec.Modelo)))) continue;
      add(product, "images", "imagen-de-otro-modelo", "revisar");
      break;
    }
    for (const code of new Set(inspectTechnicalSpecifications(product.spec).map((issue) => issue.code))) {
      add(product, "spec", code, "defecto");
    }
    if (hasLoadCapacityDisagreement(product)) add(product, "spec", "capacidad-titulo-spec-discordante", "revisar");
    if (/\b4[.,]30\s*mm\b/iu.test(`${product.description ?? ""} ${product.description_general ?? ""}`)) {
      add(product, "description", "altura-editorial-malformada", "defecto");
    }
    if (conflictingModel(product)) add(product, "title", "modelo-de-variante-contradictorio", "revisar");
    if (lacksCapacityContext(product)) add(product, "spec", "capacidad-no-cualificada-en-campo", "revisar");
  }
  return { products: products.length,
    defects: findings.filter((finding) => finding.status === "defecto").length,
    reviews: findings.filter((finding) => finding.status === "revisar").length,
    findings };
};
