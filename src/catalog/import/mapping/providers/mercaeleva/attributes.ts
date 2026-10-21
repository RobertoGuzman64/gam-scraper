import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold, scalar } from "../../attribute-utils.js";

export const applyMercaelevaAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): boolean => {
  const title = String(record.specs?.["Título adicional"] ?? record.title ?? "");
  const family = fold(title);
  const isForklift = /\bcarretilla\b/.test(family);
  const isStacker = /\bapilador\b/.test(family);
  const isPalletTruck = /\btranspalet(?:a)?\b/.test(family);
  const isTelehandler = /\bmanipulador telescopico\b/.test(family);
  const maxLoad = record.specs?.["Capacidad máxima de elevación"];
  const hasExplicitLoad = typeof maxLoad === "string" && /\bkg\s*$/i.test(maxLoad.trim());
  if (attribute.name === "Capacidad máxima" && isTelehandler && hasExplicitLoad) {
    keys.add(fold("Capacidad máxima de elevación"));
  }
  if (attribute.name === "Altura de elevación" && (isForklift || isStacker)) {
    keys.add(fold("Altura máxima de elevación"));
  }
  if (attribute.name === "Capacidad de carga" && (isForklift || isStacker || isPalletTruck)) {
    if (hasExplicitLoad) keys.add(fold("Capacidad máxima de elevación"));
    const load = title.match(/\b(\d{3,5}|\d{1,2}[.,]\d{3})\s*kg\b/i)?.[1];
    if (load) candidates.push({ key: "Capacidad de carga (kg)", value: `${load} kg` });
  }
  if (attribute.name === "Longitud de horquillas") keys.add(fold("Longitud de tenedor"));
  if (attribute.name === "Tipo de mástil" && isForklift) {
    const rawMast = record.specs?.["Tipo de mástil"];
    const published = rawMast === undefined ? null : scalar(rawMast);
    const description = fold(record.longDescription ?? "");
    const inDescription = description.match(/\bmastil\s+(triplex|duplex|simplex)\b/)?.[1];
    if (published !== null && inDescription) {
      const publishedType = fold(String(published));
      const equivalent: Readonly<Record<string, readonly string[]>> = {
        triplex: ["triplex", "triple"],
        duplex: ["duplex", "doble"],
        simplex: ["simplex", "simple"]
      };
      const declared = Object.entries(equivalent).filter(([, names]) =>
        names.some((name) => new RegExp(`(?:^|[^a-z])${name}(?:$|[^a-z])`).test(publishedType))
      );
      if (declared.length !== 1 || declared[0]?.[0] !== inDescription) return false;
    }
  }
  return true;
};
