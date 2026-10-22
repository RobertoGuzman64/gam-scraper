import type { ProductRecord } from "../../../contracts/catalog.js";
import { distinguishDescriptions } from "../../normalization/descriptions.js";
import { descriptionImportIssue } from "./import-validation.js";
import { resolveCategory } from "../mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { productAttributes } from "./product-attributes.js";
import { resolveCommercialCondition } from "./condition.js";
import { mercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";
import type { ImportCatalog, PreparedProduct } from "./contracts.js";

export const prepareProduct = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => {
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = resolveCategory(record, catalog.categories, condition);
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const title = record.title?.trim() || null;
  const descriptions = distinguishDescriptions(record.shortDescription ?? mercaelevaShortDescription(record), record.longDescription);
  const description = descriptions.short;
  const descriptionGeneral = descriptions.long;
  const attributeResult = productAttributes(record, category, catalog);

  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  else if (condition === null) issues.push("Condición comercial no confirmada (Nuevo o Segunda_Mano)");
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

