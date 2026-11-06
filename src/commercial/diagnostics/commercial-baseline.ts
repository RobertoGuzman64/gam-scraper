import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { analyzeCommercialCategories } from "./commercial-categories.js";
import type { CommercialCategoryAudit } from "./commercial-categories.js";
import { decideCommercialCategory } from "../projection/category-decision.js";

export type CommercialBaselineInput = {
  readonly source: ProductRecord;
  readonly published: ImportCandidate;
  readonly mapped: PreparedProduct;
};

export type CommercialBaseline = {
  readonly providerId: string;
  readonly products: number;
  readonly categoryAudit: CommercialCategoryAudit;
  readonly publication: {
    readonly withCategory: number;
    readonly attributes: number;
    readonly withPrice: number;
    readonly withTitle: number;
    readonly withDescription: number;
    readonly withGeneralDescription: number;
    readonly withImage: number;
    readonly specifications: number;
  };
  readonly mapping: {
    readonly withCategory: number;
    readonly withoutCategory: number;
    readonly attributes: number;
    readonly withAttributes: number;
    readonly withPrice: number;
  };
  readonly commercialReferenceCollisions: readonly {
    readonly reference: string;
    readonly identities: readonly string[];
  }[];
  readonly pendingCategoryFamilies: readonly {
    readonly sourceCategory: string;
    readonly affected: number;
    readonly examples: readonly { readonly reference: string | null; readonly sourceUrl: string }[];
  }[];
  readonly attributeCoverage: readonly { readonly attributeID: number; readonly assigned: number }[];
  readonly routeSignals: { readonly lot: number; readonly tool: number };
};

const hasText = (value: string | null): boolean => value !== null && value.trim().length > 0;

export const commercialReference = (product: Pick<ImportCandidate, "providerId" | "reference" | "externalReference">): string | null =>
  product.providerId === "gam" ? product.externalReference?.trim() || null : product.reference?.trim() || null;

export const analyzeCommercialBaseline = (entries: readonly CommercialBaselineInput[]): CommercialBaseline => {
  const providerId = entries[0]?.published.providerId;
  if (!providerId) throw new Error("No hay publicaciones para auditar");
  const seen = new Set<string>();
  const collisionGroups = new Map<string, { reference: string; identities: string[] }>();
  const pending = new Map<string, {
    sourceCategory: string; affected: number;
    examples: { reference: string | null; sourceUrl: string }[];
  }>();
  const attributeCounts = new Map<number, number>();
  let withCategory = 0;
  let withAttributes = 0;
  let withPrice = 0;
  let mappedAttributes = 0;
  let lot = 0;
  let tool = 0;

  for (const { source, published, mapped } of entries) {
    const identity = `${providerId}:${published.reference ?? published.sourceUrl}`;
    if (seen.has(identity)) throw new Error(`Identidad publicada duplicada: ${identity}`);
    seen.add(identity);
    if (source.providerId !== providerId || published.providerId !== providerId ||
      mapped.product.providerId !== providerId || source.reference !== published.reference ||
      mapped.product.reference !== published.reference || source.url !== published.sourceUrl ||
      mapped.product.sourceUrl !== published.sourceUrl) {
      throw new Error(`Origen, publicación o mapeo discordante: ${identity}`);
    }
    const value = commercialReference(published);
    if (value) {
      const key = value.toLocaleUpperCase("es");
      const group = collisionGroups.get(key) ?? { reference: value, identities: [] };
      group.identities.push(identity);
      collisionGroups.set(key, group);
    }
    const path = new URL(published.sourceUrl).pathname.toLowerCase();
    if (path.split("/").includes("lotes")) lot += 1;
    if (path.split("/").some((part) => part === "herramientas" || part === "tools")) tool += 1;
    if (mapped.product.categorySellID !== null) withCategory += 1;
    else if (decideCommercialCategory(source, mapped.product.categorySellID).status === "pending") {
      const sourceCategory = source.categoryKey.trim() || source.categoryName.trim() || "<sin categoría de origen>";
      const group = pending.get(sourceCategory) ?? { sourceCategory, affected: 0, examples: [] };
      group.affected += 1;
      if (group.examples.length < 3) group.examples.push({ reference: source.reference, sourceUrl: source.url });
      pending.set(sourceCategory, group);
    }
    const assigned = mapped.product.attributes;
    mappedAttributes += assigned.length;
    if (assigned.length > 0) withAttributes += 1;
    for (const attr of assigned) attributeCounts.set(attr.attributeID, (attributeCounts.get(attr.attributeID) ?? 0) + 1);
    if (mapped.product.price !== null) withPrice += 1;
  }

  const publications = entries.map(({ published }) => published);
  return {
    providerId,
    products: entries.length,
    categoryAudit: analyzeCommercialCategories(entries),
    publication: {
      withCategory: publications.filter((item) => item.categorySellID !== null).length,
      attributes: publications.reduce((sum, item) => sum + item.attributes.length, 0),
      withPrice: publications.filter((item) => item.price !== null).length,
      withTitle: publications.filter((item) => hasText(item.title)).length,
      withDescription: publications.filter((item) => hasText(item.description)).length,
      withGeneralDescription: publications.filter((item) => hasText(item.description_general)).length,
      withImage: publications.filter((item) => item.images.length > 0).length,
      specifications: publications.reduce((sum, item) => sum + Object.keys(item.spec).length, 0)
    },
    mapping: {
      withCategory, withoutCategory: entries.length - withCategory, attributes: mappedAttributes,
      withAttributes, withPrice
    },
    commercialReferenceCollisions: [...collisionGroups.values()]
      .filter((group) => group.identities.length > 1)
      .map((group) => ({ reference: group.reference, identities: [...group.identities].sort() }))
      .sort((a, b) => a.reference.localeCompare(b.reference, "es")),
    pendingCategoryFamilies: [...pending.values()]
      .sort((a, b) => b.affected - a.affected || a.sourceCategory.localeCompare(b.sourceCategory, "es")),
    attributeCoverage: [...attributeCounts].map(([attributeID, assigned]) => ({ attributeID, assigned }))
      .sort((a, b) => b.assigned - a.assigned || a.attributeID - b.attributeID),
    routeSignals: { lot, tool }
  };
};
