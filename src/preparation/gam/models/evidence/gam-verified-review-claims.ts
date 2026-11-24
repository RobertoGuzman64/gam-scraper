import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { reconcileGamVerifiedUnitYear } from "../../reconciliation/gam-verified-unit-year.js";

type Replacement = readonly [source: string, verified: string];

type VerifiedSourceCorrection = Readonly<{
  reference: string;
  url: string;
  sourceHash: string;
  brand: string;
  model: string;
  categoryKey: string;
  condition: string;
  evidenceUrl: string;
  corroboration: readonly (readonly [key: string, value: string])[];
  titleChange?: Replacement;
  shortChange?: Replacement;
  longChange?: Replacement;
  specChange?: readonly [key: string, source: string, verified: string];
  capacityYearCollision?: string;
  requiresVerifiedYear?: boolean;
}>;

const verified: readonly VerifiedSourceCorrection[] = [
  {
    reference: "6909",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6909-2008-sky-jack-sjiii-3220m",
    sourceHash: "cf1c16b86442adc8d3625b1b86cc2f1ea7917a532ca49ab8f1ebc49258430b46",
    brand: "SKYJACK", model: "SJIII-3220M", categoryKey: "elevacion", condition: "Segunda mano",
    evidenceUrl: "https://www.ashbrook.ltd/wp-content/uploads/2025/06/SKYJACK-SJIII-3219.pdf",
    corroboration: [["Nº de serie", "M600150"], ["Peso", "1583 KG"], ["Capacidad de carga (kg)", "400 KG"]],
    requiresVerifiedYear: true,
    titleChange: ["SKY JACK SJIII-3220", "SKY JACK SJIII-3220M"],
    shortChange: ["SKY JACK SJIII-3220", "SKY JACK SJIII-3220M"]
  },
  {
    reference: "241",
    url: "https://online.gamrentals.com/es/transpaletas-logitrans/241-transpaleta-manual-2000-kg-logitrans-panther-inoxidable-parcial",
    sourceHash: "ef0b3f2204639706dcace40e6d709668edb4c159af858d48494564bbb747966d",
    brand: "LOGITRANS", model: "Panther Inox", categoryKey: "marcas-nuevas", condition: "Nuevo",
    evidenceUrl: "https://logitrans.com/US/panther-manual-pallet-truck-inox-pi/",
    corroboration: [["Capacidad de carga (kg)", "2000 KG"]],
    capacityYearCollision: "2000",
    titleChange: ["Logitrans Panther Inoxidable Parcial", "Logitrans Panther Inox (inoxidable parcial)"],
    shortChange: ["Logitrans Panther Inoxidable Parcial", "Logitrans Panther Inox (inoxidable parcial)"]
  },
  {
    reference: "2071",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/2071-carretilla-elevadora-diesel-hyster-h18xd-9",
    sourceHash: "8f19a2aa705f80295bc91210cc313d7add0214442097e4a56f09a298eed8a35c",
    brand: "HYSTER", model: "H18XD-9", categoryKey: "carretillas-nuevas", condition: "Nuevo",
    evidenceUrl: "https://www.lectura-specs.es/es/modelo/carretillas-elevadoras/carretillas-elevadoras-diesel-hyster/h18xd-9-11770818",
    corroboration: [["Motorización", "Diésel"], ["Capacidad de carga (kg)", "18200 KG"]],
    specChange: ["Tipo motor", "Kubota 3.8L LPG", "Mercedes-Benz OM934 Diésel"]
  },
  {
    reference: "2211",
    url: "https://online.gamrentals.com/es/carretillas-elevadora-diesel-yale/2211-carretilla-frontal-diesel-yale-gdp160ef12",
    sourceHash: "452e9b1485477c352753a3d014085678ac1e3d2902124bd482f1d336fe1434e0",
    brand: "YALE", model: "GDP160EF12", categoryKey: "carretillas-nuevas", condition: "Nuevo",
    evidenceUrl: "https://www.yale.com/es-es/emea/carretillas-elevadoras-de-combustion-interna-de-gran-capacidad/gdp80-160dfef/",
    corroboration: [["Motorización", "Diésel"], ["Tipo motor", "Cummins QSB 6.7L Diesel"]],
    specChange: ["Capacidad de carga (kg)", "16000 KG", "16400 KG"],
    longChange: ["16000 kg (16 toneladas)", "16400 kg (16,4 toneladas)"]
  }
];

const sourceHash = (record: ProductRecord): string => createHash("sha256").update(JSON.stringify([
  record.title, record.shortDescription, record.longDescription, record.specs
])).digest("hex");

const replaceOnce = (text: string, replacement: Replacement | undefined): string | null => {
  if (!replacement) return text;
  const [source, verified] = replacement;
  const index = text.indexOf(source);
  if (!source || source === verified || index < 0 || index !== text.lastIndexOf(source)) return null;
  return `${text.slice(0, index)}${verified}${text.slice(index + source.length)}`;
};

export const reconcileGamVerifiedReviewClaims = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !record.reference || !record.brand || !record.model ||
    !record.title || !record.shortDescription || !record.longDescription || !record.specs) return record;
  const evidence = verified.find((item) => item.reference === record.reference && item.url === record.url &&
    item.brand === record.brand && item.model === record.model && item.categoryKey === record.categoryKey &&
    item.condition === record.condition);
  if (!evidence || sourceHash(record) !== evidence.sourceHash ||
    record.specs.Marca !== evidence.brand || record.specs.Modelo !== evidence.model ||
    !evidence.corroboration.every(([key, value]) => record.specs?.[key] === value) ||
    (evidence.specChange && record.specs[evidence.specChange[0]] !== evidence.specChange[1])) return record;
  const correctedYear = evidence.requiresVerifiedYear ? reconcileGamVerifiedUnitYear(record) : record;
  if (evidence.requiresVerifiedYear && correctedYear === record) return record;
  const capacityYearCollision = evidence.capacityYearCollision;
  if (capacityYearCollision && (record.year !== capacityYearCollision || record.yearSource !== "titulo" ||
    !record.title.includes(`${capacityYearCollision} kg`) ||
    !record.shortDescription.includes(`${capacityYearCollision} kg`))) return record;
  const title = replaceOnce(correctedYear.title ?? "", evidence.titleChange);
  const shortDescription = replaceOnce(correctedYear.shortDescription ?? "", evidence.shortChange);
  const longDescription = replaceOnce(correctedYear.longDescription ?? "", evidence.longChange);
  if (title === null || shortDescription === null || longDescription === null) return record;
  return {
    ...correctedYear,
    ...(capacityYearCollision ? { year: null, yearSource: null } : {}),
    title,
    shortDescription,
    longDescription,
    specs: evidence.specChange ? { ...record.specs, [evidence.specChange[0]]: evidence.specChange[2] } : record.specs
  };
};
