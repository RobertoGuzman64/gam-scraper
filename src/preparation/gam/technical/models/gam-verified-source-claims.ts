import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { containsEditorialIdentity } from "../../../shared/editorial/domain/editorial-identity-match.js";

type TextReplacement = readonly [source: string, verified: string];

type VerifiedSourceClaim = Readonly<{
  reference: string;
  url: string;
  sourceHash: string;
  brand: string;
  model: string;
  categoryKey: string;
  condition: string;
  specKey: string;
  specValue: string;
  corroboration: readonly (readonly [key: string, value: string])[];
  evidenceUrl: string;
  shortChanges: readonly TextReplacement[];
  longChanges: readonly TextReplacement[];
}>;

const verified: readonly VerifiedSourceClaim[] = [
  {
    reference: "4778",
    url: "https://online.gamrentals.com/es/plataforma-articulada-hibrida-xcmg/4778-plataforma-articulada-hibrida-xcmg-xga16h",
    sourceHash: "d7fe98921f9b2ff943db4e0ba28c9388a879ae9d92f561c84235081de02f0f20",
    brand: "XCMG", model: "XGA16H", categoryKey: "elevacion-nueva", condition: "Nuevo",
    specKey: "Capacidad de carga (kg)", specValue: "320 KG",
    corroboration: [["Tipo motor", "Híbrida"], ["Peso", "8200 KG"]],
    evidenceUrl: "https://xcmguk.com/product/articulated-boom-lift-xga16h/",
    shortChanges: [],
    longChanges: [
      ["Su capacidad de carga de 230 kg permite", "Su capacidad de carga de 320 kg permite"],
      ["puede transportar hasta 230 kg", "puede transportar hasta 320 kg"]
    ]
  },
  {
    reference: "3189",
    url: "https://online.gamrentals.com/es/manipuladores-de-contenedores-vacios-hyster/3189-manipulador-de-contenedores-hyster-h48xd-ch",
    sourceHash: "fec614f53482b2da649c4e94e7cd9a9f0dc1949e0fbe29b9b3af773858797637",
    brand: "HYSTER", model: "H50XD-CH", categoryKey: "marcas-nuevas", condition: "Nuevo",
    specKey: "Capacidad de carga (kg)", specValue: "41000 KG",
    corroboration: [["Peso", "74535 KG"], ["Altura de elevación (m)", "17,3 metros"]],
    evidenceUrl: "https://www.hyster.com/globalassets/coms/hyster/apac/product%20brochures/container-handler/5021hgc5sp001_e_en-sg_v2r5_052023_h40-52xd-ch-tech-guide_web.pdf",
    shortChanges: [["Capacidad de carga de 6000 kg", "Capacidad de carga de 41000 kg"]],
    longChanges: []
  },
  {
    reference: "6723",
    url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6723-2019-toyota-lwe180-",
    sourceHash: "9e0566f83d36edaba5b3833121d503fcaa3605adbce0cc1978b6cc32ae062825",
    brand: "TOYOTA", model: "LWE180", categoryKey: "manutencion", condition: "Segunda mano",
    specKey: "Capacidad de carga (kg)", specValue: "1800 KG",
    corroboration: [["Nº de serie", "6657641"], ["Horómetro", "Horometro sustituido horas"]],
    evidenceUrl: "https://baltic.toyota-forklifts.eu/our-products/powered-pallet-trucks/",
    shortChanges: [["Capacidad de carga de 1900 kg", "Capacidad de carga de 1800 kg"]],
    longChanges: [["capacidad de carga de 1900 kg", "capacidad de carga de 1800 kg"]]
  },
  {
    reference: "6702",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6702-2019-hyster-h35ft",
    sourceHash: "57f10adeaf793ad96c7a05d1db02fdc921540352b4b91745d40cd5c8b3d2c71b",
    brand: "HYSTER", model: "H3.5FT", categoryKey: "manutencion", condition: "Segunda mano",
    specKey: "Altura de elevación (mm)", specValue: "3600 mm",
    corroboration: [["Nº de serie", "P177B09051T"], ["Capacidad de carga (kg)", "3500 KG"]],
    evidenceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6702-2019-hyster-h35ft",
    shortChanges: [],
    longChanges: [["altura de elevación de 4,6 metros", "altura de elevación de 3,6 metros"]]
  },
  {
    reference: "3134",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/3134-carretilla-elevadora-diesel-hyster-h50ut6",
    sourceHash: "8df41de515d73c5c716473b8324003c10dc8d5030f70286a095376463dbe0db7",
    brand: "HYSTER", model: "H5.0UT6", categoryKey: "carretillas-nuevas", condition: "Nuevo",
    specKey: "Altura de elevación (mm)", specValue: "4700 mm",
    corroboration: [["Capacidad de carga (kg)", "5000 KG"], ["Centro de carga", "600 mm"]],
    evidenceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/3134-carretilla-elevadora-diesel-hyster-h50ut6",
    shortChanges: [],
    longChanges: [["altura de elevación de 4.4 metros", "altura de elevación de 4,7 metros"]]
  }
];

const sourceHash = (record: ProductRecord): string => createHash("sha256").update(JSON.stringify([
  record.title, record.shortDescription, record.longDescription, record.specs
])).digest("hex");

const replaceOnce = (value: string, replacements: readonly TextReplacement[]): string | null => {
  let text = value;
  for (const [from, to] of replacements) {
    const index = text.indexOf(from);
    if (!from || index < 0 || index !== text.lastIndexOf(from) || from === to) return null;
    text = `${text.slice(0, index)}${to}${text.slice(index + from.length)}`;
  }
  return text;
};

export const reconcileGamVerifiedSourceClaims = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !record.brand || !record.model || !record.title ||
    !record.shortDescription || !record.longDescription || !record.specs) return record;
  const evidence = verified.find((item) => item.reference === record.reference && item.url === record.url &&
    item.brand === record.brand && item.model === record.model && item.condition === record.condition &&
    item.categoryKey === record.categoryKey);
  if (!evidence || sourceHash(record) !== evidence.sourceHash ||
    record.specs.Marca !== evidence.brand || record.specs.Modelo !== evidence.model ||
    record.specs[evidence.specKey] !== evidence.specValue ||
    !evidence.corroboration.every(([key, value]) => record.specs?.[key] === value) ||
    ![record.title, record.shortDescription, record.longDescription].every((text) =>
      containsEditorialIdentity(text ?? "", evidence.model)) ||
    !containsEditorialIdentity(record.title, evidence.brand) ||
    !containsEditorialIdentity(record.longDescription, evidence.brand)) return record;
  const shortDescription = replaceOnce(record.shortDescription, evidence.shortChanges);
  const longDescription = replaceOnce(record.longDescription, evidence.longChanges);
  if (shortDescription === null || longDescription === null) return record;
  return { ...record, shortDescription, longDescription };
};
