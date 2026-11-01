import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "./source-variant-identity.js";

type Evidence = Readonly<{ reference: string; brand: string; model: string; category: string; pattern: RegExp; key: string }>;

const evidence: readonly Evidence[] = [
  { reference: "4778", brand: "XCMG", model: "XGA16H", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4779", brand: "XCMG", model: "XGA18H", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4780", brand: "XCMG", model: "XGA20H", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4782", brand: "XCMG", model: "XGS16K", category: "elevacion-nueva", pattern: /\btracci[oó]n 4x4\b/iu, key: "Tracción 4x4" },
  { reference: "4785", brand: "XCMG", model: "XGS22K", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4787", brand: "XCMG", model: "XGS28E1", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4795", brand: "XCMG", model: "XGS28ACK", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4788", brand: "XCMG", model: "XGS32K", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4796", brand: "XCMG", model: "XGS32ACKⅡ", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4790", brand: "XCMG", model: "XGS40K", category: "elevacion-nueva", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "4793", brand: "XCMG", model: "XGS70K", category: "elevacion-nueva", pattern: /\btracci[oó]n 4x4\b/iu, key: "Tracción 4x4" },
  { reference: "4813", brand: "XCMG", model: "XT2506KH", category: "otros-nuevos", pattern: /\btracci[oó]n en las cuatro ruedas\b/iu, key: "Tracción 4x4" },
  { reference: "2194", brand: "YALE", model: "MS10E", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
  { reference: "2258", brand: "YALE", model: "MC10", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
  { reference: "2195", brand: "YALE", model: "MS12E", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
  { reference: "2260", brand: "YALE", model: "MS12 IL", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
  { reference: "2203", brand: "YALE", model: "MS12XIL", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
  { reference: "2199", brand: "YALE", model: "MS14XIL", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
  { reference: "2204", brand: "YALE", model: "MS14X", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
  { reference: "2201", brand: "YALE", model: "MS16 IL", category: "apiladores-nuevos", pattern: /\bsistema de frenado regenerativo\b/iu, key: "Frenado regenerativo" },
];

const byReference = new Map(evidence.map((entry) => [entry.reference, entry]));

export const recoverGamVerifiedTractionBraking = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entry = byReference.get(record.reference ?? "");
  if (!entry || record.condition !== "Nuevo" || record.brand !== entry.brand || record.model !== entry.model ||
    record.categoryKey !== entry.category || !verifiedGamSourceVariant(record) ||
    Object.keys(source).some((key) => key.toLocaleLowerCase("es") === entry.key.toLocaleLowerCase("es")) ||
    !entry.pattern.test(record.longDescription ?? "")) return source;
  return { ...source, [entry.key]: true };
};
