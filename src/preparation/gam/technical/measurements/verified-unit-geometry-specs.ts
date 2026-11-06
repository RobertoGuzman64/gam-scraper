import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

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
const turret = /rotaci[oó]n(?:\s+de\s+(?:la\s+)?)?torreta|giro\s+de\s+torreta/iu;
const fork = /horquillas?/iu;
const acoustic = /sonor[oa]|sonido|ruido|ac[uú]stic[oa]/iu;

const evidence: readonly Evidence[] = [
  { reference: "6419", brand: "HYSTER", model: "J1.5UTL", category: "carretillas-nuevas",
    pattern: /\btrepabilidad del (\d{1,2})% con carga y (\d{1,2})% sin carga\b/giu,
    expected: ["16", "23"], claims: [{ key: "Pendiente superable con carga (%)", value: 16 }, { key: "Pendiente superable sin carga (%)", value: 23 }], collision: grade },
  { reference: "6425", brand: "HYSTER", model: "J3.0UTL", category: "carretillas-nuevas",
    pattern: /\btrepabilidad m[aá]xima del (\d{1,2})% con carga y (\d{1,2})% sin carga\b/giu,
    expected: ["20", "23"], claims: [{ key: "Pendiente superable con carga (%)", value: 20 }, { key: "Pendiente superable sin carga (%)", value: 23 }], collision: grade },
  { reference: "6424", brand: "HYSTER", model: "J3.5UTL", category: "carretillas-nuevas",
    pattern: /\btrepabilidad m[aá]xima del (\d{1,2})% con carga y (\d{1,2})% sin carga\b/giu,
    expected: ["15", "22"], claims: [{ key: "Pendiente superable con carga (%)", value: 15 }, { key: "Pendiente superable sin carga (%)", value: 22 }], collision: grade },
  { reference: "2151", brand: "HYSTER", model: "S1.2S", category: "apiladores-nuevos",
    pattern: /\btrepabilidad de hasta (\d{1,2})\s*%\s*\(con carga\)/giu,
    expected: ["7"], claims: [{ key: "Pendiente superable con carga (%)", value: 7 }], collision: grade },
  { reference: "4623", brand: "HYSTER", model: "SC1.2", category: "apiladores-nuevos",
    pattern: /\btrepabilidad m[aá]xima del (\d{1,2})\s*% sin carga\b/giu,
    expected: ["10"], claims: [{ key: "Pendiente superable sin carga (%)", value: 10 }], collision: grade },
  { reference: "2108", brand: "HYSTER", model: "S1.5UTS", category: "apiladores-nuevos",
    pattern: /\btrepabilidad del (\d{1,2})\s*% y ruedas de poliuretano\b/giu,
    expected: ["8"], claims: [{ key: "Pendiente superable (%)", value: 8 }], collision: grade },
  { reference: "1713", brand: "HYSTER", model: "S2.0SD", category: "apiladores-nuevos",
    pattern: /\btrepabilidad de hasta el (\d{1,2})\s*%, puede operar en rampas con seguridad, incluso cargado\b/giu,
    expected: ["9"], claims: [{ key: "Pendiente superable con carga (%)", value: 9 }], collision: grade },
  { reference: "2102", brand: "HYSTER", model: "S1.5C", category: "apiladores-nuevos",
    pattern: /\brendimiento en rampa \(hasta (\d{1,2})\s*%\)/giu,
    expected: ["9"], claims: [{ key: "Pendiente superable (%)", value: 9 }], collision: grade },
  { reference: "4798", brand: "XCMG", model: "XGS40ACK", category: "elevacion-nueva",
    pattern: /\btorreta con rotaci[oó]n continua de (\d{3})°/giu,
    expected: ["360"], claims: [{ key: "Rotación de torreta", value: "360° (continua)" }], collision: turret },
  { reference: "4846", brand: "CTE", model: "ZED 20.4 HN IVE FIB", category: "elevacion-nueva",
    pattern: /\btorreta con rotaci[oó]n de ±(\d{3})°/giu,
    expected: ["310"], claims: [{ key: "Rotación de torreta", value: "±310°" }], collision: turret },
  { reference: "4725", brand: "CTE", model: "ZETA 23", category: "elevacion-nueva",
    pattern: /\btorreta con rotaci[oó]n de ±(\d{3})°/giu,
    expected: ["320"], claims: [{ key: "Rotación de torreta", value: "±320°" }], collision: turret },
  { reference: "6743", brand: "YALE", model: "MO20X", category: "carretillas-nuevas",
    pattern: /\bhorquillas de (\d{2})\s*×\s*(\d{3})\s*×\s*(\d\.\d{3}) mm\b/giu,
    expected: ["55", "170", "1.180"], claims: [{ key: "Dimensiones horquillas (mm)", value: "1180x170x55 mm" }], collision: fork },
  { reference: "6744", brand: "YALE", model: "MO25X", category: "carretillas-nuevas",
    pattern: /\bhorquillas de (\d{2})\s*×\s*(\d{3})\s*×\s*(\d\.\d{3}) mm\b/giu,
    expected: ["55", "170", "1.180"], claims: [{ key: "Dimensiones horquillas (mm)", value: "1180x170x55 mm" }], collision: fork },
  { reference: "2103", brand: "HYSTER", model: "S1.0", category: "apiladores-nuevos",
    pattern: /\bhorquillas est[aá]ndar de (\d\.\d{3}) mm\b/giu,
    expected: ["1.150"], claims: [{ key: "Longitud de horquillas (mm)", value: "1150 mm" }], collision: fork },
  { reference: "4024", brand: "Tennant", model: "BCA S10", category: "limpieza-barredoras",
    pattern: /\bnivel de sonido de (\d{2}) dB\(A\)/giu,
    expected: ["70"], claims: [{ key: "Nivel sonoro", value: "70 dB(A)" }], collision: acoustic },
  { reference: "4017", brand: "Tennant", model: "FCS T20 D", category: "limpieza-fregadoras",
    pattern: /\bvelocidad de avance de hasta (\d{2}) km\/h y una velocidad en reversa de (\d{1,2},\d) km\/h\b/giu,
    expected: ["13", "6,4"], claims: [{ key: "Velocidad de avance (km/h)", value: 13 }, { key: "Velocidad de marcha atrás (km/h)", value: 6.4 }], collision: /velocidad/iu },
  { reference: "4018", brand: "Tennant", model: "T20", category: "limpieza-fregadoras",
    pattern: /\bvelocidad de avance de hasta (\d{2}) km\/h y una velocidad en reversa de (\d{1,2},\d) km\/h\b/giu,
    expected: ["13", "6,4"], claims: [{ key: "Velocidad de avance (km/h)", value: 13 }, { key: "Velocidad de marcha atrás (km/h)", value: 6.4 }], collision: /velocidad/iu },
  { reference: "4028", brand: "Tennant", model: "BCS 6100", category: "limpieza-fregadoras",
    pattern: /\btrayectoria de limpieza de (\d{3}) mm con un cepillo lateral o (\d{3}) mm con cepillos dobles\b/giu,
    expected: ["760", "970"], claims: [{ key: "Anchura de barrido con un cepillo lateral (mm)", value: 760 }, { key: "Anchura de barrido con dos cepillos laterales (mm)", value: 970 }], collision: /anchura.*barrido|ancho.*barrido/iu },
  { reference: "2649", brand: "BLYYD", model: "V2", category: "otros-nuevos",
    pattern: /\bautonom[ií]a de (\d) a (\d) horas con bater[ií]a de 55 kW\/h\b/giu,
    expected: ["5", "7"], claims: [{ key: "Autonomía máxima (h)", value: 7 }], collision: /autonom[ií]a/iu },
  { reference: "5988", brand: "YALE", model: "ERP2.0MXLG", category: "carretillas-nuevas",
    pattern: /\bdos configuraciones de bater[ií]a integrada: (115,2) V y (228) Ah, con una energ[ií]a de (26,3) kWh, y (153,6) V y (228) Ah, con una energ[ií]a de (35) kWh\b/giu,
    expected: ["115,2", "228", "26,3", "153,6", "228", "35"],
    claims: [{ key: "Batería", value: "Opciones integradas: 115,2 V / 228 Ah / 26,3 kWh; 153,6 V / 228 Ah / 35 kWh" }], collision: /bater[ií]a|voltaje|tensi[oó]n/iu }
];

const specialSweeperIdentity = (record: ProductRecord): boolean =>
  record.reference === "4024" && record.title === "Barredora industrial BCA S10" &&
  record.url === "https://online.gamrentals.com/es/tennant/4024-bca-s10" &&
  [record.shortDescription, record.longDescription].every((description) => {
    const value = (description ?? "").toLowerCase();
    return value.includes("tennant") && value.includes("bca s10");
  });

const byReference = new Map(evidence.map((entry) => [entry.reference, entry]));

export const recoverGamVerifiedUnitGeometrySpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entry = byReference.get(record.reference ?? "");
  if (!entry || record.providerId !== "gam" || record.condition !== "Nuevo" || record.brand !== entry.brand ||
    record.model !== entry.model || record.categoryKey !== entry.category || !(verifiedGamSourceVariant(record) || specialSweeperIdentity(record)) ||
    Object.keys(source).some((key) => entry.collision.test(key))) return source;

  if (record.reference === "4018" && (record.title !== "Fregadora TENNANT FCS T20 C" ||
    record.url !== "https://online.gamrentals.com/es/tennant/4018-fcs-t20-c" ||
    ![record.shortDescription, record.longDescription].every((value) =>
      (value ?? "").toLowerCase().includes("fcs t20 c")))) return source;

  const matches = [...(record.longDescription ?? "").matchAll(entry.pattern)];
  if (matches.length === 0 || matches.some((match) =>
    !entry.expected.every((value, index) => match[index + 1] === value))) return source;

  return { ...source, ...Object.fromEntries(entry.claims.map((claim) => [claim.key, claim.value])) };
};
