import type { CategoryScrapeResult } from "../../../contracts/scraping.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

export const url = "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093";
export const base: ProductRecord = {
  providerId: "mercaeleva",
  categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta",
  url,
  title: "JLG 450 AJ",
  shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.",
  price: "20.500,00 €",
  reference: "M044-4093",
  brand: "JLG",
  model: "450 AJ",
  year: "2013",
  location: "Barcelona",
  country: "ES",
  horometer: "3666",
  serialNumber: null,
  condition: "Segunda mano",
  image: "https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/1.jpg",
  images: [
    "https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/1.jpg",
    "https://files2.machineric.com/clients/mercaeleva/machines/M044-4093/public/2.jpeg"
  ],
  specs: { "Altura de trabajo": "16 m" }
};

const category = { key: base.categoryKey, name: base.categoryName, url: "https://example.org/productos" };
export const result = (product: ProductRecord, failures: CategoryScrapeResult["failures"] = []): CategoryScrapeResult => ({
  category,
  products: [product],
  discoveredProductUrls: 1,
  failures
});
