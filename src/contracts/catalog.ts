export type SpecScalar = string | number | boolean;
export type SpecValue = SpecScalar | readonly SpecScalar[];
export type SpecsMap = Readonly<Record<string, SpecValue>>;

export type ProductRecord = {
  readonly providerId: string;
  readonly categoryKey: string;
  readonly categoryName: string;
  readonly url: string;
  readonly title: string | null;
  readonly shortDescription: string | null;
  readonly longDescription: string | null;
  readonly price: string | null;
  readonly priceText?: string | null;
  readonly condition?: "Nuevo" | "Segunda mano" | null;
  readonly breadcrumbs?: readonly string[];
  readonly subcategory?: string | null;
  readonly externalReference?: string | null;
  readonly shortDescriptionHtml?: string | null;
  readonly longDescriptionHtml?: string | null;
  readonly technicalSheetUrl?: string | null;
  readonly scrapedAt?: string;
  readonly yearSource?: "ficha" | "descripcion" | "titulo" | "url" | null;
  readonly reference: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly year: string | null;
  readonly location: string | null;
  readonly country: string | null;
  readonly horometer: string | null;
  readonly serialNumber: string | null;
  readonly image: string | null;
  readonly images?: readonly string[];
  readonly specs?: SpecsMap;
};

export type DedupeReason = "reference" | "serialNumber" | "canonicalUrl";

export type DedupeReport = {
  readonly kept: number;
  readonly removed: number;
  readonly byReason: Readonly<Record<DedupeReason, number>>;
};

