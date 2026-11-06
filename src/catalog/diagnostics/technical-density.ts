import { fold } from "../../preparation/shared/classification/mapping/category-utils.js";
import { normalizedSpecKey, specHasValue } from "./content-gaps-source.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";

export const TECHNICAL_DENSITY_CRITERIA = { sparseMaximum: 2, mediumMaximum: 3 } as const;

const NON_PERFORMANCE_SPEC_KEYS = new Set([
  "marca", "modelo", "titulo adicional", "ano de fabricacion", "ano del modelo", "ano de fabricacion de la bateria",
  "nº de serie", "numero de serie", "serial", "pais", "ubicacion", "horometro", "horas laborales",
  "kilometros", "kilometraje", "matricula", "articulo no.", "articulo no", "reg. no.", "reg. no",
  "estado", "condicion general", "certificacion ce"
].map(fold));

export type TechnicalDensityCase = {
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly title: string | null;
  readonly category: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly technicalCount: number;
  readonly priority: "alta" | "media";
  readonly technicalKeys: readonly string[];
};

export type TechnicalDensityProvider = {
  readonly providerId: string;
  readonly products: number;
  readonly sparse: number;
  readonly medium: number;
  readonly median: number;
};

export type TechnicalDensityModel = {
  readonly providerId: string;
  readonly brand: string;
  readonly model: string;
  readonly products: number;
  readonly sparse: number;
  readonly medium: number;
  readonly examples: readonly string[];
};

export type TechnicalDensity = {
  readonly criteria: typeof TECHNICAL_DENSITY_CRITERIA;
  readonly note: string;
  readonly totals: { readonly products: number; readonly sparse: number; readonly medium: number };
  readonly providers: readonly TechnicalDensityProvider[];
  readonly models: readonly TechnicalDensityModel[];
  readonly cases: readonly TechnicalDensityCase[];
  readonly mediumCases: readonly TechnicalDensityCase[];
};

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const display = (value: string | undefined): string | null => value?.trim() || null;
const field = (product: ImportCandidate, name: string): string | null => {
  const value = product.spec[name];
  return typeof value === "string" ? display(value) : null;
};

export const analyzeTechnicalDensity = (products: readonly ImportCandidate[]): TechnicalDensity => {
  const cases: TechnicalDensityCase[] = [];
  const mediumCases: TechnicalDensityCase[] = [];
  const providers = new Map<string, { counts: number[]; sparse: number; medium: number }>();
  const models = new Map<string, { providerId: string; brand: string; model: string; products: number; sparse: number; medium: number; examples: string[] }>();
  const identities = new Set<string>();
  for (const product of products) {
    const identity = JSON.stringify([product.providerId, product.reference, product.sourceUrl]);
    if (identities.has(identity)) throw new Error(`Ficha duplicada en densidad técnica: ${identity}`);
    identities.add(identity);
    const technicalKeys = [...new Set(Object.entries(product.spec)
      .filter(([key, value]) => !NON_PERFORMANCE_SPEC_KEYS.has(fold(key)) && specHasValue(value))
      .map(([key]) => normalizedSpecKey(key)))].sort(compare);
    const technicalCount = technicalKeys.length;
    const provider = providers.get(product.providerId) ?? { counts: [], sparse: 0, medium: 0 };
    provider.counts.push(technicalCount);
    const sparse = technicalCount <= TECHNICAL_DENSITY_CRITERIA.sparseMaximum;
    const medium = technicalCount > TECHNICAL_DENSITY_CRITERIA.sparseMaximum &&
      technicalCount <= TECHNICAL_DENSITY_CRITERIA.mediumMaximum;
    if (sparse) provider.sparse++;
    if (medium) provider.medium++;
    providers.set(product.providerId, provider);
    if (!sparse && !medium) continue;
    const brand = field(product, "Marca");
    const model = field(product, "Modelo");
    const densityCase: TechnicalDensityCase = { providerId: product.providerId, reference: product.reference, url: product.sourceUrl,
      title: product.title, category: product.category, brand, model, technicalCount,
      priority: sparse ? "alta" : "media", technicalKeys };
    if (sparse) cases.push(densityCase);
    else mediumCases.push(densityCase);
    if (brand && model) {
      const modelKey = JSON.stringify([product.providerId, fold(brand), fold(model)]);
      const group = models.get(modelKey) ?? { providerId: product.providerId, brand, model, products: 0, sparse: 0, medium: 0, examples: [] };
      if (sparse) group.sparse++;
      if (medium) group.medium++;
      if (group.examples.length < 5) group.examples.push(product.reference ?? product.sourceUrl);
      models.set(modelKey, group);
    }
  }
  for (const product of products) {
    const brand = field(product, "Marca");
    const model = field(product, "Modelo");
    if (!brand || !model) continue;
    const key = JSON.stringify([product.providerId, fold(brand), fold(model)]);
    const group = models.get(key);
    if (group) group.products++;
  }
  return {
    criteria: TECHNICAL_DENSITY_CRITERIA,
    note: "Prioridad editorial exploratoria: alta con 0–2 prestaciones, media con 3 y sin aviso desde 4. La densidad por sí sola no acredita una carencia. Excluye metadatos de identificación, uso, estado y certificación; requiere comprobación por tipo, modelo y unidad. Sin bloqueo de publicación.",
    totals: { products: products.length, sparse: cases.length, medium: mediumCases.length },
    providers: [...providers].sort(([a], [b]) => compare(a, b)).map(([providerId, item]) => {
      const sorted = item.counts.sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
      return { providerId, products: sorted.length, sparse: item.sparse, medium: item.medium, median };
    }),
    models: [...models.values()].sort((a, b) => b.sparse - a.sparse || b.medium - a.medium ||
      b.products - a.products ||
      compare(a.providerId, b.providerId) || compare(a.brand, b.brand) || compare(a.model, b.model)),
    cases: cases.sort((a, b) => a.technicalCount - b.technicalCount || compare(a.providerId, b.providerId) ||
      compare(a.reference ?? a.url, b.reference ?? b.url)),
    mediumCases: mediumCases.sort((a, b) => compare(a.providerId, b.providerId) ||
      compare(a.reference ?? a.url, b.reference ?? b.url))
  };
};
