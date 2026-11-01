import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamElectricalIdentity } from "./electrical-identity-evidence.js";

const variantLevels = /\bnivel de ruido de (\d{2,3})\s*dBA para la versi[oó]n de GLP y (\d{2,3})\s*dBA para la versi[oó]n di[eé]sel\b/giu;

export const recoverGamVerifiedVariantAcoustics = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.reference !== "4034" || record.categoryKey !== "limpieza-barredoras" ||
    record.brand !== "Tennant" || record.model !== "BCS 800 Diesel/LPG" ||
    !verifiedGamElectricalIdentity(record) ||
    Object.keys(source).some((key) => /nivel\s+sonoro|ruido\s*\(/iu.test(key))) return source;
  const matches = [...(record.longDescription ?? "").matchAll(variantLevels)];
  const first = matches[0];
  const gas = first ? Number(first[1]) : null;
  const diesel = first ? Number(first[2]) : null;
  if (gas === null || diesel === null || gas < 50 || gas > 110 || diesel < 50 || diesel > 110 ||
    matches.some((match) => Number(match[1]) !== gas || Number(match[2]) !== diesel)) return source;
  return { ...source, "Nivel sonoro": `GLP: ${gas} dBA; diésel: ${diesel} dBA` };
};
