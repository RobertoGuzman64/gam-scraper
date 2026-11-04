import { isDeepStrictEqual } from "node:util";
import type { ImportCandidate, ImportCatalog } from "../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "./commercial-baseline.js";
import type { CommercialExportPlan, CommercialExportProduct } from "../commercial/export-projection.js";
import type { BrandLogoReference } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { buildProductIdentity } from "../identity.js";
import { decideCommercialCategory } from "../commercial/category-decision.js";
import { projectCommercialAttributes } from "../commercial/attribute-projection.js";
import { commercialToken, projectCommercialPresentation } from "../commercial/presentation-projection.js";
import { decideCommercialAttributes } from "../commercial/attribute-decision.js";

export type CommercialAccreditationDifference = {
  readonly field: string;
  readonly status: "normalized" | "changed" | "lost";
};

export type CommercialAccreditationDecision = {
  readonly identity: string;
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly status: "excluded" | "categorized" | "pending";
  readonly categorySellID: number | null;
  readonly differences: readonly CommercialAccreditationDifference[];
  readonly blocking: readonly string[];
  readonly pending: readonly string[];
};

export type CommercialAccreditationFinding = {
  readonly reason: string;
  readonly affected: number;
  readonly examples: readonly string[];
};

export type CommercialAccreditationSample = {
  readonly categorySellID: number | null;
  readonly count: number;
  readonly examples: readonly string[];
};

export type CommercialAccreditation = {
  readonly version: 1;
  readonly providerId: string;
  readonly publicationSha256: string;
  readonly summary: {
    readonly originals: number;
    readonly exported: number;
    readonly excluded: number;
    readonly categorized: number;
    readonly pendingCategory: number;
    readonly attributes: number;
    readonly normalizedTitles: number;
    readonly lostFields: number;
    readonly changedFields: number;
    readonly blocking: number;
    readonly pending: number;
  };
  readonly blocking: readonly CommercialAccreditationFinding[];
  readonly pending: readonly CommercialAccreditationFinding[];
  readonly samples: readonly CommercialAccreditationSample[];
  readonly decisions: readonly CommercialAccreditationDecision[];
};

const accumulate = (decisions: readonly CommercialAccreditationDecision[], key: "blocking" | "pending") => {
  const findings = new Map<string, { count: number; examples: string[] }>();
  for (const decision of decisions) {
    for (const reason of decision[key]) {
      const finding = findings.get(reason) ?? { count: 0, examples: [] };
      finding.count += 1;
      if (finding.examples.length < 3) finding.examples.push(decision.sourceUrl);
      findings.set(reason, finding);
    }
  }
  return [...findings].map(([reason, value]) => ({ reason, affected: value.count, examples: value.examples }))
    .sort((a, b) => b.affected - a.affected || a.reason.localeCompare(b.reason, "es"));
};

const sampleCategories = (decisions: readonly CommercialAccreditationDecision[]): CommercialAccreditationSample[] => {
  const grouped = new Map<number | null, string[]>();
  for (const decision of decisions) {
    if (decision.status === "excluded") continue;
    const urls = grouped.get(decision.categorySellID) ?? [];
    urls.push(decision.sourceUrl);
    grouped.set(decision.categorySellID, urls);
  }
  return [...grouped].sort(([a], [b]) => (a ?? -1) - (b ?? -1)).map(([categorySellID, urls]) => {
    urls.sort();
    const indices = [0, Math.floor((urls.length - 1) / 2), urls.length - 1];
    return { categorySellID, count: urls.length,
      examples: [...new Set(indices.map((index) => urls[index]).filter((url): url is string => url !== undefined))] };
  });
};

const preservedFields = ["providerId", "sourceUrl", "reference", "externalReference", "condition", "price",
  "description", "description_general", "image", "images", "spec"] as const;

const verifyProduct = (
  input: CommercialBaselineInput, product: CommercialExportProduct, catalog: ImportCatalog,
  logos: readonly BrandLogoReference[], environment: CommercialExportPlan["environment"], companyID: number | null,
  blocking: string[], pending: string[], differences: CommercialAccreditationDifference[]
): void => {
  const { source, published, mapped } = input;
  for (const field of preservedFields) {
    if (isDeepStrictEqual(product[field], published[field])) continue;
    const status = product[field] === null || product[field] === undefined ? "lost" : "changed";
    differences.push({ field, status });
    blocking.push(`campo-${field}-${status}`);
  }
  if (product.providerId !== source.providerId || product.reference !== source.reference || product.sourceUrl !== source.url) {
    blocking.push("identidad-contra-original");
  }
  const decision = decideCommercialCategory(source, mapped.product.categorySellID);
  if (decision.status === "excluded") blocking.push("producto-excluido-exportado");
  if (product.categorySellID !== decision.categorySellID) blocking.push("categoria-distinta-de-decision");
  const category = catalog.categories.find((item) => item.id === product.categorySellID);
  if (product.categorySellID === null) {
    if (product.category !== null) blocking.push("nombre-categoria-sin-id");
    pending.push("categoria-pendiente");
  } else if (!category || category.active === false ||
    catalog.categories.some((entry) => entry.parentId === product.categorySellID) || category.name !== product.category) {
    blocking.push("categoria-invalida");
  }
  const validated = decideCommercialAttributes(product, catalog);
  if (validated.issues.length || validated.accepted.length !== product.attributes.length) {
    blocking.push("atributos-incompatibles");
  }
  const expectedAttributes = projectCommercialAttributes(published, {
    ...mapped.product, categorySellID: decision.categorySellID
  }, catalog);
  if (!isDeepStrictEqual(product.attributes, expectedAttributes.accepted)) blocking.push("atributos-distintos-de-proyeccion");
  if (expectedAttributes.issues.length) pending.push("atributos-rechazados-por-contrato");
  const expected = projectCommercialPresentation(source, published, category?.name ?? null);
  for (const field of ["title", "description_title"] as const) {
    if (!isDeepStrictEqual(product[field], expected[field])) blocking.push(`presentacion-${field}-incompatible`);
    if (!isDeepStrictEqual(product[field], published[field])) {
      const status = product[field]?.trim() ? "normalized" : "lost";
      differences.push({ field, status });
      if (status === "lost") blocking.push(`campo-${field}-perdido`);
    }
  }
  if (!product.title?.trim()) pending.push("titulo-ausente");
  if (!product.description?.trim()) pending.push("resumen-ausente");
  if (!product.description_general?.trim()) pending.push("descripcion-general-ausente");
  if (!product.image || product.images.length === 0) pending.push("imagen-ausente");
  if (product.image && !product.images.includes(product.image)) blocking.push("portada-fuera-de-galeria");
  if (product.price === null) pending.push("precio-sin-acreditar");
  else if (!Number.isFinite(product.price) || product.price < 0) blocking.push("precio-invalido");
  if (!isDeepStrictEqual(product.metadata, expected.metadata) || product.metadata.featured !== false) {
    blocking.push("metadata-no-determinista");
  }
  for (const values of [product.metadata.tags, product.metadata.keywords]) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value || commercialToken(value) !== value) ||
      new Set(values).size !== values.length) blocking.push("metadata-etiquetas-invalidas");
  }
  if (environment === null ? product.companyID !== undefined : product.companyID !== companyID) {
    blocking.push("companyID-entorno-incoherente");
  }
  if (product.logoID !== null) {
    const matches = logos.filter((logo) => logo.id === product.logoID);
    if (matches.length !== 1 || product.logoID === 18 ||
      commercialToken(matches[0]?.brand ?? "") !== commercialToken(source.brand ?? "")) {
      blocking.push("logoID-sin-correspondencia");
    }
  } else pending.push("logo-sin-acreditar");
};

export const accreditCommercialPlan = (
  inputs: readonly CommercialBaselineInput[], plan: CommercialExportPlan,
  catalog: ImportCatalog, logos: readonly BrandLogoReference[], companyID: number | null
): CommercialAccreditation => {
  const productByIdentity = new Map<string, CommercialExportProduct>();
  const productKey = (value: Pick<ImportCandidate, "providerId" | "reference" | "sourceUrl">): string =>
    JSON.stringify([value.providerId, value.reference, value.sourceUrl]);
  const exclusionByIdentity = new Map(plan.excluded.map((item) => [item.identity, item]));
  const duplicates = new Set<string>();
  for (const product of plan.products) {
    const key = productKey(product);
    if (productByIdentity.has(key)) duplicates.add(key);
    productByIdentity.set(key, product);
  }
  const seen = new Set<string>();
  const decisions: CommercialAccreditationDecision[] = [];
  for (const input of inputs) {
    const { source, published } = input;
    const identity = buildProductIdentity(source).key;
    const blocking: string[] = [];
    const pending: string[] = [];
    const differences: CommercialAccreditationDifference[] = [];
    if (seen.has(identity)) blocking.push("identidad-tecnica-duplicada");
    seen.add(identity);
    if (source.providerId !== plan.providerId || published.providerId !== plan.providerId ||
      source.url !== published.sourceUrl || source.reference !== published.reference) blocking.push("origen-publicacion-discordante");
    const commercialDecision = decideCommercialCategory(source, input.mapped.product.categorySellID);
    const key = productKey(published);
    const product = productByIdentity.get(key);
    const excluded = exclusionByIdentity.get(identity);
    if (commercialDecision.status === "excluded") {
      if (!excluded || excluded.reason !== commercialDecision.reason || product) blocking.push("exclusion-no-corresponde");
    } else if (!product || excluded) {
      blocking.push("producto-elegible-ausente-o-excluido");
    } else {
      verifyProduct(input, product, catalog, logos, plan.environment, companyID, blocking, pending, differences);
    }
    if (duplicates.has(key)) blocking.push("identidad-exportada-duplicada");
    decisions.push({ identity, reference: published.reference, sourceUrl: published.sourceUrl,
      status: commercialDecision.status === "excluded" ? "excluded" :
        commercialDecision.status === "pending" ? "pending" : "categorized",
      categorySellID: commercialDecision.categorySellID,
      differences, blocking: [...new Set(blocking)], pending: [...new Set(pending)] });
  }
  const originalKeys = new Set(inputs.map((input) => productKey(input.published)));
  const unexpected = [...productByIdentity.keys()].filter((key) => !originalKeys.has(key));
  const unexplainedExclusions = [...exclusionByIdentity.keys()].filter((identity) => !seen.has(identity));
  for (const identity of [...unexpected, ...unexplainedExclusions]) decisions.push({ identity, reference: null, sourceUrl: identity,
    status: "pending", categorySellID: null, differences: [], blocking: ["identidad-comercial-sin-origen"], pending: [] });
  if (plan.total !== inputs.length || plan.products.length + plan.excluded.length !== inputs.length ||
    plan.summary.exported !== plan.products.length ||
    plan.summary.categorized + plan.summary.pendingCategory !== plan.products.length ||
    plan.summary.excludedLots + plan.summary.excludedTools !== plan.excluded.length ||
    plan.summary.attributes !== plan.products.reduce((count, product) => count + product.attributes.length, 0) ||
    plan.summary.withLogo !== plan.products.filter((product) => product.logoID !== null).length ||
    plan.summary.withPrice !== plan.products.filter((product) => product.price !== null).length ||
    plan.summary.withCompany !== plan.products.filter((product) => product.companyID !== undefined).length) {
    decisions.push({ identity: `${plan.providerId}:totales`, reference: null, sourceUrl: plan.providerId,
      status: "pending", categorySellID: null, differences: [], blocking: ["totales-incoherentes"], pending: [] });
  }
  const blocking = accumulate(decisions, "blocking");
  const pending = accumulate(decisions, "pending");
  return { version: 1, providerId: plan.providerId, publicationSha256: plan.publicationSha256,
    summary: { originals: inputs.length, exported: plan.products.length, excluded: plan.excluded.length,
      categorized: plan.summary.categorized, pendingCategory: plan.summary.pendingCategory,
      attributes: plan.summary.attributes,
      normalizedTitles: decisions.flatMap((item) => item.differences).filter((item) => item.field === "title" && item.status === "normalized").length,
      lostFields: decisions.flatMap((item) => item.differences).filter((item) => item.status === "lost").length,
      changedFields: decisions.flatMap((item) => item.differences).filter((item) => item.status === "changed").length,
      blocking: blocking.reduce((count, item) => count + item.affected, 0),
      pending: pending.reduce((count, item) => count + item.affected, 0) },
    blocking, pending, samples: sampleCategories(decisions), decisions };
};
