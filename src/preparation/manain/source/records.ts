import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ManainStocklist, ManainStocklistProduct } from "./stocklist.js";
import { matchingManainHistoricalSpecs, type ManainHistoricalTechnicalEvidence } from "../technical/evidence/historical.js";

export const manainStocklistProductRecord = (entry: ManainStocklistProduct): ProductRecord => ({
  providerId: "manain",
  categoryKey: entry.familia,
  categoryName: entry.familia,
  url: entry.url,
  title: `${entry.marca} ${entry.modelo}`,
  shortDescription: null,
  longDescription: null,
  price: entry.precio_eur === null ? null : `${entry.precio_eur} €`,
  condition: entry.estado === "Nueva" ? "Nuevo" : "Segunda mano",
  reference: entry.referencia,
  brand: entry.marca,
  model: entry.modelo,
  year: entry.anio === null ? null : String(entry.anio),
  location: null,
  country: null,
  horometer: String(entry.horas),
  serialNumber: null,
  image: null
});

export const manainStocklistRecords = (
  source: ManainStocklist, historical?: ManainHistoricalTechnicalEvidence
): readonly ProductRecord[] => {
  const evidence = new Map(historical?.entries.map((entry) => [entry.reference, entry]) ?? []);
  return source.productos.map((entry) => {
    const product = manainStocklistProductRecord(entry);
    const specs = matchingManainHistoricalSpecs(entry, evidence.get(entry.referencia));
    return specs === null ? product : { ...product, specs };
  });
};
