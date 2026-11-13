import type { ProductRecord } from "../../../../contracts/catalog.js";
import { invalidGomarizPlatformHeight } from "../../../../catalog/normalization/gomariz/technical.js";
import { verifiedEditorialUrl, containsEditorialSourceSlugModel } from "../../../shared/editorial/domain/editorial-source-url.js";
import type { EditorialSource } from "../../../shared/editorial/domain/editorial-source-contract.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../../../shared/editorial/domain/editorial-source-contract.js";

const sourceFamilies: Readonly<Record<string, string>> = {
  "elevacion-y-trabajos-en-altura/oruga": "plataforma sobre orugas",
  "energia-electrica-e-iluminacion/generador": "grupo electrógeno",
  "energia-electrica-e-iluminacion/torre-de-luz": "torre de iluminación"
};

export const resolveGomarizEditorialDomainSource = (record: ProductRecord): EditorialSource | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !(verifiedEditorialIdentity(record) || verifiedEditorialStructuredIdentity(record)) ||
    invalidGomarizPlatformHeight(record.url, record.specs ?? {})) return null;
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model) return null;
  const url = verifiedEditorialUrl(record.url, ["www.gomarizrent.com", "gomarizrent.com"]);
  if (!url) return null;
  const path = url.pathname.split("/").filter(Boolean);
  const validPath = path[0] === "producto" && path.length === 2 ||
      path[0] === "venta" && path.length === 4 ||
      path[0] !== "venta" && path.length === 3;
  if (!validPath || !containsEditorialSourceSlugModel(path[path.length - 1] ?? "", model, record.specs?.Motor)) return null;
  const pathFamily = path.length === 4 && path[0] === "venta" ?
    sourceFamilies[`${path[1]}/${path[2]}`] ?? "" : "";
  return {
    brand, model,
    familyClues: `${pathFamily} ${record.title ?? ""} ${url.pathname}`,
    workingHeight: record.specs?.["Altura de trabajo"],
    lateralReach: record.specs?.["Alcance lateral"],
    liftingHeight: undefined,
    liftingHeightUnit: "m",
    loadCapacity: record.specs?.Capacidad,
    equipmentHeight: undefined,
    motor: record.specs?.Motor
  };
};
