import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../identidad/source-variant-identity.js";

const normalized = (text: string): string => text.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const specialIdentity = (record: ProductRecord): boolean => {
  if (record.reference === "4021" && record.brand === null && record.model === "BF M20" &&
    record.title === "Barredora fregadora TENNANT BF M20" && record.specs?.["Modelo"] === "BF M20" &&
    record.url === "https://online.gamrentals.com/es/fregadoras-industriales-nuevas/4021-bf-m20") {
    return [record.shortDescription, record.longDescription].every((description) =>
      normalized(description ?? "").includes("tennantbfm20"));
  }
  if (record.reference === "6746" && record.brand === null && record.model === null &&
    record.title === "Preparapedidos 1000 Kg Yale MO10E" &&
    (record.specs?.["Capacidad de carga (kg)"] === undefined ||
      record.specs["Capacidad de carga (kg)"] === "1000 KG") &&
    record.url === "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e") {
    return [record.shortDescription, record.longDescription].every((description) =>
      normalized(description ?? "").includes("yalemo10e"));
  }
  return false;
};

const distinct = (text: string, pattern: RegExp): readonly string[] | null => {
  const matches = [...text.matchAll(pattern)];
  const first = matches[0]?.slice(1);
  return first && matches.every((match) => match.slice(1).every((part, index) => part === first[index])) ? first : null;
};

const isAbsent = (source: SpecsMap, key: string, conflicting: RegExp): boolean =>
  !Object.hasOwn(source, key) && !Object.keys(source).some((candidate) => conflicting.test(candidate));

const transmissionEvidence: Readonly<Record<string, Readonly<{ brand: string; model: string; pattern: RegExp; value: string }>>> = {
  "2079": { brand: "HYSTER", model: "H2.0FTS", pattern: /transmisi[oó]n DuraMatch™ de una velocidad/iu, value: "DuraMatch (una velocidad)" },
  "2082": { brand: "HYSTER", model: "H2.5A6", pattern: /transmisi[oó]n Electronic Powershift Duramatch™ de una velocidad/iu, value: "Electronic Powershift DuraMatch (una velocidad)" },
  "2072": { brand: "HYSTER", model: "S4.0FT", pattern: /transmisi[oó]n DuraMatch™ de una o dos velocidades/iu, value: "DuraMatch (una o dos velocidades; según configuración)" },
  "2073": { brand: "HYSTER", model: "S4.5FT", pattern: /transmisi[oó]n DuraMatch™ de 2 velocidades/iu, value: "DuraMatch (dos velocidades)" },
  "2074": { brand: "HYSTER", model: "S5.5FTS", pattern: /transmisi[oó]n DuraMatch™ de 2 velocidades/iu, value: "DuraMatch (dos velocidades)" },
  "2075": { brand: "HYSTER", model: "S6.0FT", pattern: /transmisi[oó]n DuraMatch™ \(1 o 2 velocidades\)/iu, value: "DuraMatch (una o dos velocidades; según configuración)" },
  "2091": { brand: "HYSTER", model: "H6.0FT", pattern: /transmisi[oó]n DuraMatch™ de hasta 3 velocidades/iu, value: "DuraMatch (hasta tres velocidades; según configuración)" },
  "2092": { brand: "HYSTER", model: "H7.0FT", pattern: /transmisi[oó]n DuraMatch™ de hasta 3 velocidades/iu, value: "DuraMatch (hasta tres velocidades; según configuración)" },
  "2093": { brand: "HYSTER", model: "H7.0FTS", pattern: /transmisi[oó]n DuraMatch™ de hasta 3 velocidadesgarantiza/iu, value: "DuraMatch (hasta tres velocidades; según configuración)" },
  "2095": { brand: "HYSTER", model: "H8.0FTS", pattern: /transmisi[oó]n DuraMatch™ de 2 o 3 velocidades/iu, value: "DuraMatch (dos o tres velocidades; según configuración)" },
  "2369": { brand: "YALE", model: "GP90VX", pattern: /transmisi[oó]n Techtronix™ \/ DuraMatch™ 3 de 3 velocidades/iu, value: "Techtronix / DuraMatch 3 (tres velocidades)" },
};

export const recoverGamVerifiedResidualOperationSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !(verifiedGamSourceVariant(record) || specialIdentity(record))) return source;

  const text = record.longDescription ?? "";
  const reference = record.reference;
  if (reference === "5998" && record.categoryKey === "carretillas-nuevas" &&
    isAbsent(source, "Altura al suelo (mm)", /altura.*suelo|distancia.*suelo|despeje/iu)) {
    const match = distinct(text, /\baltura libre al suelo de hasta (\d{2,3}) mm\b/giu);
    if (match?.[0] === "186") return { ...source, "Altura al suelo (mm)": "186 mm" };
  }
  if (reference === "6991" && record.categoryKey === "marcas-nuevas" &&
    isAbsent(source, "Longitud de horquillas (mm)", /longitud.*horquillas|horquillas.*longitud/iu)) {
    const match = distinct(text, /\bhorquillas de (\d{1,2}\.\d{3}) mm\b/giu);
    if (match?.[0] === "1.150") return { ...source, "Longitud de horquillas (mm)": "1150 mm" };
  }
  if ((reference === "6480" || reference === "6481") && record.categoryKey === "apiladores-nuevos" &&
    isAbsent(source, "AST (mm)", /\bAST\b|pasillo/iu)) {
    const match = distinct(text, /\bancho de pasillo de trabajo de (\d{1,2}\.\d{3}) mm a (\d{1,2}\.\d{3}) mm\b/giu);
    if (match?.[0] === "2.217" && match[1] === "2.290") return { ...source, "AST (mm)": "2217 / 2290 mm" };
  }
  if (reference === "2332" && record.categoryKey === "marcas-nuevas" && record.brand === "YALE" &&
    record.model === "MO50T" && /tractor el[eé]ctrico de arrastre/iu.test(record.title ?? "") &&
    isAbsent(source, "Capacidad de arrastre (kg)", /arrastre|remolque/iu)) {
    const match = distinct(text, /\bcapacidad de arrastre de hasta (\d{1,2},\d{3}) kg\b/giu);
    if (match?.[0] === "5,000" && source["Capacidad de carga (kg)"] === "5000 KG") {
      return { ...source, "Capacidad de arrastre (kg)": "5000 KG" };
    }
  }
  if (reference === "6573" && record.categoryKey === "carretillas-nuevas" &&
    isAbsent(source, "Dimensiones horquillas (mm)", /dimensiones.*horquillas|longitud.*horquillas/iu)) {
    const match = distinct(text, /\bdimensiones de horquillas est[aá]ndar de (\d{2})\s*\/\s*(\d{3})\s*\/\s*(\d{4}) mm\b/giu);
    if (match?.[0] === "40" && match[1] === "120" && match[2] === "1150") {
      return { ...source, "Dimensiones horquillas (mm)": "1150x120x40 mm" };
    }
  }
  if (["4844", "4845", "6547"].includes(reference) && record.categoryKey === "elevacion-nueva" &&
    isAbsent(source, "Rotación de cesta", /rotaci[oó]n.*cesta|giro.*cesta/iu)) {
    if (reference === "6547") {
      const match = distinct(text, /\brotaci[oó]n de cesta (\d{2})°\s*\+\s*(\d{2})°/giu);
      if (match?.[0] === "60" && match[1] === "60") return { ...source, "Rotación de cesta": "60° + 60°" };
    } else {
      const pattern = reference === "4844" ?
        /\brotaci[oó]n de cesta de (\d{2})° a izquierda y derecha\b/giu :
        /\brotaci[oó]n de cesta de (\d{2})° a cada lado\b/giu;
      const match = distinct(text, pattern);
      if (match?.[0] === "90") return { ...source, "Rotación de cesta": "90° a cada lado" };
    }
  }
  if (["6326", "6327"].includes(reference) && record.categoryKey === "carretillas-nuevas" &&
    isAbsent(source, "Velocidad de desplazamiento (km/h)", /velocidad/iu)) {
    const match = distinct(text, /\bvelocidad de desplazamiento hasta (\d{2})[–-](\d{2}) km\/h\b/giu);
    if (match?.[0] === "15" && match[1] === "16") {
      return { ...source, "Velocidad de desplazamiento (km/h)": "15–16 km/h (rango publicado)" };
    }
  }
  if (reference === "5903" && record.categoryKey === "marcas-nuevas" &&
    isAbsent(source, "Radio de giro (mm)", /radio.*giro/iu)) {
    const match = distinct(text, /\bradio de giro exterior:\s*(\d\.\d{3}) mm\s+radio de giro interior:\s*(\d+) mm\b/giu);
    if (match?.[0] === "1.020" && match[1] === "0") return { ...source, "Radio de giro (mm)": "1020 mm" };
  }
  if (reference === "2094" && record.categoryKey === "carretillas-nuevas" &&
    isAbsent(source, "Consumo", /consumo/iu)) {
    const match = distinct(text, /\bseg[uú]n el ciclo VDI, el consumo medio es de (\d{1,2}[.,]\d) l\/h\b/giu);
    if (match?.[0] === "6,2") return { ...source, "Consumo": "6,2 l/h (ciclo VDI)" };
  }
  if (["2024", "2367", "2076", "6990"].includes(reference) &&
    ["carretillas-nuevas", "marcas-nuevas"].includes(record.categoryKey) &&
    isAbsent(source, "Neumáticos", /neum[aá]ticos?|ruedas?|rodadura/iu)) {
    const pattern = reference === "2024" || reference === "2367" ? /\bruedas de (bandaje)\b/giu :
      reference === "6990" ? /\bruedas de (poliuretano)\b/giu : /\bruedas (superel[aá]sticas)\b/giu;
    const match = distinct(text, pattern);
    const expected = reference === "2024" || reference === "2367" ? "bandaje" :
      reference === "6990" ? "poliuretano" : "superelásticas";
    if (match?.[0]?.toLowerCase() === expected) {
      return { ...source, [reference === "6990" ? "Ruedas" : "Neumáticos"]: expected === "bandaje" ? "De bandaje" :
        expected === "poliuretano" ? "Poliuretano" : "Superelásticos" };
    }
  }
  if (reference === "6272" && record.categoryKey === "carretillas-nuevas" &&
    isAbsent(source, "Radio de giro exterior", /radio.*giro/iu)) {
    const match = distinct(text, /\bradio de giro externo cercano a (\d\.\d{3}) mm \(seg[uú]n configuraci[oó]n\)/giu);
    if (match?.[0] === "4.874") return { ...source, "Radio de giro exterior": "≈ 4874 mm (según configuración)" };
  }
  if (reference === "4021" && record.categoryKey === "limpieza-barredoras" &&
    isAbsent(source, "Nivel sonoro", /ruido|sonoro|ac[uú]stic/iu)) {
    const match = distinct(text, /\bnivel de ruido de tan solo (\d{2,3}) dBA\b/giu);
    if (match?.[0] === "84") return { ...source, "Nivel sonoro": "84 dBA" };
  }
  if (reference === "6746" && record.categoryKey === "carretillas-nuevas" &&
    isAbsent(source, "Nivel sonoro", /ruido|sonoro|ac[uú]stic/iu)) {
    const match = distinct(text, /\bnivel de presi[oó]n sonora indicado por Yale es inferior a (\d{2}) dB\(A\) en el puesto de conducci[oó]n\b/giu);
    if (match?.[0] === "70") return { ...source, "Nivel sonoro": "< 70 dB(A) (puesto de conducción)" };
  }
  if (reference === "4790" && record.categoryKey === "elevacion-nueva" &&
    record.brand === "XCMG" && record.model === "XGS40K" &&
    isAbsent(source, "Radio de giro exterior", /radio.*giro/iu)) {
    const match = distinct(text, /\bradio de giro exterior:\s*(\d{2},\d) m \(dos ruedas\) \/ (\d,\d) m \(cuatro ruedas\)/giu);
    if (match?.[0] === "10,8" && match[1] === "6,8") {
      return { ...source, "Radio de giro exterior": "10,8 m (dos ruedas); 6,8 m (cuatro ruedas)" };
    }
  }
  const transmission = transmissionEvidence[reference];
  if (transmission && record.categoryKey === "carretillas-nuevas" &&
    record.brand === transmission.brand && record.model === transmission.model &&
    isAbsent(source, "Transmisión", /transmisi[oó]n/iu) &&
    transmission.pattern.test(text)) {
    return { ...source, Transmisión: transmission.value };
  }
  if (reference === "5900" && record.categoryKey === "elevacion-nueva" &&
    record.brand === "XCMG" && record.model === "XGA36K" &&
    isAbsent(source, "Radio de giro (mm)", /radio.*giro/iu)) {
    const match = distinct(text, /radio de giro m[ií]nimo:\s*(7,5) m/giu);
    if (match?.[0] === "7,5") return { ...source, "Radio de giro (mm)": "7500 mm" };
  }
  if ((reference === "2136" || reference === "2137") && record.categoryKey === "marcas-nuevas" &&
    record.brand === "HYSTER" && record.model === (reference === "2136" ? "P1.6" : "P1.8") &&
    isAbsent(source, "Consumo", /consumo/iu)) {
    const match = distinct(text, /(?:consumo (?:de energ[ií]a|energ[eé]tico) \(0,(32|36) kWh\/h\))/giu);
    if (match?.[0] === (reference === "2136" ? "32" : "36")) {
      return { ...source, Consumo: `0,${match[0]} kWh/h (dato del proveedor)` };
    }
  }
  if (reference === "6368" && record.categoryKey === "otros-nuevos" &&
    record.brand === "YALE" && record.model === "MO70T" &&
    isAbsent(source, "Batería", /bater[ií]a|voltaje|capacidad.*ah/iu) &&
    /bater[ií]a de 24V \/ 620Ah \(con alternativa disponible de 465Ah\)/iu.test(text)) {
    return { ...source, "Batería": "24 V / 620 Ah (alternativa de 465 Ah)" };
  }
  return source;
};
