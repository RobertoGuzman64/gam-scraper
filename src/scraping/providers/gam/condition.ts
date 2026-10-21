import type { CategoryConfig } from "../../../contracts/scraping.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

export const resolveGamCondition = (category: CategoryConfig, condition: ProductRecord["condition"], providerId: string): ProductRecord["condition"] =>
  providerId !== "gam" ? condition : condition ?? (
    category.key.endsWith("-nueva") || category.key.endsWith("-nuevas") ||
    category.key.endsWith("-nuevos") || category.key === "portaferetros" ||
    category.key.startsWith("limpieza-")
  ? "Nuevo" : null);
