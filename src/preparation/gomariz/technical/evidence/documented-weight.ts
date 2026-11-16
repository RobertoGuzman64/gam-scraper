import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedEditorialUrl } from "../../../shared/editorial/domain/editorial-source-url.js";

const documentedWeights: Readonly<Record<string, { readonly weightKg: number; readonly source: string }>> = {
  "jlg:2632es": {
    weightKg: 2135,
    source: "https://www.gomarizrent.com/wp-content/uploads/2024/04/FICHA-TECNICA-JLG-2632ES.pdf"
  },
  "caterpillar:dp20kmc": {
    weightKg: 3460,
    source: "https://www.gomarizrent.com/caterpillar-dp20kmc-carretilla-elevadora-diesel-trabajos-intensivos/"
  }
};

export const reconcileGomarizDocumentedWeight = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.brand || !record.model ||
    !record.specs || typeof record.specs.Peso !== "string" ||
    record.specs["Peso operativo"] !== undefined) return record;
  const brand = record.brand.trim().toLocaleLowerCase("es");
  const model = record.model.trim().toLocaleLowerCase("es");
  const documentedBrand = record.specs.Marca;
  const documentedModel = record.specs.Modelo;
  if (documentedBrand !== undefined && (typeof documentedBrand !== "string" ||
    documentedBrand.trim().toLocaleLowerCase("es") !== brand) ||
    documentedModel !== undefined && (typeof documentedModel !== "string" ||
    documentedModel.trim().toLocaleLowerCase("es") !== model)) return record;
  const evidence = documentedWeights[`${brand}:${model}`];
  if (!evidence || record.title?.trim().toLocaleLowerCase("es") !== `${brand} ${model}` ||
    record.specs.Peso.trim() !== `${evidence.weightKg} m`) return record;
  const url = verifiedEditorialUrl(record.url, ["www.gomarizrent.com", "gomarizrent.com"]);
  if (!url || url.pathname !== `/producto/${brand}-${model}/`) return record;
  return { ...record, specs: { ...record.specs, Peso: `${evidence.weightKg} kg` } };
};
