import { buildProductIdentity } from "../identity.js";
import { findBrandTypo } from "../normalization/technical-title-identity.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";

type TitlePriority = "P0" | "P1" | "P2";
type TitleStage = "pendiente" | "resuelto_preparacion" | "aparecido_preparacion";
type TitleSignal = "titulo_ausente" | "tipo_maquina_no_identificado" | "marca_no_identificada" |
  "modelo_no_identificado" | "redaccion_incoherente" | "residuo_portal" | "magnitud_repetida" | "terminos_unidos";

type TitleFinding = {
  readonly code: TitleSignal;
  readonly priority: TitlePriority;
  readonly stage: TitleStage;
  readonly evidence: string;
};
type TitleCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly origin: DescriptionCoverageInput["origin"];
  readonly originalTitle: string | null;
  readonly publishedTitle: string | null;
  readonly preparedTitle: string | null;
  readonly findings: readonly TitleFinding[];
};
export type TitleQuality = {
  readonly note: string;
  readonly totals: {
    readonly products: number;
    readonly affected: number;
    readonly pending: number;
    readonly resolved: number;
    readonly appeared: number;
  };
  readonly providers: readonly {
    readonly providerId: string;
    readonly products: number;
    readonly affected: number;
    readonly pending: number;
    readonly resolved: number;
    readonly appeared: number;
  }[];
  readonly cases: readonly TitleCase[];
};

type Issue = { readonly code: TitleSignal; readonly priority: TitlePriority; readonly evidence: string };
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const normalize = (text: string): string => text.normalize("NFKD").replace(/\p{M}/gu, "")
  .toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
const compact = (text: string): string => normalize(text).replace(/\s/gu, "");
const familyPatterns: readonly { readonly label: string; readonly source: RegExp; readonly title: RegExp }[] = [
  { label: "bicicleta eléctrica", source: /\bbiciclet(?:a|as)\s+electric(?:a|as)\b/u, title: /\b(?:biciclet\w*|e\s?bike\w*)\b/u },
  { label: "camión cesta", source: /\b(?:camiones?\s+cesta|plataforma\s+sobre\s+camion)\b/u, title: /\b(?:camion(?:es)?\s+cesta|plataforma\s+sobre\s+camion)\b/u },
  { label: "plataforma articulada", source: /\bplataformas?\s+(?:de\s+brazo\s+)?articulad[ao]s?\b/u, title: /\b(?:plataformas?\s+(?:elevadoras?\s+)?(?:de\s+brazo\s+)?articulad[ao]s?|brazo\s+articulad[ao])\b/u },
  { label: "plataforma de tijera", source: /\b(?:plataformas?\s+(?:de\s+)?tijera|tijeras?\s+electricas?)\b/u, title: /\b(?:plataformas?\s+(?:elevadoras?\s+)?(?:de\s+)?tijera|tijeras?\s+electricas?)\b/u },
  { label: "carretilla elevadora", source: /\bcarretillas?\s+elevadoras?\b/u, title: /\b(?:carretillas?\s+(?:elevadoras?|retractil(?:es)?|frontal(?:es)?|para\s+pasillos?\s+estrechos?)|manipulador(?:a)?\s+de\s+contenedores?)\b/u },
  { label: "transpaleta", source: /\btranspalet(?:a|as|s)?\b/u, title: /\b(?:transpalet(?:a|as|s)?|portador(?:es)?\s+de\s+paletas?)\b/u },
  { label: "apilador", source: /\bapiladores?\b/u, title: /\bapiladores?\b/u },
  { label: "fregadora", source: /\bfregadoras?\b/u, title: /\b(?:micro)?fregadoras?\b/u },
  { label: "barredora", source: /\bbarredoras?\b/u, title: /\bbarredoras?\b/u },
  { label: "grupo electrógeno", source: /\bgrupos?\s+electrogenos?\b/u, title: /\bgrupos?\s+electrogenos?\b/u },
  { label: "miniexcavadora", source: /\bminiexcavadoras?\b/u, title: /\bminiexcavadoras?\b/u }
];

const familyEvidence = (input: DescriptionCoverageInput): { label: string; origin: string } | null => {
  const originalText = input.origin === "original_canonico" ?
    input.source.shortDescription ?? input.source.longDescription : null;
  const text = originalText;
  if (!text?.trim()) return null;
  const normalized = normalize(text.slice(0, 320));
  const matches = familyPatterns.filter((item) => item.source.test(normalized));
  if (matches.length !== 1) return null;
  return { label: matches[0]?.label ?? "", origin: text.slice(0, 180).replace(/\s+/gu, " ").trim() };
};

const diagnose = (title: string | null, input: DescriptionCoverageInput): readonly Issue[] => {
  const value = title?.trim() ?? "";
  if (!normalize(value)) return [{ code: "titulo_ausente", priority: "P0", evidence: "Título vacío o sin contenido identificable" }];
  const result: Issue[] = [];
  const folded = normalize(value);
  const family = familyEvidence(input);
  if (family) {
    const pattern = familyPatterns.find((item) => item.label === family.label);
    if (pattern && !pattern.title.test(folded) &&
      !/\bmanipulador(?:a)?\s+telescopico\b/u.test(folded)) result.push({ code: "tipo_maquina_no_identificado", priority: "P1",
      evidence: `${family.label} | descripción original: ${family.origin}` });
  }
  const brand = input.source.brand?.trim();
  const brandTerms = normalize(brand ?? "").split(" ").filter((word) => word.length > 1);
  if (brand && compact(brand).length >= 3 && !compact(value).includes(compact(brand)) &&
    !brandTerms.every((word) => folded.split(" ").includes(word)) &&
    input.origin === "original_canonico" &&
    (containsOriginal(input.source.shortDescription, brand) && containsOriginal(input.source.longDescription, brand) ||
      (typeof input.source.specs?.Marca === "string" && compact(input.source.specs.Marca) === compact(brand) &&
        findBrandTypo(value, brand) !== null))) {
    result.push({ code: "marca_no_identificada", priority: "P1", evidence: `Marca en original: ${brand}` });
  }
  const model = input.source.model?.trim();
  const normalizedModel = compact(model ?? "");
  if (model && input.origin === "original_canonico" && normalizedModel.length >= 4 && /\d/u.test(normalizedModel) &&
    !compact(value).includes(normalizedModel) && !hasModelVariant(value, model) &&
    containsOriginal(input.source.shortDescription, model) && containsOriginal(input.source.longDescription, model)) {
    result.push({ code: "modelo_no_identificado", priority: "P1", evidence: `Modelo en original: ${model}` });
  }
  if (/\b(?:plataformas\s+articulada|platafora)\b/u.test(folded)) result.push({ code: "redaccion_incoherente", priority: "P1",
    evidence: "Redacción defectuosa: «Plataformas articulada» o «Platafora»" });
  if (/(?:tijera|el[eé]ctrica)\d+\s*(?:m|mt)\b/iu.test(value)) result.push({
    code: "terminos_unidos", priority: "P2", evidence: "Familia o motorización unida a la magnitud sin separación"
  });
  if (/\|\s*gam\s+online\s*$/iu.test(value)) result.push({ code: "residuo_portal", priority: "P2",
    evidence: "Sufijo de origen «GAM Online»" });
  const magnitudes = [...folded.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(m|mt|kg)\b/gu)]
    .map((match) => `${match[1]}:${match[2] === "mt" ? "m" : match[2]}`);
  const duplicated = magnitudes.find((item, index) => magnitudes.indexOf(item) !== index);
  if (duplicated) result.push({ code: "magnitud_repetida", priority: "P2",
    evidence: `Magnitud repetida en título: ${duplicated.replace(":", " ")}` });
  return result;
};

const hasModelVariant = (title: string, model: string): boolean => {
  const words = normalize(model).split(" ").filter(Boolean);
  if (words.length > 1 && compact(words.slice(0, -1).join(" ")).length >= 5 &&
    compact(title).includes(compact(words.slice(0, -1).join(" ")))) return true;
  const base = compact(model);
  return base.length >= 5 && /\d/u.test(base) && compact(title).includes(base.slice(0, -1));
};

const containsOriginal = (text: string | null, value: string): boolean =>
  !!text && compact(value).length >= 3 && compact(text).includes(compact(value));

const stageOrder: Readonly<Record<TitleStage, number>> = {
  pendiente: 0, aparecido_preparacion: 1, resuelto_preparacion: 2
};
const priorityOrder: Readonly<Record<TitlePriority, number>> = { P0: 0, P1: 1, P2: 2 };
const counters = () => ({ products: 0, affected: 0, pending: 0, resolved: 0, appeared: 0 });

export const analyzeTitleQuality = (inputs: readonly DescriptionCoverageInput[]): TitleQuality => {
  const seen = new Set<string>();
  const cases: TitleCase[] = [];
  const totals = counters();
  const providers = new Map<string, ReturnType<typeof counters>>();
  for (const input of inputs) {
    const { published, prepared, source, origin } = input;
    const identity = buildProductIdentity({ providerId: published.providerId, reference: published.reference,
      serialNumber: null, url: published.sourceUrl }).key;
    if (seen.has(identity)) throw new Error(`Identidad duplicada en auditor de títulos: ${identity}`);
    seen.add(identity);
    if (identity !== buildProductIdentity(source).key || published.sourceUrl !== source.url ||
      prepared.product.providerId !== published.providerId || prepared.product.reference !== published.reference ||
      prepared.product.sourceUrl !== published.sourceUrl) {
      throw new Error(`Identidad discordante en auditor de títulos: ${identity}`);
    }
    totals.products++;
    const provider = providers.get(published.providerId) ?? counters();
    provider.products++;
    providers.set(published.providerId, provider);
    const before = diagnose(published.title, input);
    const after = diagnose(prepared.product.title, input);
    const findings: TitleFinding[] = [...before, ...after.filter((issue) => !before.some((prev) => prev.code === issue.code))]
      .map((issue) => {
        const was = before.some((entry) => entry.code === issue.code);
        const now = after.some((entry) => entry.code === issue.code);
        return { ...issue, stage: now ? was ? "pendiente" : "aparecido_preparacion" : "resuelto_preparacion",
          evidence: (now ? after : before).find((entry) => entry.code === issue.code)?.evidence ?? issue.evidence };
      });
    if (findings.length === 0) continue;
    findings.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] ||
      stageOrder[a.stage] - stageOrder[b.stage] || compare(a.code, b.code));
    totals.affected++;
    provider.affected++;
    for (const item of findings) {
      if (item.stage === "pendiente") { totals.pending++; provider.pending++; }
      else if (item.stage === "resuelto_preparacion") { totals.resolved++; provider.resolved++; }
      else { totals.appeared++; provider.appeared++; }
    }
    cases.push({ identity, providerId: published.providerId, reference: published.reference,
      url: published.sourceUrl, origin, originalTitle: source.title, publishedTitle: published.title,
      preparedTitle: prepared.product.title, findings });
  }
  cases.sort((a, b) => priorityOrder[a.findings[0]?.priority ?? "P2"] - priorityOrder[b.findings[0]?.priority ?? "P2"] ||
    stageOrder[a.findings[0]?.stage ?? "resuelto_preparacion"] - stageOrder[b.findings[0]?.stage ?? "resuelto_preparacion"] ||
    compare(a.providerId, b.providerId) || compare(a.identity, b.identity));
  return { note: "Señales para revisar títulos técnicos; no son errores acreditados ni propuestas automáticas. La familia solo se contrasta con una descripción del original canónico inequívoca. Los resultados no modifican fichas ni publicaciones.",
    totals, providers: [...providers].sort(([a], [b]) => compare(a, b)).map(([providerId, counts]) => ({ providerId, ...counts })), cases };
};
