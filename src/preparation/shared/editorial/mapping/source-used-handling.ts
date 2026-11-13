import type { ProductRecord } from "../../../../contracts/catalog.js";
import { gamUrlYear } from "../../../../catalog/normalization/gam/year.js";
import { reconcileCorroboratedUsedHandlingSource } from "../domain/editorial-used-handling-source.js";

export const reconcileUsedHandlingSource = (source: ProductRecord): ProductRecord => {
  const urlYear = source.providerId === "gam" ? gamUrlYear(source.url, source.reference) : null;
  return reconcileCorroboratedUsedHandlingSource(source, urlYear);
};
