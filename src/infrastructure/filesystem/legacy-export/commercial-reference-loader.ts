import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export type BrandLogoReference = {
  readonly id: number;
  readonly brand: string;
  readonly slug: string;
  readonly logo: string;
};
export type CommercialEnvironment = "develop" | "production";
export type CommercialReference = {
  readonly brandLogos: readonly BrandLogoReference[];
  readonly companies: Readonly<Record<string, Readonly<Record<CommercialEnvironment, number>>>>;
  readonly logoRaw: string;
  readonly companyRaw: string;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const logo = (value: unknown): value is BrandLogoReference => record(value) &&
  Number.isSafeInteger(value.id) && Number(value.id) > 0 && typeof value.brand === "string" &&
  value.brand.trim().length > 0 && typeof value.slug === "string" && typeof value.logo === "string";

const companyIds = (value: unknown): value is Readonly<Record<CommercialEnvironment, number>> => record(value) &&
  Number.isSafeInteger(value.develop) && Number(value.develop) > 0 &&
  Number.isSafeInteger(value.production) && Number(value.production) > 0;

const companyCatalog = (value: unknown): value is Readonly<Record<string, Readonly<Record<CommercialEnvironment, number>>>> =>
  record(value) && Object.values(value).every(companyIds);

export const loadCommercialReference = async (): Promise<CommercialReference> => {
  const logoPath = fileURLToPath(new URL("../../../../data/commercial-reference/backend-taxonomy-reference.json", import.meta.url));
  const companyPath = fileURLToPath(new URL("../../../../data/commercial-reference/company-ids-reference.json", import.meta.url));
  const [logoRaw, companyRaw] = await Promise.all([readFile(logoPath, "utf8"), readFile(companyPath, "utf8")]);
  const parsed: unknown = JSON.parse(logoRaw);
  const companies: unknown = JSON.parse(companyRaw);
  if (!record(parsed) || !Array.isArray(parsed.brandLogos) || !parsed.brandLogos.every(logo) ||
    new Set(parsed.brandLogos.map((item: BrandLogoReference) => item.id)).size !== parsed.brandLogos.length ||
    !companyCatalog(companies)) {
    throw new Error("Referencias comerciales de logos o empresas inválidas");
  }
  return { brandLogos: parsed.brandLogos, companies, logoRaw, companyRaw };
};
