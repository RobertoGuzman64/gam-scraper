import type { ProductRecord } from "../../../../../contracts/catalog.js";

export const mercaelevaUnpublishedHours = (record: ProductRecord): boolean => {
  if (record.providerId !== "mercaeleva") return false;
  const source = record.specs?.["Horas laborales"];
  if (typeof source !== "string" || !/^\s*[-−]\s*1\s*(?:h|horas?)?\s*$/i.test(source)) return false;
  if (record.horometer !== null && record.horometer !== "1") return false;
  return record.specs?.["Horas de uso"] === undefined && record.specs?.["Horas (h)"] === undefined;
};
