import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import { buildProductIdentity } from "../identity.js";
import { findSerialNumberCollisions } from "../quality.js";
import { distinguishDescriptions } from "../../shared/descriptions.js";
import { descriptionImportIssue } from "./import-validation.js";
import { resolveCategory } from "./category-mapping.js";
import { resolveAttributeValue } from "./attribute-mapping.js";

type AttributeType = "NUMBER" | "TEXT" | "SELECT" | "BOOLEAN";
type Category = { readonly id: number; readonly parentId: number | null; readonly name: string; readonly slug: string };
type Attribute = { readonly id: number; readonly name: string; readonly type: AttributeType; readonly required: boolean; readonly unit_option: string };
type Relation = { readonly categoryID: number; readonly attributeID: number };

export type ImportCatalog = {
  readonly categories: readonly Category[];
  readonly attributes: readonly Attribute[];
  readonly relations: readonly Relation[];
};

export type ImportCandidate = {
  readonly providerId: string;
  readonly sourceUrl: string;
  readonly reference: string | null;
  readonly title: string | null;
  readonly categorySellID: number | null;
  readonly category: string | null;
  readonly condition: "Segunda_Mano" | null;
  readonly price: number | null;
  readonly description_title: string | null;
  readonly description: string | null;
  readonly description_general: string | null;
  readonly image: string | null;
  readonly images: readonly string[];
  readonly spec: Readonly<Record<string, SpecValue>>;
  readonly attributes: readonly { readonly attributeID: number; readonly value: string | number | boolean }[];
};

export type PreparedProduct = {
  readonly status: "ready" | "review";
  readonly issues: readonly string[];
  readonly product: ImportCandidate;
};


const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const normalizePrice = (value: string | null): number | null => {
  if (!value) return null;
  const raw = value.replace(/[\s\u00a0\u202f€]/g, "").replace(/EUR$/i, "");
  let normalized: string;
  if (/^\d+$/.test(raw)) normalized = raw;
  else if (/^\d+[.,]\d{1,2}$/.test(raw)) normalized = raw.replace(",", ".");
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) normalized = raw.replace(/[.,]/g, "");
  else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(raw)) normalized = raw.replace(/,/g, "");
  else return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const imageUrls = (record: ProductRecord): readonly string[] => {
  const unique = new Set<string>();
  for (const value of [...(record.images ?? []), ...(record.image ? [record.image] : [])]) {
    try {
      const url = new URL(value);
      if (/^https?:$/.test(url.protocol) && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url.toString())) unique.add(url.toString());
    } catch {
      continue;
    }
  }
  return [...unique];
};

const productAttributes = (record: ProductRecord, category: Category | null, catalog: ImportCatalog): {
  readonly attributes: ImportCandidate["attributes"];
  readonly missingRequired: readonly string[];
} => {
  if (!category) return { attributes: [], missingRequired: [] };
  const activeIds = new Set(catalog.relations.filter((relation) => relation.categoryID === category.id).map((relation) => relation.attributeID));
  const result: { attributeID: number; value: string | number | boolean }[] = [];
  const missing: string[] = [];
  for (const attribute of catalog.attributes.filter((item) => activeIds.has(item.id))) {
    const normalized = resolveAttributeValue(record, attribute);
    if (normalized === null) {
      if (attribute.required) missing.push(attribute.name);
      continue;
    }
    result.push({ attributeID: attribute.id, value: normalized });
  }
  return { attributes: result, missingRequired: missing };
};

export const prepareProduct = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => {
  const issues: string[] = [];
  const category = resolveCategory(record, catalog.categories);
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const categoryOrigin = `${record.url} ${record.categoryKey}`;
  const gamNewSection = record.providerId === "gam" && /nuev[oa]s?/i.test(categoryOrigin);
  const contradictoryCondition = gamNewSection && record.condition === "Segunda mano";
  const isKnownSecondHand = !contradictoryCondition && (record.condition === "Segunda mano" ||
    (record.condition !== "Nuevo" && (record.providerId !== "gam" ||
      /segunda-mano/i.test(categoryOrigin))));
  const condition = isKnownSecondHand ? "Segunda_Mano" : null;
  const reference = record.reference?.trim() || null;
  const title = record.title?.trim() || null;
  const descriptions = distinguishDescriptions(record.shortDescription, record.longDescription);
  const description = descriptions.short;
  const descriptionGeneral = descriptions.long;
  const attributeResult = productAttributes(record, category, catalog);

  if (record.condition === "Nuevo") issues.push("Maquinaria nueva: el contrato de importación actual solo admite Segunda_Mano");
  else if (contradictoryCondition) issues.push("Condición contradictoria con la sección de maquinaria nueva");
  else if (condition === null) issues.push("Condición de segunda mano no confirmada para el contrato de importación");
  if (!reference) issues.push("Referencia ausente");
  if (!title) issues.push("Título ausente");
  if (!category) issues.push("Categoría Equipzilla sin correspondencia inequívoca");
  if (price === null) issues.push("Precio no disponible o inválido");
  const descriptionIssue = descriptionImportIssue(description, descriptionGeneral);
  if (descriptionIssue) issues.push(descriptionIssue);
  if (images.length === 0) issues.push("Imágenes válidas ausentes");
  for (const name of attributeResult.missingRequired) issues.push(`Atributo obligatorio ausente: ${name}`);
  return {
    status: issues.length ? "review" : "ready",
    issues,
    product: {
      providerId: record.providerId,
      sourceUrl: record.url,
      reference,
      title,
      categorySellID: category?.id ?? null,
      category: category?.name ?? null,
      condition,
      price,
      description_title: title,
      description,
      description_general: descriptionGeneral,
      image: images[0] ?? null,
      images,
      spec: record.specs ?? {},
      attributes: attributeResult.attributes
    }
  };
};

export const prepareImportBatch = (products: readonly ProductRecord[], catalog: ImportCatalog): {
  readonly totals: { readonly ready: number; readonly review: number };
  readonly products: readonly PreparedProduct[];
} => {
  const warningsByIdentity = new Map<string, string[]>();
  for (const collision of findSerialNumberCollisions(products)) {
    const references = collision.products.map((product) => product.reference).join(", ");
    const issue = `Número de serie ${collision.serialNumber} compartido por referencias ${references}; revisar identidad de origen`;
    for (const product of collision.products) {
      const key = buildProductIdentity(product).key;
      const issues = warningsByIdentity.get(key) ?? [];
      issues.push(issue);
      warningsByIdentity.set(key, issues);
    }
  }
  const prepared = products.map((product): PreparedProduct => {
    const candidate = prepareProduct(product, catalog);
    const warnings = warningsByIdentity.get(buildProductIdentity(product).key);
    return warnings ? { ...candidate, status: "review", issues: [...candidate.issues, ...warnings] } : candidate;
  });
  return {
    totals: {
      ready: prepared.filter((product) => product.status === "ready").length,
      review: prepared.filter((product) => product.status === "review").length
    },
    products: prepared
  };
};
