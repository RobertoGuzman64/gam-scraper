import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { prepareProduct } from "../preparation/prepare.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/import-catalog-loader.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

export const record: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "plataformas-articuladas-diesel-segunda-mano",
  categoryName: "Maquinaria en venta", url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-M044-4093",
  title: "JLG 450 AJ", shortDescription: "Plataforma articulada diésel de ocasión.",
  longDescription: "Plataforma revisada.", price: "20.500,00 €", reference: "M044-4093",
  brand: "JLG", model: "450 AJ", year: "2013", location: "Barcelona", country: "ES",
  condition: "Segunda mano",
  horometer: "3666", serialNumber: null, image: "https://machineric.com/1.jpg",
  images: ["https://machineric.com/1.jpg", "https://machineric.com/2.jpg"],
  specs: { "Altura de trabajo": "16 m" }
};

export const documentFor = async (records: readonly ProductRecord[]) => {
  const catalog = await loadImportCatalog();
  return {
    quality: "complete" as const,
    published: true as const,
    products: records.map((record) => prepareProduct(record, catalog))
  };
};

export const readZipXml = (zip: Buffer, file: string): string => {
  let position = 0;
  while (zip.readUInt32LE(position) === 0x04034b50) {
    const method = zip.readUInt16LE(position + 8);
    const compressed = zip.readUInt32LE(position + 18);
    const nameLength = zip.readUInt16LE(position + 26);
    const extraLength = zip.readUInt16LE(position + 28);
    const name = zip.subarray(position + 30, position + 30 + nameLength).toString("utf8");
    const start = position + 30 + nameLength + extraLength;
    if (name === file) {
      assert.equal(method, 8);
      return inflateRawSync(zip.subarray(start, start + compressed)).toString("utf8");
    }
    position = start + compressed;
  }
  throw new Error(`No se encontró ${file}`);
};
