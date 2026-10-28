import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCatalog } from "../../legacy-export/contracts.js";
import { prepareProduct } from "../prepare.js";

export const createCategorySlugResolver = (catalog: ImportCatalog): ((record: ProductRecord) => string | null) =>
  (record: ProductRecord): string | null => {
    const prepared = prepareProduct(record, catalog);
    return catalog.categories.find((category) => category.id === prepared.product.categorySellID)?.slug ?? null;
  };
