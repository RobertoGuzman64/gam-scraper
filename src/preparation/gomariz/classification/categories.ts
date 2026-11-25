import type { ProductRecord } from "../../../contracts/catalog.js";
import { fold, energy } from "../../classification/category-utils.js";
import { gomarizDocumentedElectricScissor } from "./product-family.js";

import { gomarizSourceFamily } from "./source-category.js";

export const gomarizCategorySlug = (record: ProductRecord, path: readonly string[], hostname: string): string | null => {
  const family = gomarizSourceFamily(record, path);
  if (record.providerId === "gomariz" && ["gomarizrent.com", "www.gomarizrent.com"].includes(hostname) && family) {
    const motor = fold(String(record.specs?.Motor ?? ""));
    const advertisedPower = energy(`${record.title ?? ""} ${path.at(-1) ?? ""}`);
    const motorPower = energy(motor);
    const documentedDiesel = !motor && !advertisedPower &&
      ["brazo-articulado", "brazo-articulado-boom-lift"].includes(family) &&
      fold(record.brand ?? "") === "jlg" && fold(record.model ?? "") === "340aj" &&
      fold(record.title ?? "") === "jlg 340aj" &&
      /\blas articuladas diesel\b/.test(fold(record.longDescription ?? ""));
    // https://www.gomarizrent.com/wp-content/uploads/2024/04/FICHA-TECNICA-340AJ.pdf
    const documentedScissor = family === "elevador-tijera" && gomarizDocumentedElectricScissor(record, path);
    const documentedConflict = documentedScissor && (motorPower === "diesel" || advertisedPower === "diesel");
    const power = documentedConflict ? null : path[0] === "producto" ?
      (motor && motorPower && (!advertisedPower || advertisedPower === motorPower) ? motorPower : null) :
      motor ? (advertisedPower && advertisedPower !== motorPower ? null : motorPower) :
        advertisedPower ?? (documentedScissor ? "electric" : documentedDiesel ? "diesel" : null);
    if (family === "elevador-tijera" && power) return power === "electric"
      ? "plataformas-tijera-electricas-segunda-mano" : "plataformas-tijera-diesel-segunda-mano";
    if (["brazo-articulado", "brazo-articulado-boom-lift"].includes(family) && power) return power === "electric"
      ? "plataformas-articuladas-electricas-segunda-mano" : "plataformas-articuladas-diesel-segunda-mano";
    if (family === "carretilla-industrial" && power) return power === "electric"
      ? "carretillas-elevadoras-electricas-segunda-mano" : "carretillas-elevadoras-diesel-segunda-mano";
    if (family === "manipulador-telescopico") return "manipulador-teñescopico-segunda-mano";
    if (family === "carretilla-todoterreno" && power) return "carretillas-todoterreno-segunda-mano";
    if (family === "rodillo" && /\brodillo compactador en tandem\b/.test(fold(record.longDescription ?? ""))) {
      return "rodillo-tandem-segunda-mano";
    }
    if (family === "elevador-mastil-vertical" && power === "electric") {
      return "plataformas-unipersonales-segunda-mano";
    }
    const types: Readonly<Record<string, string>> = {
      "brazo-telescopico": "plataformas-elevadoras-telescopicas-segunda-mano",
      "camion-plataforma": "plataformas-elevadoras-sobre-camion-segunda-mano",
      "oruga": "plataformas-elevadoras-sobre-orugas-segunda-mano",
      "generador": "grupos-electrogenos-segunda-mano",
      "torre-de-luz": "torres-iluminacion-segunda-mano",
      "carretilla-retractil": "carretillas-elevadoras-retractiles-segunda-mano",
      "dumper": "dumpers-segunda-mano",
      "fregadora": "fregadoras-segunda-mano"
    };
    return types[family] ?? null;
  }
  return null;
};
