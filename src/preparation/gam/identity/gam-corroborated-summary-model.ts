import type { ProductRecord } from "../../../contracts/catalog.js";
import { containsEditorialIdentity } from "../../editorial/identity/editorial-identity-match.js";
import { verifiedEditorialIdentity } from "../../editorial/core/editorial-source-contract.js";
import { verifiedEditorialUrl, containsEditorialSourceSlugModel } from "../../editorial/source/editorial-source-url.js";

const compact = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

export const reconcileGamCorroboratedSummaryModel = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !record.reference || !record.brand || !record.model ||
    !record.shortDescription || !record.longDescription || !verifiedEditorialIdentity(record)) return record;
  const url = verifiedEditorialUrl(record.url, ["online.gamrentals.com"]);
  const path = url?.pathname.split("/").filter(Boolean);
  if (path?.length !== 3 || path[0] !== "es" || !path[2]?.startsWith(`${record.reference}-`) ||
    !containsEditorialSourceSlugModel(path[2], record.model, undefined) ||
    !containsEditorialIdentity(record.longDescription, record.brand) ||
    !containsEditorialIdentity(record.longDescription, record.model)) return record;
  const summary = record.shortDescription;
  const match = /^(\s*➨\s*)([^➨]+?)(\s*➨)/u.exec(summary);
  const announcement = match?.[2]?.trim();
  if (!match?.[1] || !match[2] || !match[3] || !announcement ||
    !announcement.toLocaleLowerCase("es").startsWith(`${record.brand.toLocaleLowerCase("es")} `)) return record;
  const remainder = announcement.slice(record.brand.length).trim();
  const condition = /\s+(?:Nuevo|Nueva|Segunda Mano)$/iu.exec(remainder)?.[0];
  if (!condition) return record;
  const stale = remainder.slice(0, -condition.length).trim();
  const current = compact(record.model);
  const previous = compact(stale);
  if (current.length < 5 || current.length !== previous.length ||
    [...current].filter((character, index) => character !== previous[index]).length !== 1 ||
    containsEditorialIdentity(record.longDescription, stale) ||
    containsEditorialIdentity(record.title ?? "", stale) ||
    containsEditorialIdentity(path[2], stale)) return record;
  const oldHeading = match[2];
  const newHeading = oldHeading.replace(stale, record.model);
  if (newHeading === oldHeading) return record;
  return { ...record, shortDescription: summary.replace(oldHeading, newHeading) };
};
