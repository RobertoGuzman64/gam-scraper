import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "./source-variant-identity.js";

type Claim = Readonly<{ key: string; value: string | number }>;
type Evidence = Readonly<{
  reference: string;
  brand: string;
  model: string;
  category: string;
  pattern: RegExp;
  expected: readonly string[];
  claims: readonly Claim[];
  collision: RegExp;
}>;

const grade = /pendiente|trepabilidad|inclinaci[oó]n/iu;
const battery = /bater[ií]a|voltaje|tensi[oó]n|energ[ií]a.*kwh/iu;
const elevation = /altura.*elevaci[oó]n/iu;
const rotation = /rotaci[oó]n.*torreta|giro.*torreta/iu;
const evidence: readonly Evidence[] = [
  { reference: "6420", brand: "HYSTER", model: "J1.8UTL", category: "carretillas-nuevas",
    pattern: /trepabilidad m[aá]xima del (\d{2})% con carga y (\d{2})% sin carga \(valor nominal (\d) minutos\)/giu,
    expected: ["15", "22", "3"], claims: [{ key: "Pendiente con carga, nominal 3 min (%)", value: 15 }, { key: "Pendiente sin carga, nominal 3 min (%)", value: 22 }], collision: grade },
  { reference: "4388", brand: "HYSTER", model: "SC1.0", category: "apiladores-nuevos",
    pattern: /trepabilidad m[aá]xima sin carga del (\d{2})\s*%/giu,
    expected: ["25"], claims: [{ key: "Pendiente superable sin carga (%)", value: 25 }], collision: grade },
  { reference: "6480", brand: "HYSTER", model: "SC1.2 SL", category: "apiladores-nuevos",
    pattern: /trepabilidad m[aá]xima de (\d)\s*% con carga y (\d{2})\s*% sin carga/giu,
    expected: ["5", "10"], claims: [{ key: "Pendiente superable con carga (%)", value: 5 }, { key: "Pendiente superable sin carga (%)", value: 10 }], collision: grade },
  { reference: "6481", brand: "HYSTER", model: "SC1.5 SL", category: "apiladores-nuevos",
    pattern: /trepabilidad m[aá]xima de (\d)\s*% con carga y (\d{2})\s*% sin carga/giu,
    expected: ["5", "10"], claims: [{ key: "Pendiente superable con carga (%)", value: 5 }, { key: "Pendiente superable sin carga (%)", value: 10 }], collision: grade },
  { reference: "6368", brand: "YALE", model: "MO70T", category: "otros-nuevos",
    pattern: /trepabilidad m[aá]xima se indica en (\d)% con carga y (\d{2})% sin carga/giu,
    expected: ["3", "20"], claims: [{ key: "Pendiente superable con carga (%)", value: 3 }, { key: "Pendiente superable sin carga (%)", value: 20 }], collision: grade },
  { reference: "4624", brand: "HYSTER", model: "J1.6UTTL", category: "carretillas-nuevas",
    pattern: /bater[ií]as de ([aá]cido-plomo) o (ion-litio) integrada \(hasta (\d{3}) Ah\)/giu,
    expected: ["ácido-plomo", "ion-litio", "500"], claims: [{ key: "Baterías", value: "Opciones: ácido-plomo o ion-litio integrado (hasta 500 Ah)" }], collision: battery },
  { reference: "6113", brand: "YALE", model: "ERP16UXTL", category: "carretillas-nuevas",
    pattern: /bater[ií]as de plomo-[aá]cido de (\d{2}) V \/ (\d{3})–(\d{3}) Ah o con bater[ií]a de litio integrada de (\d{2},\d) V en capacidades de (\d{3}), (\d{3}) y (\d{3}) Ah/giu,
    expected: ["48", "500", "640", "51,2", "250", "375", "500"], claims: [{ key: "Baterías", value: "Opciones: plomo-ácido 48 V / 500–640 Ah; litio integrado 51,2 V / 250, 375 o 500 Ah" }], collision: battery },
  { reference: "6114", brand: "YALE", model: "ERP18UXTL", category: "carretillas-nuevas",
    pattern: /bater[ií]as de plomo-[aá]cido de (\d{2}) V y con bater[ií]a de litio integrada de (\d{2},\d) V en capacidades de (\d{3}), (\d{3}) y (\d{3}) Ah/giu,
    expected: ["48", "51,2", "250", "375", "500"], claims: [{ key: "Baterías", value: "Opciones: plomo-ácido 48 V; litio integrado 51,2 V / 250, 375 o 500 Ah" }], collision: battery },
  { reference: "6323", brand: "YALE", model: "ERP18UX L", category: "carretillas-nuevas",
    pattern: /La versi[oó]n L incluye bater[ií]a de ion de litio de (\d{2})V, con distintas configuraciones de capacidad/giu,
    expected: ["48"], claims: [{ key: "Batería", value: "Ion de litio integrada, 48 V (capacidad según configuración)" }], collision: battery },
  { reference: "6115", brand: "YALE", model: "ERP20UXTL", category: "carretillas-nuevas",
    pattern: /bater[ií]as de plomo-[aá]cido de (\d{2}) V y hasta (\d{3}) Ah, o con bater[ií]a de litio integrada de (\d{2},\d) V en capacidades de (\d{3}), (\d{3}) y (\d{3}) Ah/giu,
    expected: ["48", "640", "51,2", "250", "375", "500"], claims: [{ key: "Baterías", value: "Opciones: plomo-ácido 48 V / hasta 640 Ah; litio integrado 51,2 V / 250, 375 o 500 Ah" }], collision: battery },
  { reference: "5989", brand: "YALE", model: "ERP2.5MXLG", category: "carretillas-nuevas",
    pattern: /dos configuraciones de bater[ií]a integrada: (115,2) V y (228) Ah, con una energ[ií]a de (26,3) kWh, y (153,6) V y (228) Ah, con una energ[ií]a de (35) kWh/giu,
    expected: ["115,2", "228", "26,3", "153,6", "228", "35"], claims: [{ key: "Batería", value: "Opciones LFP: 115,2 V / 228 Ah / 26,3 kWh; 153,6 V / 228 Ah / 35 kWh" }], collision: battery },
  { reference: "5990", brand: "YALE", model: "ERP3.0MXLG", category: "carretillas-nuevas",
    pattern: /dos configuraciones de bater[ií]a integrada: (115,2) V y (228) Ah, con una energ[ií]a de (26,3) kWh, y (153,6) V y (228) Ah, con una energ[ií]a de (35) kWh/giu,
    expected: ["115,2", "228", "26,3", "153,6", "228", "35"], claims: [{ key: "Batería", value: "Opciones LFP: 115,2 V / 228 Ah / 26,3 kWh; 153,6 V / 228 Ah / 35 kWh" }], collision: battery },
  { reference: "4660", brand: "CTE", model: "ZED 20.4 HN", category: "elevacion-nueva",
    pattern: /torreta con rotaci[oó]n de ±(\d{3})°/giu,
    expected: ["310"], claims: [{ key: "Rotación de torreta", value: "±310°" }], collision: rotation },
  { reference: "4717", brand: "CTE", model: "ZED 20.4 HN", category: "elevacion-nueva",
    pattern: /torreta con rotaci[oó]n de ±(\d{3})°/giu,
    expected: ["310"], claims: [{ key: "Rotación de torreta", value: "±310°" }], collision: rotation },
  { reference: "3997", brand: "Tennant", model: "FCA T191", category: "limpieza-fregadoras",
    pattern: /dep[oó]sitos de (\d{2}) y (\d{2}) litros respectivamente/giu,
    expected: ["28", "30"], claims: [{ key: "Depósito de solución", value: 28 }, { key: "Depósito de recuperación", value: 30 }], collision: /dep[oó]sito.*soluci[oó]n|dep[oó]sito.*recuperaci[oó]n/iu },
  { reference: "2369", brand: "YALE", model: "GP90VX", category: "carretillas-nuevas",
    pattern: /altura de elevaci[oó]n de hasta (\d\.\d{3}) mm/giu,
    expected: ["6.065"], claims: [{ key: "Altura de elevación máxima (mm)", value: 6065 }], collision: elevation },
  { reference: "6573", brand: "HYSTER", model: "RO1.6", category: "carretillas-nuevas",
    pattern: /velocidad m[aá]xima de desplazamiento de hasta (\d{2},\d) km\/h sin carga/giu,
    expected: ["12,5"], claims: [{ key: "Velocidad máxima sin carga (km/h)", value: 12.5 }], collision: /velocidad.*desplazamiento|velocidad.*carga/iu },
  { reference: "4012", brand: "Tennant", model: "FCS T1581 D", category: "limpieza-fregadoras",
    pattern: /autonom[ií]a de hasta (\d) horas con bater[ií]as h[uú]medas, o (\d) horas con bater[ií]as de gel/giu,
    expected: ["5", "4"], claims: [{ key: "Autonomía según batería", value: "Hasta 5 h (batería húmeda); hasta 4 h (batería de gel)" }], collision: /autonom[ií]a/iu },
  { reference: "4006", brand: "Tennant", model: "FCS T7+ D65", category: "limpieza-fregadoras",
    pattern: /motor de aspiraci[oó]n de (\d,\d{2}) kW/giu,
    expected: ["0,45"], claims: [{ key: "Potencia de aspiración (kW)", value: 0.45 }], collision: /potencia.*aspiraci[oó]n|motor.*aspiraci[oó]n/iu },
  { reference: "4007", brand: "Tennant", model: "FCS T7+ D80", category: "limpieza-fregadoras",
    pattern: /motor de aspiraci[oó]n de (\d,\d{2}) kW/giu,
    expected: ["0,45"], claims: [{ key: "Potencia de aspiración (kW)", value: 0.45 }], collision: /potencia.*aspiraci[oó]n|motor.*aspiraci[oó]n/iu }
];

const byReference = new Map(evidence.map((entry) => [entry.reference, entry]));

export const recoverGamVerifiedResidualPerformanceSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entry = byReference.get(record.reference ?? "");
  if (!entry || record.condition !== "Nuevo" || record.brand !== entry.brand || record.model !== entry.model ||
    record.categoryKey !== entry.category || !verifiedGamSourceVariant(record) ||
    Object.keys(source).some((key) => entry.collision.test(key) || entry.claims.some((claim) => claim.key === key))) return source;
  const matches = [...(record.longDescription ?? "").matchAll(entry.pattern)];
  if (matches.length === 0 || matches.some((match) =>
    !entry.expected.every((value, index) => match[index + 1] === value))) return source;
  return { ...source, ...Object.fromEntries(entry.claims.map((claim) => [claim.key, claim.value])) };
};
