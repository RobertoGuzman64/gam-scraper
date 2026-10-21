import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, energy } from "../../category-utils.js";

export const gomarizCategorySlug = (record: ProductRecord, path: readonly string[], hostname: string): string | null => {
  if (record.providerId === "gomariz" && ["gomarizrent.com", "www.gomarizrent.com"].includes(hostname) &&
    path[0] === "venta" && path.length >= 4) {
    const family = path[2] ?? "";
    const motor = fold(String(record.specs?.Motor ?? ""));
    const advertisedPower = energy(`${record.title ?? ""} ${path.at(-1) ?? ""}`);
    const motorPower = energy(motor);
    const power = motor ? (advertisedPower && advertisedPower !== motorPower ? null : motorPower) : advertisedPower;
    if (family === "elevador-tijera" && power) return power === "electric"
      ? "plataformas-tijera-electricas-segunda-mano" : "plataformas-tijera-diesel-segunda-mano";
    if (["brazo-articulado", "brazo-articulado-boom-lift"].includes(family) && power) return power === "electric"
      ? "plataformas-articuladas-electricas-segunda-mano" : "plataformas-articuladas-diesel-segunda-mano";
    if (family === "carretilla-industrial" && power) return power === "electric"
      ? "carretillas-elevadoras-electricas-segunda-mano" : "carretillas-elevadoras-diesel-segunda-mano";
    if (family === "manipulador-telescopico") return "manipulador-teñescopico-segunda-mano";
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
