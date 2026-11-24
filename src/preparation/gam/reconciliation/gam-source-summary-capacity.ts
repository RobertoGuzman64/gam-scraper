import type { ProductRecord } from "../../../contracts/catalog.js";
import { numberToken } from "../../classification/attribute-utils.js";
import { containsEditorialBrandModel, containsEditorialIdentity } from "../../editorial/identity/editorial-identity-match.js";
import { containsEditorialSourceSlugModel, verifiedEditorialUrl } from "../../editorial/source/editorial-source-url.js";

const statedKilograms = (value: string | undefined): number | null => {
  const match = /^(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*kg$/iu.exec(value?.trim() ?? "");
  return match?.[1] ? numberToken(match[1]) : null;
};

const titleCapacity = (title: string): number | null => {
  const claims = [...title.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*kg\b/giu)];
  return claims.length === 1 && claims[0]?.[1] ? numberToken(claims[0][1]) : null;
};

const documentedLongCapacity = (general: string): number | null => {
  const claims = [...general.matchAll(/\bcapacidad\s+(?:de\s+carga|nominal)\s+(?:de\s+)?(?:hasta\s+)?(\d{1,3}(?:[.,]\d{3})+|\d{1,5}(?:[.,]\d+)?)\s*(kg|toneladas?)\b/giu)];
  const capacities = claims.map((match) => {
    const value = match[1];
    const unit = match[2];
    if (!value || !unit) return null;
    if (/^toneladas?$/iu.test(unit)) {
      const amount = Number(value.replace(",", ".")) * 1000;
      return Number.isSafeInteger(amount) ? amount : null;
    }
    return statedKilograms(`${value} kg`);
  });
  return capacities.length > 0 && capacities[0] !== null &&
    capacities.every((value) => value === capacities[0]) ? capacities[0] ?? null : null;
};

export const reconcileGamCorroboratedSummaryCapacity = (record: ProductRecord): ProductRecord => {
  const { reference, title, shortDescription, longDescription, brand, model } = record;
  if (record.providerId !== "gam" || !reference || !title || !shortDescription || !longDescription ||
    !brand || !model || !record.specs ||
    !containsEditorialBrandModel(title, brand, model) ||
    !containsEditorialBrandModel(longDescription, brand, model) ||
    record.specs.Marca !== brand || record.specs.Modelo !== model) return record;
  const url = verifiedEditorialUrl(record.url, ["online.gamrentals.com"]);
  const path = url?.pathname.split("/").filter(Boolean);
  const slug = path?.[2];
  if (path?.length !== 3 || path[0] !== "es" || !slug?.startsWith(`${reference}-`) ||
    !containsEditorialIdentity(slug, brand) || !containsEditorialSourceSlugModel(slug, model, undefined)) return record;
  const specCapacity = record.specs["Capacidad de carga (kg)"];
  const declared = statedKilograms(typeof specCapacity === "string" ? specCapacity : undefined);
  if (declared === null || declared < 100 || titleCapacity(title) !== declared ||
    documentedLongCapacity(longDescription) !== declared) return record;
  const claims = [...shortDescription.matchAll(/\bcapacidad\s+de\s+carga\s+(?:de\s+)?(?:hasta\s+)?(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*kg\b/giu)];
  const claim = claims.length === 1 ? claims[0] : null;
  const previous = claim?.[1] ? statedKilograms(`${claim[1]} kg`) : null;
  if (!claim || claim.index === undefined || !claim[1] || previous === null || previous === declared) return record;
  const heading = /^\s*➨\s*([\p{L}\d-]+)\s+([\p{L}\d./-]*\d[\p{L}\d./-]*)\b/iu.exec(shortDescription);
  if (!heading?.[1] || !heading[2]) return record;
  const sameHeading = containsEditorialIdentity(heading[1], brand) && containsEditorialIdentity(heading[2], model);
  if (!sameHeading && [title, longDescription, slug].some((value) =>
    containsEditorialIdentity(value, heading[1] ?? "") && containsEditorialIdentity(value, heading[2] ?? ""))) return record;
  if (!sameHeading) return { ...record, shortDescription: null };
  const correctedClaim = claim[0].replace(claim[1], String(declared));
  return { ...record, shortDescription: `${shortDescription.slice(0, claim.index)}${correctedClaim}${shortDescription.slice(claim.index + claim[0].length)}` };
};
