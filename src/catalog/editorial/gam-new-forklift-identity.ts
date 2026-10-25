import type { ImportCandidate } from "../import/preparation/contracts.js";

const normalize = (value: string): string => value.trim().toLocaleUpperCase("es");
const compact = (value: string): string => normalize(value).replace(/[^A-Z0-9]/g, "");

export const gamNewForkliftIdentityIssues = (product: ImportCandidate): readonly string[] => {
  if (product.providerId !== "gam" || product.condition !== "Nuevo") return [];
  let brand: string;
  try {
    const url = new URL(product.sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || parts[0] !== "es" ||
      !["hyster", "yale"].includes(parts[1] ?? "") ||
      parts.length !== 3 || !parts[2]?.startsWith(`${product.reference}-`)) return [];
    brand = normalize(parts[1] ?? "");
  } catch {
    return [];
  }
  if (!/carretilla/i.test(product.title ?? "")) return [];
  const title = /\b(HYSTER|YALE)\s+([A-Z0-9][A-Z0-9.-]*\d[A-Z0-9.-]*)\s*$/i.exec(product.title ?? "");
  const short = /^\s*➨\s*(HYSTER|YALE)\s+([A-Z0-9][A-Z0-9.-]*\d[A-Z0-9.-]*)\b/i.exec(product.description ?? "");
  const technicalBrand = product.spec["Marca"];
  const technicalModel = product.spec["Modelo"];
  const issues: string[] = [];
  if (typeof technicalBrand === "string" && normalize(technicalBrand) !== brand) {
    issues.push(`Identidad GAM contradictoria: marca ${brand} en anuncio y ${normalize(technicalBrand)} en ficha técnica`);
  }
  if ((title?.[1] && normalize(title[1]) !== brand) || (short?.[1] && normalize(short[1]) !== brand)) {
    issues.push("Identidad GAM contradictoria: marca en título o resumen distinta de la ruta comercial");
  }
  if (issues.length > 0 && title?.[2] && short?.[2] && compact(title[2]) !== compact(short[2])) {
    issues.push("Identidad GAM contradictoria: modelo distinto entre título y resumen");
  }
  if (issues.length > 0 && typeof technicalModel === "string" &&
    [title?.[2], short?.[2]].some((candidate) => candidate && compact(candidate) !== compact(technicalModel))) {
    issues.push(`Identidad GAM contradictoria: modelo anunciado distinto de ${technicalModel} en ficha técnica`);
  }
  return issues;
};
