import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, energy } from "../../category-utils.js";

export const mercaelevaCategorySlug = (record: ProductRecord, path: readonly string[], hostname: string): string | null => {
  if (hostname === "sales.mercaeleva.com" &&
    /^(?:es|en)\/for-sale\/machine\/[^/]+\/?$/i.test(path.join("/"))) {
    const text = fold(String(record.specs?.["Título adicional"] ?? record.title ?? ""));
    if (/\bdumper\b/.test(text)) return "dumpers-segunda-mano";
    if (/\bminiexcavadora\b/.test(text)) return "miniexcavadoras-segunda-mano";
    if (/\bmanipulador telescopico\b/.test(text)) return "manipulador-teñescopico-segunda-mano";
    if (/\bcamion cesta\b/.test(text)) return "plataformas-elevadoras-sobre-camion-segunda-mano";
    if (/\bapilador\b/.test(text)) {
      const electric = /\belectric[oa]\b/.test(text) || Boolean(String(record.specs?.["Tipo de Batería"] ?? "").trim());
      const manual = /\bmanual\b/.test(text);
      if (electric && !manual) return "apiladores-electricos-segunda-mano";
      if (manual && !electric) return "apiladores-manuales-segunda-mano";
    }
    if (/\btranspalet(?:a)?\b/.test(text)) {
      if (/\belectric[oa]\b/.test(text)) return "transpaletas-electricas-segunda-mano";
      if (/\bmanual\b/.test(text)) return "transpaletas-manuales-segunda-mano";
    }
    if (/\bcarretilla\b/.test(text)) {
      if (/\bretractil\b/.test(text)) return "carretillas-elevadoras-retractiles-segunda-mano";
      if (/\b4x4\b|\btodoterreno\b/.test(text)) return "carretillas-todoterreno-segunda-mano";
      if (/\bglp\b/.test(text)) return "carretillas-elevadoras-glp-segunda-mano";
      if (/\bdiesel\b/.test(text)) return "carretillas-elevadoras-diesel-segunda-mano";
      if (/\belectric[oa]\b/.test(text)) return "carretillas-elevadoras-electricas-segunda-mano";
    }
    if (/\bplataforma\b/.test(text)) {
      if (/\btijera\b/.test(text)) {
        const power = energy(text);
        return power === "electric" ? "plataformas-tijera-electricas-segunda-mano"
          : power === "diesel" ? "plataformas-tijera-diesel-segunda-mano" : null;
      }
      if (/\barticulada\b/.test(text)) {
        const power = energy(text);
        return power === "electric" ? "plataformas-articuladas-electricas-segunda-mano"
          : power === "diesel" ? "plataformas-articuladas-diesel-segunda-mano" : null;
      }
      if (/\btelescopica\b/.test(text)) return "plataformas-elevadoras-telescopicas-segunda-mano";
      if (/\bvertical\b/.test(text) && /\bautopropulsada\b/.test(text)) return "plataformas-unipersonales-segunda-mano";
    }
    return null;
  }
  return null;
};


export const mercaelevaNewCategorySlug = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva") return null;
  let url: URL;
  try { url = new URL(record.url); }
  catch { return null; }
  if (url.hostname !== "sales.mercaeleva.com" ||
    !/^(?:es|en)\/for-sale\/machine\/[^/]+\/?$/i.test(url.pathname.replace(/^\//, ""))) return null;
  const state = fold(String(record.specs?.["Estado"] ?? ""));
  if (record.condition !== "Nuevo" && state !== "nuevo" && state !== "nueva") return null;
  const title = fold(record.title ?? "");
  const additional = fold(String(record.specs?.["Título adicional"] ?? ""));
  const engine = fold(String(record.specs?.["Tipo de motor"] ?? ""));
  const battery = fold(String(record.specs?.["Tipo de Batería"] ?? ""));
  const text = `${title} ${additional}`;
  if (/\b(?:diesel|glp|gasolina|manual|semielectr(?:ic[oa])?)\b/.test(text) ||
    /\b(?:diesel|glp|gasolina)\b/.test(engine)) return null;
  const electricTitle = /\belectric[oa]s?\b/.test(title);
  const electricAdditional = /\belectric[oa]s?\b/.test(additional);
  if (engine && !/\belectric[oa]s?\b/.test(engine)) return null;
  if (additional && electricTitle !== electricAdditional && /\b(?:electric[oa]s?|diesel|manual)\b/.test(additional)) return null;
  const electric = electricTitle || electricAdditional || /\b(?:li-ion|litio|gel|plomo)\b/.test(battery);
  if (!electric) return null;
  const families: readonly { readonly pattern: RegExp; readonly slug: string }[] = [
    { pattern: /\bplataforma\b.*\btijera\b/, slug: "plataforma-tijera-electrica" },
    { pattern: /\bplataforma\b.*\barticulada\b/, slug: "plataforma-articulada-electrica" },
    { pattern: /\bcarretilla\b/, slug: "carretilla-elevadora-electrica" },
    { pattern: /\bapilador(?:a)?\b/, slug: "apilador-electrico" },
    { pattern: /\btranspalet(?:a)?\b/, slug: "transpaleta-electrica" }
  ];
  const matches = families.filter((item) => item.pattern.test(title));
  if (matches.length !== 1) return null;
  if (additional && families.some((item) => item.pattern.test(additional) && item.slug !== matches[0]?.slug)) return null;
  return matches[0]?.slug ?? null;
};
