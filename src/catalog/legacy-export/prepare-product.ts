import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCatalog } from "./contracts.js";
import type { PreparedProduct } from "../preparation/contracts.js";
import { prepareWithCatalog } from "../preparation/prepare-product.js";

export const prepareProduct = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => prepareWithCatalog(record, catalog);
