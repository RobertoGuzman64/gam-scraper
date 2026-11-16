import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { containsEditorialIdentity } from "../../../shared/editorial/domain/editorial-identity-match.js";

type TextChange = readonly [original: string, replacement: string];

type ManufacturerLoadEvidence = Readonly<{
  reference: string;
  url: string;
  sourceHash: string;
  brand: string;
  model: string;
  categoryKey: string;
  capacity: string;
  source: string;
  corroboration: readonly TextChange[];
  titleChanges: readonly TextChange[];
  shortChanges: readonly TextChange[];
  longChanges: readonly TextChange[];
  invalidSourceYear?: "titulo" | "url";
}>;

const verified: readonly ManufacturerLoadEvidence[] = [
  {
    reference: "50",
    url: "https://online.gamrentals.com/es/carretillas-retractiles-hyster/50-carretilla-retractil-hyster-r14",
    sourceHash: "464b777f41c3dccdaf9f04eff76cd39d73d9b1ebf8c7536e211f3f838407b926",
    brand: "HYSTER", model: "R1.4", categoryKey: "carretillas-nuevas", capacity: "1400 KG",
    source: "https://www.hyster.com/en-gb/emea/industrial-warehouse-and-manufacturing-lift-trucks/r1.4-2.5/",
    corroboration: [["Altura de elevación (mm)", "10500 mm"], ["Peso", "6861 KG"]],
    titleChanges: [], shortChanges: [["Capacidad de carga de 2000 kg", "Capacidad de carga de 1400 kg"]],
    longChanges: []
  },
  {
    reference: "2159",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-bravi/2159-plataforma-elevadora-bravi-lui-460",
    sourceHash: "c6867b075fa3f0d43bc9d3cb39d9c122af027eef80262bf00a4588cb5f0f26b2",
    brand: "BRAVI", model: "Lui 460", categoryKey: "elevacion-nueva", capacity: "280 KG",
    source: "https://www.bravi-platforms.com/en/product/lui-460/",
    corroboration: [["Altura de elevación (m)", "6,62 metros"], ["Peso", "1250 KG"]],
    titleChanges: [], shortChanges: [["capacidad de carga de 180 kg", "capacidad de carga de 280 kg"]],
    longChanges: [["peso de 508 kg", "peso de 1.250 kg"]]
  },
  {
    reference: "2237",
    url: "https://online.gamrentals.com/es/recogepedidos-yale/2237-preparapedidos-2000-k-yale-mo10l",
    sourceHash: "54eef309dc9e264eee30fd2a06e5082e635ac19b867d294a436d27a7566bb22f",
    brand: "YALE", model: "MO10L", categoryKey: "carretillas-nuevas", capacity: "1000 KG",
    source: "https://www.yale.com/es-es/emea/recogedoras-de-pedidos/mo10-25/",
    corroboration: [["Centro de carga", "600 mm"], ["Radio de giro", "1945"]],
    titleChanges: [["Preparapedidos 2000 Kg Yale MO10L", "Preparapedidos 1000 Kg Yale MO10L"]],
    shortChanges: [],
    longChanges: [["de 2000 Kg", "de 1000 Kg"], ["capacidad de carga de 2000 kilogramos", "capacidad de carga de 1000 kilogramos"]],
    invalidSourceYear: "titulo"
  },
  {
    reference: "2240",
    url: "https://online.gamrentals.com/es/recogepedidos-yale/2240-preparapedidos-2000-k-yale-mo25",
    sourceHash: "96fdda280963ceb2fed4eae7c6a0e0b8937a33d78db40bac418692a4a83169ad",
    brand: "YALE", model: "MO25", categoryKey: "carretillas-nuevas", capacity: "2500 KG",
    source: "https://www.yale.com/es-es/emea/recogedoras-de-pedidos/mo10-25/",
    corroboration: [["Centro de carga", "1200 mm"], ["Radio de giro", "3413"]],
    titleChanges: [],
    shortChanges: [["Capacidad de carga de 2000 kg", "Capacidad de carga de 2500 kg"]],
    longChanges: [["capacidad de carga de 2000 kilogramos", "capacidad de carga de 2500 kilogramos"], ["el MO10L", "el MO25"]],
    invalidSourceYear: "url"
  }
];

const compact = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const sourceHash = (record: ProductRecord): string => createHash("sha256").update(JSON.stringify([
  record.title, record.shortDescription, record.longDescription, record.specs
])).digest("hex");

const applyChanges = (value: string, changes: readonly TextChange[]): string | null => {
  let corrected = value;
  for (const [original, replacement] of changes) {
    if (!corrected.includes(original) || original === replacement) return null;
    corrected = corrected.replaceAll(original, replacement);
  }
  return corrected;
};

export const reconcileGamVerifiedManufacturerLoad = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.brand || !record.model ||
    !record.title || !record.shortDescription || !record.longDescription) return record;
  const model = record.model;
  const entry = verified.find((item) => item.reference === record.reference && item.url === record.url &&
    item.brand === record.brand && compact(item.model) === compact(model) &&
    item.categoryKey === record.categoryKey && item.capacity === record.specs?.["Capacidad de carga (kg)"]);
  if (!entry || sourceHash(record) !== entry.sourceHash || record.specs?.Marca !== entry.brand || compact(String(record.specs?.Modelo ?? "")) !== compact(entry.model) ||
    !entry.corroboration.every(([key, value]) => record.specs?.[key] === value) ||
    ![record.title, record.shortDescription, record.longDescription].every((part) =>
      part !== null && containsEditorialIdentity(part, entry.model) && containsEditorialIdentity(part, entry.brand))) return record;
  const title = applyChanges(record.title, entry.titleChanges);
  const shortDescription = applyChanges(record.shortDescription, entry.shortChanges);
  const longDescription = applyChanges(record.longDescription, entry.longChanges);
  if (title === null || shortDescription === null || longDescription === null) return record;
  const removeYear = entry.invalidSourceYear === record.yearSource && record.year === "2000" &&
    !/(?:fabricad[ao]|año de fabricaci[oó]n)\s+(?:en\s+)?(?:el\s+año\s+)?2000\b/iu.test(record.longDescription) &&
    record.specs?.["Año de fabricación"] === undefined;
  return {
    ...record, title, shortDescription, longDescription,
    ...(removeYear ? { year: null, yearSource: null } : {})
  };
};
