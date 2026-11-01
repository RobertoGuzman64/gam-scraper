import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { normalizedElectricalIdentity, verifiedGamElectricalIdentity } from "./electrical-identity-evidence.js";

const twinMotor = /\bdoble\s+motor\s+(?:el[eé]ctrico\s+)?de\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const twinConfirmation = /\b2\s*[x×]\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const lifting = /\belevaci[oó]n\s+de\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const dieselPower = /\bmotor\s+de\s+(\d{2,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const parse = (value: string): number => Number(value.replace(",", "."));
const unique = (text: string, pattern: RegExp, min: number, max: number): number | null => {
  const matches = [...text.matchAll(pattern)];
  const value = matches[0] ? parse(matches[0][1] ?? "") : null;
  return value !== null && Number.isFinite(value) && value >= min && value <= max &&
    matches.every((match) => parse(match[1] ?? "") === value) ? value : null;
};

export const recoverGamMotorConfigurationSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamElectricalIdentity(record) || record.categoryKey !== "carretillas-nuevas" ||
    normalizedElectricalIdentity(record.brand ?? "") !== "hyster" ||
    Object.keys(source).some((key) => /\bpotencia\b/iu.test(key))) return source;
  const text = record.longDescription ?? "";
  const first = unique(text, twinMotor, 1, 100);
  const confirmed = unique(text, twinConfirmation, 1, 100);
  if (first !== null && first === confirmed && /\btracci[oó]n\s+el[eé]ctrica\b/iu.test(text)) {
    return { ...source, "Potencia de tracción (kW)": `${String(first * 2).replace(".", ",")} kW` };
  }

  const lifted = unique(text, lifting, 1, 150);
  if (lifted !== null && /\b(?:motor(?:es)?\s+de\s+tracci[oó]n|tracci[oó]n\s+doble)\b[^.!?]{0,65}\b\d{1,3}\s*kW\b/iu.test(text)) {
    return { ...source, "Potencia de elevación (kW)": `${String(lifted).replace(".", ",")} kW` };
  }

  if (/\bcarretilla\s+elevadora\s+di[eé]sel\b/iu.test(record.title ?? "") &&
    /\bmotor\s+Kubota\b/iu.test(text)) {
    const power = unique(text, dieselPower, 10, 300);
    if (power !== null) return { ...source, "Potencia (kW)": `${String(power).replace(".", ",")} kW` };
  }
  return source;
};

const ormigElectricMotors = /\bmotor\s+el[eé]ctrico\s*:\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*\+\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const xcmgTwinTraction = /\bmotor\s+de\s+tracci[oó]n\s*:\s*AC\s*2\s*[x×]\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const hysterTwinTraction = /\bdoble\s+motor\s+el[eé]ctrico\s+de\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const hysterTwinConfirmation = /\bmotor\s*:\s*el[eé]ctrico\s+doble\s+2\s*[x×]\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;

export const recoverGamVerifiedTwinMotorSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamElectricalIdentity(record) ||
    Object.keys(source).some((key) => /\bpotencia\b|motor\s+de\s+tracci[oó]n/iu.test(key))) return source;
  const brand = normalizedElectricalIdentity(record.brand ?? "");
  const text = record.longDescription ?? "";
  let motor: number | null = null;
  if (brand === "ormig" && record.categoryKey === "otros-nuevos" &&
    normalizedElectricalIdentity(String(source["Tipo motor"] ?? "")) === "electrico" &&
    /\btracci[oó]n\s*:\s*frontal\b/iu.test(text) &&
    /\bmotor\s+del\s+sistema\s+hidr[aá]ulico\s*\/\s*servicios\s*:/iu.test(text)) {
    const pairs = [...text.matchAll(ormigElectricMotors)].map((match) => ({
      first: parse(match[1] ?? ""), second: parse(match[2] ?? "")
    }));
    const pair = pairs[0];
    if (pair && pair.first === pair.second && pair.first >= 1 && pair.first <= 50 &&
      pairs.every(({ first, second }) => first === pair.first && second === pair.second)) motor = pair.first * 2;
  } else if (brand === "xcmg" && record.categoryKey === "elevacion-nueva" &&
    /\bplataforma\s+elevadora\s+articulada\s+el[eé]ctrica\b/iu.test(text)) {
    const value = unique(text, xcmgTwinTraction, 1, 50);
    if (value !== null) motor = value * 2;
  } else if (brand === "hyster" && record.categoryKey === "carretillas-nuevas" &&
    normalizedElectricalIdentity(String(source["Tipo motor"] ?? "")) === "electrico") {
    const value = unique(text, hysterTwinTraction, 1, 50);
    if (value !== null && value === unique(text, hysterTwinConfirmation, 1, 50)) motor = value * 2;
  }
  return motor === null ? source : { ...source, "Potencia de tracción (kW)": `${String(motor).replace(".", ",")} kW` };
};

const enginePower = /\b(\d{1,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const mercedesEngine = /\bmotor\s+Mercedes-Benz\s+OM934(?:LA)?\b[^.!?]{0,130}?\b(\d{2,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const kubotaEngine = /\bmotor\s+(?:di[eé]sel\s+)?Kubota\b[^.!?]{0,100}?\b(\d{1,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const yuchaiEngine = /\bmotor\s*:\s*Yuchai\b[^.!?]{0,100}?\b(\d{1,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const cumminsEngine = /\bmotor\s+Cummins\s+F3\.8\s+de\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const packmatEngine = /\bmotor\s+di[eé]sel\s+de\s+4\s+cilindros\s+con\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;

export const recoverGamVerifiedEnginePowerSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamElectricalIdentity(record) || Object.keys(source).some((key) => /potencia/iu.test(key))) return source;
  const brand = normalizedElectricalIdentity(record.brand ?? "");
  const engineType = normalizedElectricalIdentity(String(source["Tipo motor"] ?? source["Motorización"] ?? ""));
  const title = normalizedElectricalIdentity(record.title ?? "");
  let pattern: RegExp | null = null;

  if (brand === "hyster" && record.categoryKey === "carretillas-nuevas" &&
    title.includes("diesel") && engineType === "diesel") {
    const conflictingManufacturer = /\b(?:MTU|Yuchai)\b|\bmotor\s+(?:di[eé]sel\s+)?Kubota\b/iu.test(record.longDescription ?? "");
    if (conflictingManufacturer) return source;
    pattern = /\bMercedes-Benz\s+OM934(?:LA)?\b/iu.test(record.longDescription ?? "") ? mercedesEngine : kubotaEngine;
  } else if (brand === "xcmg" && record.categoryKey === "elevacion-nueva" &&
    ["diesel", "hibrida"].includes(engineType)) {
    const text = record.longDescription ?? "";
    const yuchai = /\bmotor\s*:\s*Yuchai\b/iu.test(text);
    const kubota = /\bmotor\s+(?:di[eé]sel\s+)?Kubota\b/iu.test(text);
    const cummins = /\bmotor\s+Cummins\s+F3\.8\b/iu.test(text);
    if (Number(yuchai) + Number(kubota) + Number(cummins) !== 1) return source;
    pattern = yuchai ? yuchaiEngine : kubota ? kubotaEngine : cumminsEngine;
  } else if (brand === "packmat" && record.categoryKey === "otros-nuevos" &&
    engineType === "diesel") {
    pattern = packmatEngine;
  }

  if (pattern === null) return source;
  const text = record.longDescription ?? "";
  const value = unique(text, pattern, 5, 300);
  if (value === null || value !== unique(text, enginePower, 5, 300)) return source;
  return { ...source, "Potencia (kW)": `${String(value).replace(".", ",")} kW` };
};

const torque = /\bpar\s+(?:motor\s+)?(?:m[aá]ximo\s+)?(?:de\s+)?(\d{2,4}(?:\.\d{3})?)\s*N\s*[·.]?\s*m\b|\b(\d{2,4}(?:\.\d{3})?)\s*N\s*[·.]?\s*m\s+de\s+par\b/giu;
const anyTorque = /\b(\d{2,4}(?:\.\d{3})?)\s*N\s*[·.]?\s*m\b/giu;
const numericTorque = (value: string): number => Number(value.replace(/\./g, ""));

export const recoverGamVerifiedEngineTorqueSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamElectricalIdentity(record) || !["carretillas-nuevas", "elevacion-nueva", "otros-nuevos"].includes(record.categoryKey) ||
    Object.keys(source).some((key) => /\b(?:par\s+(?:motor|m[aá]ximo)|torque|momento\s+motor)\b/iu.test(key)) ||
    !normalizedElectricalIdentity(record.shortDescription ?? "").includes(normalizedElectricalIdentity(record.model ?? ""))) return source;

  const text = record.longDescription ?? "";
  const matches = [...text.matchAll(torque)];
  const mentions = [...text.matchAll(anyTorque)];
  const first = matches[0] ? numericTorque(matches[0][1] ?? matches[0][2] ?? "") : null;
  if (first === null || !Number.isInteger(first) || first < 100 || first > 2000 ||
    matches.some((match) => numericTorque(match[1] ?? match[2] ?? "") !== first) ||
    mentions.length !== matches.length || mentions.some((match) => numericTorque(match[1] ?? "") !== first)) return source;

  const brand = normalizedElectricalIdentity(record.brand ?? "");
  const engineType = normalizedElectricalIdentity(String(source["Tipo motor"] ?? source["Motorización"] ?? ""));
  const normalizedTitle = normalizedElectricalIdentity(record.title ?? "");
  const existingPower = String(source["Potencia (kW)"] ?? "");
  const engineIdentityIsUnambiguous = brand === "hyster" && record.categoryKey === "carretillas-nuevas" &&
    normalizedTitle.includes("diesel") && engineType === "diesel" && (
      (first === 750 && /\bMercedes-Benz\s+OM934(?:LA)?\b/iu.test(text) &&
        /\b129\s*kW\b/iu.test(text) && existingPower === "129 kW") ||
      (first === 373 && /\bmotor\s+Kubota\s+V3800\b/iu.test(text) &&
        /\b82\s*kW\b/iu.test(text) && existingPower === "82 kW")
    ) && !/\b(?:MTU|Yanmar|PSI|Yuchai)\b|\bmotor\s+(?:di[eé]sel\s+)?Kubota\b/iu.test(first === 750 ? text : "");
  const xcmgIdentity = brand === "xcmg" && record.categoryKey === "elevacion-nueva" &&
    engineType === "diesel" && first === 289 && /\bmotor\s+Kubota\s+V3307\b/iu.test(text) &&
    existingPower === "54,6 kW";
  const packmatIdentity = brand === "packmat" && record.categoryKey === "otros-nuevos" &&
    engineType === "diesel" && first === 225 && /\bmotor\s+di[eé]sel\s+de\s+4\s+cilindros\b/iu.test(text) &&
    existingPower === "51,7 kW";
  if (!engineIdentityIsUnambiguous && !xcmgIdentity && !packmatIdentity) return source;
  return { ...source, "Par motor (Nm)": `${first} Nm` };
};

const dieselKubota = /\bKubota\s+3[.,]8\s*L\s+Diesel\b/iu;
const kubotaPower = /\b(\d{2,3}(?:[.,]\d{1,2})?)\s*kW\b/giu;
const measuredTorque = /\bpar\s+motor\s+de\s+(\d{2,4})\s*N\s*[·.]?\s*m\b/giu;
const conflictingKubotaFuel = /\bmotor\s+(?:di[eé]sel\s+)?Kubota[^!?]{0,60}\b(?:GLP|LPG)\b/iu;
const duramatchOptions = /\btransmisi[oó]n\s+DuraMatch(?:™)?[^.!?]{0,55}\b(?:1\s+o\s+2|una\s+o\s+dos)\s+velocidades\b/iu;
const duramatchThree = /\btransmisi[oó]n\s+DuraMatch(?:™)?\s+de\s+3\s+velocidades\b/iu;
const zfThree = /\btransmisi[oó]n\s+ZF\s+3WG161\s+de\s+3\s+velocidades\s+adelante\s*\/\s*atr[aá]s\b/iu;

export const recoverGamVerifiedCombustionDriveSpecs = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamElectricalIdentity(record) || record.categoryKey !== "carretillas-nuevas" ||
    normalizedElectricalIdentity(record.brand ?? "") !== "hyster" ||
    !/\bdi[eé]sel\b/iu.test(record.title ?? "") ||
    Object.keys(source).some((key) => /\btransmisi[oó]n\b/iu.test(key))) return source;
  const text = record.longDescription ?? "";
  const engineType = String(source["Tipo motor"] ?? "");
  const declaredFuel = normalizedElectricalIdentity(String(source["Motorización"] ?? ""));
  const diesel = declaredFuel === "diesel" || normalizedElectricalIdentity(engineType) === "diesel";
  if (!diesel) return source;

  let result: SpecsMap = source;
  if (dieselKubota.test(engineType) &&
    /\bmotor\s+(?:di[eé]sel\s+)?Kubota\b/iu.test(text) &&
    !conflictingKubotaFuel.test(text) && !/\bWG3800\b/iu.test(text) &&
    !/\bmotor\s+(?:Mercedes-Benz|MTU|Yanmar|PSI|Cummins)\b/iu.test(text)) {
    const power = unique(text, kubotaPower, 20, 200);
    const existingPower = String(source["Potencia (kW)"] ?? "");
    if ((power === null && /\b\d{2,3}(?:[.,]\d{1,2})?\s*kW\b/iu.test(text)) ||
      /\btransmisi[oó]n\s+(?:autom[aá]tica\s+)?(?:ZF|Techtronix)\b/iu.test(text)) return source;
    if (existingPower !== "" && (power === null || existingPower !== `${String(power).replace(".", ",")} kW`)) return source;
    if (duramatchOptions.test(text)) {
      result = { ...result, "Transmisión": "DuraMatch (1 o 2 velocidades, según configuración)" };
    }
    if (power === 55 && !/\bpotencia\s+de\s+hasta\s+55\s*kW\b/iu.test(text)) {
      if (existingPower === "" && !Object.keys(source).some((key) => /\bpotencia\b/iu.test(key))) {
        result = { ...result, "Potencia (kW)": "55 kW" };
      }
      const motorTorque = unique(text, measuredTorque, 100, 1500);
      if (motorTorque === 308 && !Object.keys(result).some((key) => /\bpar\s+(?:motor|m[aá]ximo)\b/iu.test(key))) {
        result = { ...result, "Par motor (Nm)": "308 Nm" };
      }
    }
  } else if (engineType.trim() === "" && declaredFuel === "diesel" &&
    unique(text, kubotaPower, 20, 200) === 82 && unique(text, measuredTorque, 100, 1500) === 373 &&
    /\bmotor\s+Kubota\s+V3800\b/iu.test(text) && duramatchThree.test(text)) {
    result = { ...result, "Transmisión": "DuraMatch (3 velocidades)" };
  } else if (normalizedElectricalIdentity(engineType) === "diesel" &&
    zfThree.test(text) && !/\b(?:Mercedes-Benz|MTU|Kubota|Yanmar|GLP|LPG)\b/iu.test(text)) {
    result = { ...result, "Transmisión": "ZF 3WG161 (3 velocidades adelante/atrás)" };
  }
  return result;
};


const statedTwinTraction = /\bdos\s+motores\s+de\s+tracci[oó]n\s+de\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*kW\b/giu;

export const recoverGamStatedTwinTractionPower = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (!verifiedGamElectricalIdentity(record) || record.categoryKey !== "carretillas-nuevas" ||
    normalizedElectricalIdentity(record.brand ?? "") !== "hyster" ||
    Object.keys(source).some((key) => /potencia\s+(?:de\s+)?tracci[oó]n/iu.test(key))) return source;
  const text = record.longDescription ?? "";
  const power = unique(text, statedTwinTraction, 1, 100);
  if (power === null) return source;
  return { ...source, "Potencia de tracción (kW)": `${String(power * 2).replace(".", ",")} kW` };
};
