import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { CommercialMetadata } from "./presentation-projection.js";
import type { CommercialBaselineInput } from "../diagnostics/commercial-baseline.js";
import type { BrandLogoReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { buildProductIdentity } from "../../catalog/identity.js";
import { decideCommercialCategory } from "./category-decision.js";
import { isValidCommercialCategory } from "./category-projection.js";
import { projectCommercialAttributes } from "./attribute-projection.js";
import { commercialBrandInTitle, commercialToken, projectCommercialPresentation } from "./presentation-projection.js";
import { commercialUnitTitleSuffixes, unresolvedCommercialTitleCollisions } from "./unit-disambiguation.js";
import { hasLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../validation/technical-specifications.js";
import { assessCommercialHeight } from "../validation/height-consistency.js";
import { assessCommercialYear } from "../validation/year-consistency.js";

export type CommercialExportProduct = ImportCandidate & {
  readonly logoID: number | null;
  readonly companyID?: number;
  readonly metadata: CommercialMetadata;
};

export type CommercialExportIssue = {
  readonly identity: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly reason: string;
};

export type CommercialExportPlan = {
  readonly version: 1;
  readonly providerId: string;
  readonly publicationSha256: string;
  readonly environment: "develop" | "production" | null;
  readonly total: number;
  readonly products: readonly CommercialExportProduct[];
  readonly excluded: readonly CommercialExportIssue[];
  readonly exceptions: readonly CommercialExportIssue[];
  readonly summary: {
    readonly exported: number;
    readonly categorized: number;
    readonly pendingCategory: number;
    readonly excludedLots: number;
    readonly excludedTools: number;
    readonly excludedAccessories: number;
    readonly attributes: number;
    readonly withLogo: number;
    readonly withPrice: number;
    readonly withCompany: number;
  };
};

export const resolveCommercialLogo = (
  source: CommercialBaselineInput["source"], published: ImportCandidate,
  logos: readonly BrandLogoReference[]
): number | null => {
  const brand = source.brand?.trim();
  const fallback = logos.find((entry) => entry.id === 18 && commercialToken(entry.brand) === "otras-marcas");
  if (!fallback) throw new Error("Falta la referencia acreditada de Otras Marcas");
  if (!brand || (!commercialBrandInTitle(published.title, brand) &&
    (typeof published.spec["Marca"] !== "string" || commercialToken(published.spec["Marca"]) !== commercialToken(brand)))) {
    return fallback.id;
  }
  const matches = logos.filter((entry) => entry.id !== fallback.id && commercialToken(entry.brand) === commercialToken(brand));
  return matches.length === 1 ? matches[0]?.id ?? fallback.id : fallback.id;
};

export const planCommercialExport = (
  inputs: readonly CommercialBaselineInput[], providerId: string, publicationSha256: string,
  catalog: ImportCatalog, logos: readonly BrandLogoReference[],
  environment: "develop" | "production" | null, companyID: number | null
): CommercialExportPlan => {
  if (environment === null ? companyID !== null : !Number.isSafeInteger(companyID) || (companyID ?? 0) <= 0) {
    throw new Error("El companyID exige un perfil de entorno explícito y válido");
  }
  const categories = new Map(catalog.categories.map((item) => [item.id, item]));
  const titleSuffixes = commercialUnitTitleSuffixes(inputs);
  const identitiesByUrl = new Map<string, string>();
  const seen = new Set<string>();
  const products: CommercialExportProduct[] = [];
  const excluded: CommercialExportIssue[] = [];
  const exceptions: CommercialExportIssue[] = [];
  let categorized = 0;
  let pendingCategory = 0;
  let excludedLots = 0;
  let excludedTools = 0;
  let excludedAccessories = 0;
  let withLogo = 0;
  let withPrice = 0;
  let attributes = 0;
  for (const { source, published, mapped } of inputs) {
    if (source.providerId !== providerId || published.providerId !== providerId || mapped.product.providerId !== providerId ||
      source.reference !== published.reference || source.url !== published.sourceUrl ||
      mapped.product.reference !== published.reference || mapped.product.sourceUrl !== published.sourceUrl) {
      throw new Error(`Identidad técnica discordante: ${published.sourceUrl}`);
    }
    const identity = buildProductIdentity(source).key;
    if (seen.has(identity)) throw new Error(`Identidad comercial duplicada: ${identity}`);
    seen.add(identity);
    identitiesByUrl.set(source.url, identity);
    const issue = (reason: string): CommercialExportIssue => ({ identity, reference: published.reference,
      sourceUrl: published.sourceUrl, reason });
    const decision = decideCommercialCategory(source, mapped.product.categorySellID);
    if (decision.status === "excluded") {
      excluded.push(issue(decision.reason));
      if (decision.reason === "lote") excludedLots += 1;
      else if (decision.reason === "herramienta") excludedTools += 1;
      else excludedAccessories += 1;
      continue;
    }
    const category = decision.categorySellID === null ? null : categories.get(decision.categorySellID);
    if (decision.status === "proposed" && !isValidCommercialCategory(source, decision.categorySellID, mapped.product.condition, catalog)) {
      throw new Error(`Categoría comercial no válida para ${identity}: ${decision.categorySellID}`);
    }
    if (decision.status === "pending") {
      pendingCategory += 1;
      exceptions.push(issue("sin-categoria"));
    } else {
      categorized += 1;
    }
    const accepted = projectCommercialAttributes(published, {
      ...mapped.product, categorySellID: decision.categorySellID
    }, catalog);
    for (const invalid of accepted.issues) exceptions.push(issue(`atributo-${invalid.attributeID}:${invalid.reason}`));
    const presentation = projectCommercialPresentation(source, published, category?.name ?? null,
      titleSuffixes.get(published.sourceUrl) ?? "");
    for (const invalid of inspectTechnicalSpecifications(published.spec)) {
      exceptions.push(issue(`spec-${invalid.code}:${invalid.key}`));
    }
    if (hasLoadCapacityDisagreement(presentation)) exceptions.push(issue("capacidad-titulo-spec-discordante"));
    const height = assessCommercialHeight(presentation);
    if (height.status === "possible-distinct-heights") exceptions.push(issue("alturas-concepto-distinto-por-acreditar"));
    if (height.status === "unresolved") exceptions.push(issue("altura-titulo-resumen-discordante"));
    const year = assessCommercialYear({ ...published, ...presentation, attributes: accepted.accepted });
    if (year.inconsistentClaims.length > 0) exceptions.push(issue("ano-descripcion-atributo-discordante"));
    if (year.urlAttributeDisagreement) exceptions.push(issue("ano-url-atributo-discordante"));
    const logoID = resolveCommercialLogo(source, published, logos);
    if (logoID !== null) withLogo += 1;
    if (published.price !== null) withPrice += 1;
    if (!presentation.title) exceptions.push(issue("titulo-ausente"));
    if (!presentation.description?.trim()) exceptions.push(issue("resumen-ausente"));
    if (!presentation.description_general?.trim()) exceptions.push(issue("descripcion-general-ausente"));
    if (!presentation.image || presentation.images.length === 0) exceptions.push(issue("imagen-ausente"));
    if (presentation.image && !presentation.images.includes(presentation.image)) {
      exceptions.push(issue("imagen-principal-fuera-de-galeria"));
    }
    attributes += accepted.accepted.length;
    products.push({ ...published, ...presentation, categorySellID: decision.categorySellID,
      category: category?.name ?? null, attributes: accepted.accepted, logoID,
      ...(companyID === null ? {} : { companyID }) });
  }
  const unresolvedTitles = unresolvedCommercialTitleCollisions(products);
  for (const product of products) {
    if (unresolvedTitles.has(product.sourceUrl)) {
      exceptions.push({ identity: identitiesByUrl.get(product.sourceUrl) ?? product.sourceUrl,
        reference: product.reference, sourceUrl: product.sourceUrl, reason: "titulo-unidad-no-diferenciada" });
    }
  }
  if (seen.size !== inputs.length || products.length + excluded.length !== inputs.length ||
    categorized + pendingCategory !== products.length) throw new Error("La derivación comercial ha perdido identidades");
  return { version: 1, providerId, publicationSha256, environment, total: inputs.length, products,
    excluded, exceptions, summary: { exported: products.length, categorized, pendingCategory,
      excludedLots, excludedTools, excludedAccessories, attributes, withLogo, withPrice,
      withCompany: companyID === null ? 0 : products.length } };
};
