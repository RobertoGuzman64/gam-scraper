import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";
import { gamCategories, gamNewCategories, gamNewTitleCategories } from "./category-rules.js";
import { specializedLogitransCategory, gamDocumentedCategory, gamElevationCategory } from "../../../evidence/providers/gam/category-evidence.js";
import { gamHandlingCategory } from "./category-handling.js";

export const newCategorySlug = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam") return null;
  let url: URL;
  try { url = new URL(record.url); }
  catch { return null; }
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.hostname !== "online.gamrentals.com" || segments[0] !== "es") return null;
  const parent = segments.at(-2) ?? "";
  if (/(?:segunda-mano|de-ocasion)/.test(parent)) return null;
  const title = fold(record.title ?? "");
  if (/\bsemi\s+electric[oa]\b/.test(title) || /\bhibrid[oa]\b/.test(title) ||
    (/\bglp\b/.test(title) && /\bdiesel\b/.test(title)) ||
    (/\belectric[oa]\b/.test(title) && /\bdiesel\b/.test(title)) ||
    (/\bbarredora\b/.test(title) && /\bfregadora\b/.test(title))) return null;
  const special = specializedLogitransCategory(record, parent, title);
  if (special !== undefined) return special;
  const handling = gamHandlingCategory(record, parent, title);
  if (handling !== undefined) return handling;
  const elevation = gamElevationCategory(record, parent, title);
  if (elevation !== undefined) return elevation;
  const documented = gamDocumentedCategory(record, parent, title);
  if (documented !== undefined) return documented;
  const explicit = gamNewCategories[parent];
  if (explicit) return explicit.title.test(title) ? explicit.slug : null;
  const matches = (gamNewTitleCategories[record.categoryKey] ?? []).filter((item) => item.title.test(title));
  return matches.length === 1 ? matches[0]?.slug ?? null : null;
};

export const gamUsedCategorySlug = (record: ProductRecord, path: readonly string[], hostname: string): string | null => {
  if (hostname === "online.gamrentals.com" && path[0] === "es") {
    const parent = path.at(-2) ?? "";
    const title = fold(record.title ?? "");
    if (parent === "mini-cargadoras-segunda-mano" && /\bminiexcavadora\b/.test(title)) {
      return "miniexcavadoras-segunda-mano";
    }
    if (parent === "carretillas-elevadoras-diesel-segunda-mano" &&
      /\bcarretilla elevadora electrica\b/.test(title)) {
      const short = fold(record.shortDescription ?? "");
      const long = fold(record.longDescription ?? "");
      const combined = `${title} ${short} ${long}`;

      const rawMotor = record.specs?.["Tipo motor"];
      const motor = rawMotor === undefined ? "" : typeof rawMotor === "string" ? fold(rawMotor) : null;
      if ((motor === "" || motor === "electrico") &&
        /\bcarretilla (?:frontal )?electrica\b/.test(short) &&
        /\bcarretilla elevadora electrica\b/.test(long) &&
        !/\b(?:diesel|glp|gasolina|hibrida)\b/.test(combined)) {
        return "carretillas-elevadoras-electricas-segunda-mano";
      }
    }
    if (parent === "carretillas-elevadoras-electricas-segunda-mano" && /\btrilateral\b/.test(title)) {
      return "carretillas-elevadoras-trilaterales-segunda-mano";
    }
    if (parent.startsWith("transpaletas-elevadoras-") && /\btranspaleta\b/.test(title)) {
      if (/\belectrica\b/.test(title) && !/\bmanual\b/.test(title)) return "transpaletas-electricas-segunda-mano";
      if (/\bmanual\b/.test(title) && !/\belectrica\b/.test(title)) return "transpaletas-manuales-segunda-mano";
      if (/\belectrica\b/.test(title) && /\bmanual\b/.test(title)) return null;
    }
    return gamCategories[parent] ?? null;
  }
  return null;
};
