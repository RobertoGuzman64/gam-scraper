import type { ImportCandidate } from "../legacy-export/contracts.js";
import { hasLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../validation/technical-specifications.js";

export type PresentationConsistencyFinding = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly field: "images" | "spec" | "description" | "title";
  readonly code: "imagen-de-otro-modelo" | "portada-referencia-ajena" | "portada-prefijo-distinto" |
    "modelo-titulo-spec-discordante" | "modelo-portada-variante-discordante" | "unidad-tecnica-malformada" | "magnitud-en-campo-incompatible" |
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

export const hasConflictingModelVariant = (product: Pick<ImportCandidate, "providerId" | "title" | "spec">): boolean => {
  if (product.providerId !== "gam" || !product.title) return false;
  const title = variant(product.title);
  const spec = variant(String(product.spec.Modelo ?? ""));
  return title !== null && spec !== null && title[0] === spec[0] && title[1] !== spec[1];
};

const filename = (image: string | null): string => {
  const path = image?.split(/[?#]/u, 1)[0] ?? "";
  return path.slice(path.lastIndexOf("/") + 1);
};

const imageReference = (image: string | null): string | null => {
  const match = /^([a-z]{1,5}\d{3,8})[-_]/iu.exec(filename(image));
  return match?.[1]?.toUpperCase() ?? null;
};

const modelTokens = (value: string): readonly string[] =>
  (value.toUpperCase().match(/[A-Z0-9]{6,}/gu) ?? [])
    .filter((token) => /[A-Z]/u.test(token) && /\d/u.test(token));

const relatedVariants = (first: string, second: string): boolean => {
  if (first === second) return false;
  if (first.length >= 7 && first.length === second.length && first.slice(0, -1) === second.slice(0, -1) &&
    /[A-Z]$/u.test(first) && /[A-Z]$/u.test(second)) return true;
  const shorter = first.length < second.length ? first : second;
  const longer = first.length < second.length ? second : first;
  return shorter.length >= 6 && longer.length === shorter.length + 1 && longer.startsWith(shorter) &&
    /[A-Z]$/u.test(longer);
};

const imageVariantDisagreements = (product: ImportCandidate): readonly PresentationConsistencyFinding["code"][] => {
  const titleTokens = modelTokens(product.title ?? "");
  const filenameTokens = modelTokens(filename(product.image));
  if (titleTokens.length === 0 || filenameTokens.length === 0) return [];
  const specTokens = typeof product.spec.Modelo === "string" ? modelTokens(product.spec.Modelo) : [];
  const issues: PresentationConsistencyFinding["code"][] = [];
  if (specTokens.some((model) => titleTokens.some((token) =>
    relatedVariants(model, token) && filenameTokens.includes(token)))) {
    issues.push("modelo-titulo-spec-discordante");
  }
  if (titleTokens.some((title) => filenameTokens.some((token) =>
    title.length >= 7 && title.length === token.length && title.slice(0, -1) === token.slice(0, -1) &&
    /[A-Z]$/u.test(title) && /[A-Z]$/u.test(token) && title !== token))) {
    issues.push("modelo-portada-variante-discordante");
  }
  return issues;
};

const ownerModelIsUnresolved = (owner: ImportCandidate, product: ImportCandidate): boolean => {
  const model = product.spec.Modelo;
  return typeof model === "string" &&
    imageVariantDisagreements(owner).includes("modelo-titulo-spec-discordante") &&
    modelTokens(owner.title ?? "").some((token) => normalized(token) === normalized(model));
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
    if (product.providerId === "gomariz" && product.reference) {
      const fileRef = imageReference(product.image);
      const machineRef = product.reference.toUpperCase();
      const fileMatch = fileRef?.match(/^([A-Z]{1,5})(\d{3,8})$/u);
      const machineMatch = machineRef.match(/^([A-Z]{1,5})(\d{3,8})$/u);
      if (fileMatch && machineMatch && fileRef !== machineRef) {
        add(product, "images", fileMatch[2] === machineMatch[2] ?
          "portada-prefijo-distinto" : "portada-referencia-ajena", "revisar");
      }
    }
    for (const code of imageVariantDisagreements(product)) {
      add(product, code === "modelo-titulo-spec-discordante" ? "title" : "images", code, "revisar");
    }
    for (const image of new Set(product.images.slice(1))) {
      const owners = imagesByOwner.get(image) ?? [];
      if (!owners.some((owner) => owner.providerId === product.providerId &&
        owner.sourceUrl !== product.sourceUrl && owner.spec.Marca !== undefined &&
        normalized(String(owner.spec.Marca)) === normalized(String(product.spec.Marca ?? "")) &&
        owner.spec.Modelo !== undefined && product.spec.Modelo !== undefined &&
        normalized(String(owner.spec.Modelo)) !== normalized(String(product.spec.Modelo)) &&
        !ownerModelIsUnresolved(owner, product))) continue;
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
    if (hasConflictingModelVariant(product)) add(product, "title", "modelo-de-variante-contradictorio", "revisar");
    if (lacksCapacityContext(product)) add(product, "spec", "capacidad-no-cualificada-en-campo", "revisar");
  }
  return { products: products.length,
    defects: findings.filter((finding) => finding.status === "defecto").length,
    reviews: findings.filter((finding) => finding.status === "revisar").length,
    findings };
};
