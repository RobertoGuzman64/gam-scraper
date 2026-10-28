import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

interface VerifiedModel {
  readonly reference: string;
  readonly model: string;
  readonly capacity: string;
  readonly url: string;
  readonly sourceSpecHash: string;
  readonly sourceDescriptionHash: string;
  readonly preparedSpecHash: string;
  readonly preparedDescriptionHash: string;
}

const evidence: readonly VerifiedModel[] = [
  {
    reference: "2072",
    model: "S4.0FT",
    capacity: "4000",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/2072-carretilla-elevadora-diesel-hyster-s40ft",
    sourceSpecHash: "3d8419f8c4d0a1058355d7040e5364c9c3a707710b6b1e8ad0110a0d36dbe019",
    sourceDescriptionHash: "e196d3aa40c40d48467eec5f294381fdcea2b843c33e1ad8a0eb775942cb40df",
    preparedSpecHash: "d7208dcd6f5bbb62d0463078705d5e9a7dd0525e8d4a0d4f0d81dd54abc9d558",
    preparedDescriptionHash: "53121ba1907a390b6d28a4f490d4748c204282213a80b6f490857934cf281e47"
  },
  {
    reference: "2073",
    model: "S4.5FT",
    capacity: "4500",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/2073-carretilla-elevadora-diesel-hyster-s45ft",
    sourceSpecHash: "7e51ac4ce72f885a74d4bc04e53e98264284bdc3982fe6661a062d7ea2b192f4",
    sourceDescriptionHash: "f402231d419481882681aaa9a4c5c5eff58c53cef097a43b7483f318d31b61c7",
    preparedSpecHash: "4c9692e45e1c305eac0c76b2afd731d13802163caf091592fa09991651935d77",
    preparedDescriptionHash: "f402231d419481882681aaa9a4c5c5eff58c53cef097a43b7483f318d31b61c7"
  }
];

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const sourceTitle = (item: VerifiedModel): string =>
  `Carretilla elevadora diésel ${item.capacity}Kg Hyster ${item.model}`;

const preparedTitle = (item: VerifiedModel): string =>
  `Carretilla elevadora GLP ${item.capacity}Kg Hyster ${item.model}`;

const sourceSummary = (item: VerifiedModel): string =>
  `➨ HYSTER ${item.model} ➨ Venta de Carretilla Elevadora Diésel 5,3 metros ⭐Capacidad de carga de ${item.capacity} kg`;

const preparedSummary = (item: VerifiedModel): string =>
  `➨ HYSTER ${item.model} ➨ Venta de Carretilla Elevadora GLP 5,3 metros ⭐Capacidad de carga de ${item.capacity} kg`;

const identified = (record: ProductRecord, item: VerifiedModel): boolean =>
  record.providerId === "gam" && record.reference === item.reference &&
  record.categoryKey === "carretillas-nuevas" && record.condition === "Nuevo" &&
  record.url === item.url && record.brand === "HYSTER" && record.model === item.model &&
  record.specs?.["Marca"] === "HYSTER" && record.specs?.["Modelo"] === item.model &&
  record.specs?.["Tipo motor"] === "Kubota 3.8L LPG" &&
  record.specs?.["Capacidad de carga (kg)"] === `${item.capacity} KG`;

const prepareDescription = (record: ProductRecord, item: VerifiedModel): string | null => {
  if (!record.longDescription) return null;
  if (item.reference !== "2072") return record.longDescription;
  return record.longDescription
    .replace("impulsada por GLP o diésel", "impulsada por GLP")
    .replace(
      "El modelo estándar S4.0FT está diseñado para GLP (gas licuado de petróleo), aunque en configuraciones especiales puede utilizar diésel.",
      "El modelo S4.0FT está diseñado para GLP (gas licuado de petróleo)."
    )
    .replace(" Sí, especialmente la versión GLP, que emite menos gases y rinde de forma segura en entornos ventilados.", "");
};

export const reconcileGamVerifiedHysterSGlp = (record: ProductRecord): ProductRecord => {
  const item = evidence.find((entry) => entry.reference === record.reference);
  if (!item || !identified(record, item) || record.title !== sourceTitle(item) ||
    record.shortDescription !== sourceSummary(item) ||
    record.specs?.["Motorización"] !== "Diésel" ||
    !record.longDescription || digest(record.longDescription) !== item.sourceDescriptionHash ||
    digest(JSON.stringify(record.specs)) !== item.sourceSpecHash) return record;

  const description = prepareDescription(record, item);
  if (!description || digest(description) !== item.preparedDescriptionHash) return record;

  return {
    ...record,
    title: preparedTitle(item),
    shortDescription: preparedSummary(item),
    longDescription: description,
    specs: { ...record.specs, Motorización: "GLP" }
  };
};

export const isGamVerifiedHysterSGlp = (record: ProductRecord): boolean => {
  const item = evidence.find((entry) => entry.reference === record.reference);
  return item !== undefined && identified(record, item) &&
    record.title === preparedTitle(item) && record.shortDescription === preparedSummary(item) &&
    record.specs?.["Motorización"] === "GLP" &&
    typeof record.longDescription === "string" &&
    digest(record.longDescription) === item.preparedDescriptionHash &&
    digest(JSON.stringify(record.specs)) === item.preparedSpecHash;
};
