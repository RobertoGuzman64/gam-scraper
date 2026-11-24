import type { ProductRecord } from "../../../contracts/catalog.js";
import { containsEditorialIdentity } from "../../editorial/identity/editorial-identity-match.js";
import { editorialFamilyName, editorialFamilyOf } from "../../editorial/core/editorial-families.js";
import { containsEditorialSourceSlugModel, verifiedEditorialUrl } from "../../editorial/source/editorial-source-url.js";

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

export const reconcileGamForeignCategoryTitle = (record: ProductRecord): ProductRecord => {
  const title = record.title?.trim() ?? "";
  const short = record.shortDescription?.trim() ?? "";
  const general = record.longDescription?.trim() ?? "";
  const model = record.model?.trim() ?? "";
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !title || !short || !general || model.length < 3 ||
    !/\bsegunda mano\b/u.test(normalized(title)) ||
    /\bsegunda mano\b/u.test(normalized(`${short} ${general}`)) ||
    containsEditorialIdentity(title, model) ||
    typeof record.specs?.Modelo !== "string" || normalized(record.specs.Modelo) !== normalized(model)) return record;
  const url = verifiedEditorialUrl(record.url, ["online.gamrentals.com"]);
  const path = url?.pathname.split("/").filter(Boolean);
  if (path?.length !== 3 || path[0] !== "es" || !path[2]?.startsWith(`${record.reference}-`) ||
    /(?:segunda-mano|de-ocasion)/iu.test(path[1] ?? "") ||
    !containsEditorialSourceSlugModel(path[2], model, undefined)) return record;
  const family = editorialFamilyOf((path[2] ?? "").replaceAll("-", " "));
  if (!family || editorialFamilyOf(short) !== family || editorialFamilyOf(general) !== family ||
    family.startsWith("plataforma-") ||
    !(/(?:^|-)nuev[oa]s?(?:-|$)/iu.test(record.categoryKey) || /\bnuev[oa]\b/iu.test(short))) return record;
  const titledFamily = editorialFamilyOf(title);
  if (titledFamily === family || (!titledFamily && !/\bplataformas?\s+elevadoras?\b/iu.test(title)) ||
    titledFamily === null && family.startsWith("plataforma-")) return record;
  const brand = record.brand?.trim() || /^➨\s*([\p{L}][\p{L}\d-]*)\s+/u.exec(short)?.[1];
  if (!brand || containsEditorialIdentity(title, brand) ||
    typeof record.specs?.Marca === "string" && normalized(record.specs.Marca) !== normalized(brand) ||
    ![short, general, path[1] ?? "", path[2] ?? ""].every((value) => containsEditorialIdentity(value, brand)) ||
    ![short, general].every((value) => containsEditorialIdentity(value, model))) return record;
  const noun = editorialFamilyName(family);
  return { ...record, title: `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)} ${brand} ${model}` };
};
