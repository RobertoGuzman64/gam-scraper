import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";

export const verifiedEditorialUnitPair = (source: ProductRecord, prepared: ProductRecord): boolean =>
  sameEditorialUnit(source, prepared) &&
  resolveEditorialSource(source) !== null && resolveEditorialSource(prepared) !== null;
