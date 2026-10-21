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
