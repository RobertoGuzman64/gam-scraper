import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "./source-variant-identity.js";

type Evidence = Readonly<{
  reference: string;
  brand: string;
  model: string;
  category: string;
  key: "Frenado regenerativo" | "Dirección asistida";
}>;

const evidence: readonly Evidence[] = [
  { reference: "5888", brand: "HYSTER", model: "J2.2A", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "5889", brand: "HYSTER", model: "J2.5A", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "5890", brand: "HYSTER", model: "J3.0A", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "5891", brand: "HYSTER", model: "J3.5A", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "3803", brand: "HYSTER", model: "J9.0XNL", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "2335", brand: "YALE", model: "MS16X", category: "apiladores-nuevos", key: "Frenado regenerativo" },
  { reference: "2205", brand: "YALE", model: "MS16XIL", category: "apiladores-nuevos", key: "Frenado regenerativo" },
  { reference: "2206", brand: "YALE", model: "MS16XSL", category: "apiladores-nuevos", key: "Frenado regenerativo" },
  { reference: "2370", brand: "YALE", model: "MS24HBE", category: "apiladores-nuevos", key: "Frenado regenerativo" },
  { reference: "2154", brand: "HYSTER", model: "S2.0S", category: "apiladores-nuevos", key: "Frenado regenerativo" },
  { reference: "2259", brand: "YALE", model: "MP16UX", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "2243", brand: "YALE", model: "MP18", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "2244", brand: "YALE", model: "MP20", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "6322", brand: "YALE", model: "ERP15UX L", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "6325", brand: "YALE", model: "ERP25UX L", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "2237", brand: "YALE", model: "MO10L", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "2302", brand: "YALE", model: "MO10", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "2241", brand: "YALE", model: "MO10S", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "2240", brand: "YALE", model: "MO25", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "2238", brand: "YALE", model: "MO20", category: "marcas-nuevas", key: "Dirección asistida" },
  { reference: "2018", brand: "HYSTER", model: "E1.6XN", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "2019", brand: "HYSTER", model: "E1.8XN", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "2021", brand: "HYSTER", model: "E2.2XN", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "2022", brand: "HYSTER", model: "E2.5XN", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "2023", brand: "HYSTER", model: "E3.0XN", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "2024", brand: "HYSTER", model: "E3.2XN", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "2010", brand: "HYSTER", model: "A1.5XNT", category: "carretillas-nuevas", key: "Frenado regenerativo" },
  { reference: "6990", brand: "HYSTER", model: "PC2.0", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "2248", brand: "YALE", model: "MP20X", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "2251", brand: "YALE", model: "MP20XUX", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "2245", brand: "YALE", model: "MP22", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "2249", brand: "YALE", model: "MP25X", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "2250", brand: "YALE", model: "MP30X", category: "marcas-nuevas", key: "Frenado regenerativo" },
  { reference: "6113", brand: "YALE", model: "ERP16UXTL", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "6114", brand: "YALE", model: "ERP18UXTL", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "6323", brand: "YALE", model: "ERP18UX L", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "6115", brand: "YALE", model: "ERP20UXTL", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "6326", brand: "YALE", model: "ERP30UX L", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "6327", brand: "YALE", model: "ERP35UX L", category: "carretillas-nuevas", key: "Dirección asistida" },
  { reference: "2129", brand: "HYSTER", model: "K1.0M", category: "carretillas-nuevas", key: "Dirección asistida" },
];

const byReference = new Map(evidence.map((entry) => [entry.reference, entry]));
const regenerativeBraking = /\bfrenad[oa] regenerativ[oa]\b/iu;
const powerSteering = /\bdirecci[oó]n asistida\b/iu;

export const recoverGamVerifiedSteeringBraking = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entry = byReference.get(record.reference ?? "");
  if (!entry || record.condition !== "Nuevo" || record.brand !== entry.brand ||
    record.model !== entry.model || record.categoryKey !== entry.category ||
    !verifiedGamSourceVariant(record) ||
    Object.keys(source).some((key) => key.toLocaleLowerCase("es") === entry.key.toLocaleLowerCase("es"))) return source;
  const pattern = entry.key === "Frenado regenerativo" ? regenerativeBraking : powerSteering;
  if (!pattern.test(record.longDescription ?? "")) return source;
  return { ...source, [entry.key]: true };
};
