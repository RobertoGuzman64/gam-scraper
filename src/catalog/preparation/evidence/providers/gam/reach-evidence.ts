import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { gamExplicitHorizontalReach } from "../../../mapping/providers/gam/elevation.js";

export const recoverGamExplicitHorizontalReachSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || record.categoryKey !== "elevacion-nueva" ||
    Object.keys(source).some((key) => /\balcance\b/iu.test(key))) return source;

  const reach = gamExplicitHorizontalReach(record);
  if (reach === null) return source;

  return { ...source, "Alcance horizontal (m)": `${reach.toString().replace(".", ",")} m` };
};
