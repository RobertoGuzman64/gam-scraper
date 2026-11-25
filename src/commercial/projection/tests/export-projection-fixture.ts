import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate, ImportCatalog } from "../../legacy-export/contracts.js";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import type { BrandLogoReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { planCommercialExport } from "../export-projection.js";

export const catalog: ImportCatalog = {
  categories: [
    { id: 20, parentId: null, name: "Maquinaria de Ocasión", slug: "ocasion" },
    { id: 29, parentId: 20, name: "Articuladas", slug: "articuladas" }
  ],
  attributes: [
    { id: 115, name: "Marca", type: "TEXT", required: true, unit_option: "" },
    { id: 24, name: "Neumáticos", type: "SELECT", required: false, unit_option: "Macizos / Superelásticos" }
  ],
  relations: [{ categoryID: 29, attributeID: 115 }, { categoryID: 29, attributeID: 24 }]
};

export const logos: readonly BrandLogoReference[] = [
  { id: 16, brand: "JCB", slug: "jcb", logo: "https://example.org/jcb.png" },
  { id: 18, brand: "Otras Marcas", slug: "otras-marcas", logo: "https://example.org/otras.png" }
];

export const source = (ref: string): ProductRecord => ({
  providerId: "gam", categoryKey: "articuladas", categoryName: "Articuladas",
  url: `https://example.org/venta/${ref}`, reference: ref, externalReference: "VISIBLE-1",
  title: "Compra JCB AB123 | GAM Online", shortDescription: "Resumen acreditado",
  longDescription: "Descripción acreditada", price: null, condition: "Segunda mano",
  brand: "JCB", model: "AB123", year: null, location: null, country: null, horometer: null,
  serialNumber: null, image: "https://example.org/image.jpg", images: ["https://example.org/image.jpg"],
  specs: { Marca: "JCB", Modelo: "AB123" }
});

export const published = (record: ProductRecord): ImportCandidate => ({
  providerId: record.providerId, sourceUrl: record.url, reference: record.reference,
  externalReference: record.externalReference ?? null, title: record.title,
  categorySellID: null, category: null, condition: "Segunda_Mano", price: null,
  description_title: record.title, description: record.shortDescription,
  description_general: record.longDescription, image: record.image, images: record.images ?? [],
  spec: record.specs ?? {}, attributes: []
});

export const entry = (reference: string, categorySellID: number | null = 29): CommercialBaselineInput => {
  const original = source(reference);
  const product = published(original);
  return { source: original, published: product, mapped: { status: "ready", issues: [], product: {
    ...product, categorySellID, category: categorySellID === 29 ? "Articuladas" : null,
    attributes: [{ attributeID: 115, value: "JCB" }]
  } } };
};

export const plan = (items: readonly CommercialBaselineInput[], environment: "develop" | "production" | null = null,
  companyID: number | null = null) => planCommercialExport(items, "gam", "a".repeat(64), catalog, logos, environment, companyID);
