import { buildProductIdentity } from "../identity.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "../preparation/contracts.js";

export type DescriptionSourceOrigin = "original_canonico" | "reconstruccion_publicada";
export type DescriptionCoverageInput = {
  readonly published: ImportCandidate;
  readonly source: ProductRecord;
  readonly prepared: PreparedProduct;
  readonly origin: DescriptionSourceOrigin;
};
type DescriptionField = "description" | "description_general";
const fields: readonly DescriptionField[] = ["description", "description_general"];
const hasText = (value: string | null): boolean => Boolean(value?.trim());
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const fieldCount = (): Record<DescriptionField, number> => ({ description: 0, description_general: 0 });

type CoverageTotals = {
  readonly products: number;
  readonly publishedMissing: Readonly<Record<DescriptionField, number>>;
  readonly recovered: Readonly<Record<DescriptionField, number>>;
  readonly pending: Readonly<Record<DescriptionField, number>>;
  readonly lost: Readonly<Record<DescriptionField, number>>;
  readonly incompleteProducts: number;
  readonly bothPending: number;
};
type CoverageCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly title: string | null;
  readonly family: string;
  readonly familyMethod: string;
  readonly origin: DescriptionSourceOrigin;
  readonly missing: readonly DescriptionField[];
  readonly publishedMissing: readonly DescriptionField[];
  readonly recovered: readonly DescriptionField[];
  readonly lost: readonly DescriptionField[];
  readonly evidence: string;
  readonly issues: readonly string[];
};
type Family = {
  readonly providerId: string;
  readonly family: string;
  readonly familyMethod: string;
  readonly total: number;
  readonly incomplete: number;
  readonly missingFields: number;
  readonly cases: readonly CoverageCase[];
};
export type DescriptionCoverage = {
  readonly totals: CoverageTotals;
  readonly providers: readonly ({ readonly providerId: string; readonly origin: DescriptionSourceOrigin } & CoverageTotals)[];
  readonly families: readonly Family[];
  readonly pendingCases: readonly CoverageCase[];
  readonly lostCases: readonly CoverageCase[];
};

export const familyOf = (input: DescriptionCoverageInput): { family: string; method: string } => {
  if (input.source.providerId === "gomariz") {
    const path = new URL(input.source.url).pathname.split("/").filter(Boolean);
    if (path[0] === "venta" && path[1] === "elevacion-y-trabajos-en-altura" && path[2]) {
      return { family: path[2].replace(/-/g, " "), method: "ruta del proveedor" };
    }
  }
  if (input.source.providerId === "gam") {
    const path = new URL(input.source.url).pathname.split("/").filter(Boolean);
    if (path[0] === "es" && path[1]) {
      return { family: path[1].replace(/-/g, " "), method: "ruta del proveedor" };
    }
  }
  if (input.source.providerId === "mercaeleva") {
    const text = `${input.source.specs?.["Título adicional"] ?? ""} ${input.source.title ?? ""}`.toLocaleLowerCase("es");
    for (const [pattern, label] of [
      [/\bcarretilla|\bgr[uú]a horquilla/u, "carretillas"],
      [/\btranspalet/u, "transpaletas"],
      [/\bapilador/u, "apiladores"],
      [/\bplataforma|\bcami[oó]n cesta/u, "plataformas"],
      [/\bcaseta|\bm[oó]dulo/u, "casetas y módulos"]
    ] as const) {
      if (pattern.test(text)) return { family: label, method: "familia provisional inferida del título" };
    }
    return { family: "otros sin clasificar", method: "familia provisional inferida del título" };
  }
  return { family: input.source.categoryName || "sin familia", method: "categoría original" };
};

const emptyCounters = () => ({ publishedMissing: fieldCount(), recovered: fieldCount(), pending: fieldCount(), lost: fieldCount() });

export const analyzeDescriptionCoverage = (inputs: readonly DescriptionCoverageInput[]): DescriptionCoverage => {
  const identities = new Set<string>();
  const counters = emptyCounters();
  const providers = new Map<string, { origin: DescriptionSourceOrigin; products: number; incompleteProducts: number; bothPending: number; counts: ReturnType<typeof emptyCounters> }>();
  const families = new Map<string, { providerId: string; family: string; familyMethod: string; total: number; cases: CoverageCase[] }>();
  const pendingCases: CoverageCase[] = [];
  const lostCases: CoverageCase[] = [];
  let incompleteProducts = 0;
  let bothPending = 0;
  for (const input of inputs) {
    const { published, source, prepared, origin } = input;
    const identity = buildProductIdentity({ providerId: published.providerId, reference: published.reference, serialNumber: null, url: published.sourceUrl }).key;
    if (identities.has(identity)) throw new Error(`Publicación duplicada en comparación: ${identity}`);
    identities.add(identity);
    if (identity !== buildProductIdentity(source).key || source.url !== published.sourceUrl ||
      source.providerId !== published.providerId || prepared.product.providerId !== published.providerId ||
      prepared.product.sourceUrl !== published.sourceUrl || prepared.product.reference !== published.reference) {
      throw new Error(`Identidad o URL discordante en comparación: ${identity}`);
    }
    const provider = providers.get(published.providerId) ?? { origin, products: 0, incompleteProducts: 0, bothPending: 0, counts: emptyCounters() };
    if (provider.origin !== origin) throw new Error(`Procedencias mezcladas para ${published.providerId}`);
    provider.products++;
    providers.set(published.providerId, provider);
    const { family, method } = familyOf(input);
    const familyId = JSON.stringify([published.providerId, family]);
    const familyGroup = families.get(familyId) ?? { providerId: published.providerId, family, familyMethod: method, total: 0, cases: [] };
    familyGroup.total++;
    families.set(familyId, familyGroup);
    const missing: DescriptionField[] = [];
    const publishedMissing: DescriptionField[] = [];
    const recovered: DescriptionField[] = [];
    const lost: DescriptionField[] = [];
    for (const field of fields) {
      const wasMissing = !hasText(published[field]);
      const isMissing = !hasText(prepared.product[field]);
      if (wasMissing) {
        counters.publishedMissing[field]++;
        provider.counts.publishedMissing[field]++;
        publishedMissing.push(field);
        if (isMissing) {
          counters.pending[field]++;
          provider.counts.pending[field]++;
        } else {
          counters.recovered[field]++;
          provider.counts.recovered[field]++;
          recovered.push(field);
        }
      } else if (isMissing) {
        counters.lost[field]++;
        provider.counts.lost[field]++;
        lost.push(field);
      }
      if (isMissing) missing.push(field);
    }
    if (missing.length) {
      incompleteProducts++;
      provider.incompleteProducts++;
      if (missing.length === 2) { bothPending++; provider.bothPending++; }
    }
    if (!missing.length && !lost.length) continue;
    const evidence = prepared.issues.some((issue) => /contradic|conflict|incompatible/i.test(issue)) ? "contradicción técnica por revisar" :
      publishedMissing.some((field) => field === "description" ? Boolean(source.longDescription?.trim()) : Boolean(source.shortDescription?.trim())) ?
        "texto relacionado en la fuente" : Object.keys(source.specs ?? {}).length > 0 ?
        "especificaciones disponibles; requieren validación editorial" : "sin evidencia textual o técnica suficiente en esta preparación";
    const entry: CoverageCase = {
      identity, providerId: published.providerId, reference: published.reference, url: published.sourceUrl,
      title: published.title, family, familyMethod: method, origin, missing, publishedMissing, recovered, lost,
      evidence, issues: prepared.issues
    };
    if (missing.length) { pendingCases.push(entry); familyGroup.cases.push(entry); }
    if (lost.length) lostCases.push(entry);
  }
  const priority = (a: CoverageCase, b: CoverageCase): number => b.missing.length - a.missing.length ||
    Number(b.evidence.startsWith("contradicción")) - Number(a.evidence.startsWith("contradicción")) || compare(a.identity, b.identity);
  const sortedFamilies: Family[] = [...families.values()].filter((group) => group.cases.length > 0).map((group) => ({
    providerId: group.providerId, family: group.family, familyMethod: group.familyMethod, total: group.total,
    incomplete: group.cases.length, missingFields: group.cases.reduce((sum, item) => sum + item.missing.length, 0),
    cases: group.cases.sort(priority)
  })).sort((a, b) => b.missingFields - a.missingFields || b.incomplete / b.total - a.incomplete / a.total ||
    compare(a.providerId, b.providerId) || compare(a.family, b.family));
  return {
    totals: { products: inputs.length, ...counters, incompleteProducts, bothPending },
    providers: [...providers].sort(([a], [b]) => compare(a, b)).map(([providerId, item]) => ({
      providerId, origin: item.origin, products: item.products, ...item.counts,
      incompleteProducts: item.incompleteProducts, bothPending: item.bothPending
    })),
    families: sortedFamilies,
    pendingCases: sortedFamilies.flatMap((item) => item.cases),
    lostCases: lostCases.sort(priority)
  };
};
