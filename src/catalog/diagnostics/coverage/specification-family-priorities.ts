import { editorialFamilyOf, editorialFamilyName, resolveConsistentEditorialFamily, type EditorialFamily } from "../../../preparation/editorial/core/editorial-families.js";
import { fold } from "../../../preparation/classification/category-utils.js";
import { normalizedSpecKey, specHasValue } from "./content-gaps-source.js";
import type { SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import type { DescriptionCoverageInput } from "./description-coverage.js";

export type TechnicalPriority = "P1" | "P2";
export type EssentialTechnicalSpec = {
  readonly key: string;
  readonly label: string;
  readonly alternatives: readonly RegExp[];
};
export type PriorityTechnicalFamily = {
  readonly name: string;
  readonly priority: TechnicalPriority;
  readonly essential: readonly EssentialTechnicalSpec[];
};

const verticalHeight: EssentialTechnicalSpec = { key: "altura_vertical", label: "Altura vertical declarada (trabajo, plataforma o elevación)", alternatives: [
  /^altura (?:(?:maxima )?de )?(?:trabajo|plataforma|elevacion)\b/u,
  /^altura (?:maxima )?(?:trabajo|plataforma|elevacion)\b/u
] };
const liftHeight: EssentialTechnicalSpec = { key: "altura_elevacion", label: "Altura de elevación", alternatives: [
  /^altura (?:(?:maxima )?de )?elevacion\b/u
] };
const capacity: EssentialTechnicalSpec = { key: "capacidad", label: "Capacidad de carga", alternatives: [
  /^capacidad(?: maxima| nominal)?(?: de)? (?:carga|elevacion|plataforma|cesta)\b/u,
  /^capacidad$/u, /^carga (?:maxima|nominal|util)\b/u
] };
const horizontalReach: EssentialTechnicalSpec = { key: "alcance_horizontal", label: "Alcance horizontal", alternatives: [
  /^alcance (?:horizontal|lateral)\b/u
] };
const weight: EssentialTechnicalSpec = { key: "peso", label: "Peso operativo", alternatives: [
  /^peso\b/u, /^masa operativa\b/u
] };
const platformSize: EssentialTechnicalSpec = { key: "dimensiones_plataforma", label: "Dimensiones de cesta o plataforma", alternatives: [
  /^dimensiones (?:de )?(?:cesta|plataforma)\b/u,
  /^(?:longitud|anchura) de plataforma\b/u
] };
const depth: EssentialTechnicalSpec = { key: "profundidad_excavacion", label: "Profundidad de excavación", alternatives: [
  /^profundidad (?:maxima de )?excavacion\b/u
] };
const loadCenter: EssentialTechnicalSpec = { key: "centro_carga", label: "Centro de carga", alternatives: [
  /^centro de carga\b/u
] };
const drumWidth: EssentialTechnicalSpec = { key: "ancho_compactacion", label: "Anchura de compactación", alternatives: [
  /^(?:anchura|ancho) (?:de )?(?:trabajo|rodillo|tambor|compactacion)\b/u
] };
const enginePower: EssentialTechnicalSpec = { key: "potencia", label: "Potencia del motor", alternatives: [
  /^potencia\b/u
] };

const family = (name: string, priority: TechnicalPriority, essential: readonly EssentialTechnicalSpec[]): PriorityTechnicalFamily =>
  ({ name, priority, essential });
const articulated = family("plataformas articuladas", "P1", [verticalHeight, capacity, horizontalReach, platformSize]);
const telescopic = family("plataformas telescópicas", "P1", [verticalHeight, capacity, horizontalReach, platformSize]);
const scissors = family("plataformas de tijera", "P1", [verticalHeight, capacity, platformSize]);
const tracked = family("plataformas sobre orugas", "P1", [verticalHeight, capacity, horizontalReach]);
const vertical = family("plataformas unipersonales", "P1", [verticalHeight, capacity]);
const truck = family("camiones cesta", "P1", [verticalHeight, capacity, horizontalReach]);
const otherPlatform = family("otras plataformas elevadoras", "P1", [verticalHeight, capacity]);
const handler = family("manipuladores telescópicos", "P1", [liftHeight, capacity, horizontalReach, weight]);
const excavator = family("excavadoras y miniexcavadoras", "P1", [depth, weight, enginePower]);
const backhoe = family("retroexcavadoras", "P1", [depth, weight, enginePower]);
const loader = family("cargadoras", "P2", [capacity, weight, enginePower]);
const dumper = family("dumpers", "P2", [capacity, weight, enginePower]);
const roller = family("rodillos compactadores", "P2", [weight, drumWidth, enginePower]);
const forklift = family("carretillas contrapesadas", "P2", [capacity, liftHeight, loadCenter]);
const reachForklift = family("carretillas retráctiles", "P2", [capacity, liftHeight, loadCenter]);
const roughTerrainForklift = family("carretillas todoterreno", "P2", [capacity, liftHeight, loadCenter]);
const orderPicker = family("carretillas recogepedidos y trilaterales", "P2", [capacity, liftHeight]);

const classify = (text: string): PriorityTechnicalFamily | null => {
  if (/\b(?:lote|pack|conjunto|varias unidades)\b/u.test(text)) return null;
  if (/\b(?:manipulador(?:es)? telescopico|telehandler)\b/u.test(text)) return handler;
  if (/\bretroexcavadora\b/u.test(text)) return backhoe;
  if (/\b(?:miniexcavadoras?|mini excavadoras?|excavadoras?)\b/u.test(text)) return excavator;
  if (/\b(?:minicargadoras?|cargadoras?|pala cargadora)\b/u.test(text)) return loader;
  if (/\b(?:minidumper|dumper)\b/u.test(text)) return dumper;
  if (/\b(?:rodillos?|compactadores?|compactadoras?)\b/u.test(text)) return roller;
  if (/\b(?:carretillas?|montacargas)\b/u.test(text)) {
    if (/\b(?:retractil|reach truck)\b/u.test(text)) return reachForklift;
    if (/\b(?:todoterreno|todo terreno)\b/u.test(text)) return roughTerrainForklift;
    if (/\b(?:recogepedidos|trilateral)\b/u.test(text)) return orderPicker;
    return forklift;
  }
  if (/\b(?:camion cesta|camion con cesta)\b/u.test(text)) return truck;
  if (/\b(?:plataformas?|cesta elevadora)\b/u.test(text)) {
    if (/\b(?:tijeras?|scissor)\b/u.test(text)) return scissors;
    if (/\b(?:articuladas?|articulados?)\b/u.test(text)) return articulated;
    if (/\b(?:telescopicas?|telescopicos?)\b/u.test(text)) return telescopic;
    if (/\b(?:sobre orugas|orugas)\b/u.test(text)) return tracked;
    if (/\b(?:unipersonal|mastil vertical)\b/u.test(text)) return vertical;
    return otherPlatform;
  }
  return null;
};

export const technicalPriorityFamilyFor = (input: Pick<DescriptionCoverageInput, "source">, product: ImportCandidate): PriorityTechnicalFamily | null => {
  const title = fold(product.title ?? input.source.title ?? "");
  if (/\b(?:lotes?|packs?|conjunto|varias unidades)\b/u.test(title)) return null;
  const url = fold(new URL(input.source.url).pathname.replace(/-/gu, " "));
  const byTitle = classify(title);
  const byUrl = classify(url);
  if (byTitle && byUrl && byTitle.name !== byUrl.name) {
    if (byTitle.name !== otherPlatform.name && byUrl.name !== otherPlatform.name &&
      !(byUrl.name === forklift.name && [reachForklift.name, roughTerrainForklift.name, orderPicker.name].includes(byTitle.name))) return null;
  }
  return byTitle ?? byUrl;
};

export const technicalPriorityFamily = (input: DescriptionCoverageInput): PriorityTechnicalFamily | null =>
  technicalPriorityFamilyFor(input, input.published);

export const publishedTechnicalKeys = (specs: Readonly<Record<string, SpecValue>>): readonly string[] => [
  ...new Set(Object.entries(specs).filter(([, value]) => specHasValue(value))
    .map(([key]) => fold(normalizedSpecKey(key))))
];

export const hasEssentialTechnicalSpec = (keys: readonly string[], essential: EssentialTechnicalSpec): boolean => {
  const matches = keys.filter((key) => essential.alternatives.some((pattern) => pattern.test(key)));
  if (essential.key !== platformSize.key) return matches.length > 0;
  return matches.some((key) => /^dimensiones (?:de )?(?:cesta|plataforma)\b/u.test(key)) ||
    (matches.some((key) => /^longitud de plataforma\b/u.test(key)) &&
      matches.some((key) => /^anchura de plataforma\b/u.test(key)));
};

const sharedPriorityFamilies: Partial<Record<EditorialFamily, PriorityTechnicalFamily>> = {
  "plataforma-articulada": articulated, "plataforma-telescopica": telescopic,
  "plataforma-tijera": scissors, "plataforma-oruga": tracked, "plataforma-mastil": vertical,
  "plataforma-unipersonal": vertical, "camion-cesta": truck, "manipulador-telescopico": handler,
  excavadora: excavator, miniexcavadora: excavator, cargadora: loader, dumper, compactadora: roller,
  "carretilla-elevadora": forklift, "carretilla-retractil": reachForklift, recogepedidos: orderPicker
};

const compatiblePriorityFamily = (left: PriorityTechnicalFamily, right: PriorityTechnicalFamily): boolean =>
  left.name === right.name ||
  (left === otherPlatform && [articulated, telescopic, scissors, tracked, vertical, truck].includes(right)) ||
  (left === forklift && [reachForklift, roughTerrainForklift, orderPicker].includes(right)) ||
  (left === excavator && right === backhoe);

export const assessQualitativeTechnicalFamily = (product: ImportCandidate): {
  readonly family: PriorityTechnicalFamily | null;
  readonly name: string | null;
  readonly status: "identificada" | "sin_criterio" | "desconocida" | "contradictoria";
} => {
  const title = fold(product.title ?? "");
  const path = URL.canParse(product.sourceUrl) ? fold(new URL(product.sourceUrl).pathname.replace(/-/gu, " ")) : "";
  const category = fold(product.category ?? "");
  const additional = product.spec["Título adicional"];
  const clues = [title, path, category, typeof additional === "string" ? fold(additional) : ""];
  if (clues.some((clue) => /\b(?:lotes?|packs?|conjunto|varias unidades)\b/u.test(clue))) {
    return { family: null, name: null, status: "desconocida" };
  }
  const shared = clues.map(editorialFamilyOf);
  for (const [index, family] of shared.entries()) {
    if (family && clues.some((clue, other) => other !== index && shared[other] !== null &&
      resolveConsistentEditorialFamily(clues[index]!, clue, null, "", family) === null)) {
      return { family: null, name: null, status: "contradictoria" };
    }
  }
  const legacyFamilies = clues.map(classify);
  if (legacyFamilies.some((legacy, index) => {
    const resolved = shared[index];
    const mapped = resolved ? sharedPriorityFamilies[resolved] : undefined;
    return legacy && mapped && !compatiblePriorityFamily(legacy, mapped) && !compatiblePriorityFamily(mapped, legacy);
  })) return { family: null, name: null, status: "contradictoria" };
  const candidates = clues.map((_, index) => {
    const legacy = legacyFamilies[index] ?? null;
    const resolved = shared[index];
    if (!resolved) return legacy;
    const mapped = sharedPriorityFamilies[resolved];
    if (!mapped) return null;
    if (!legacy || compatiblePriorityFamily(legacy, mapped)) return mapped;
    if (compatiblePriorityFamily(mapped, legacy)) return legacy;
    return null;
  });
  const families = candidates.filter((item): item is PriorityTechnicalFamily => item !== null);
  if (families.some((left, index) => families.slice(index + 1).some((right) =>
    !compatiblePriorityFamily(left, right) && !compatiblePriorityFamily(right, left)))) {
    return { family: null, name: null, status: "contradictoria" };
  }
  if (shared.some((item) => item !== null && !sharedPriorityFamilies[item]) && families.length) {
    return { family: null, name: null, status: "contradictoria" };
  }
  const family = families.find((item) => !families.some((other) => item !== other && compatiblePriorityFamily(item, other))) ?? null;
  const known = shared.find((item) => item !== null);
  if (family) return { family, name: family.name, status: "identificada" };
  return known ? { family: null, name: editorialFamilyName(known), status: "sin_criterio" } :
    { family: null, name: null, status: "desconocida" };
};

const unqualifiedEssentialKey = (key: string, essential: EssentialTechnicalSpec): boolean => {
  const base = fold(key).replace(/ \((?:mm|m|kg|kw|cv)\)$/u, "");
  if (essential.key === weight.key) return /^(?:peso|peso operativo|peso maquina|peso de servicio|peso en orden de marcha del modelo|masa operativa)$/u.test(base);
  if (essential.key === enginePower.key) return /^(?:potencia del motor|potencia maxima del motor|potencia nominal del motor|potencia maxima din|potencia de motor publicada para la unidad)$/u.test(base);
  if (essential.key === capacity.key) return /^(?:capacidad|capacidad (?:nominal |maxima )?(?:de (?:carga|elevacion|plataforma|(?:la )?cesta)|nominal)|carga (?:maxima|nominal|util))$/u.test(base);
  if (essential.key === platformSize.key) return /^(?:dimensiones (?:de )?(?:cesta|plataforma)|(?:longitud|anchura) de plataforma)$/u.test(base);
  if (essential.key === horizontalReach.key) return /^(?:alcance (?:horizontal|lateral)(?: maximo| max\.)?)$/u.test(base);
  if (essential.key === drumWidth.key) return /^(?:anchura|ancho) (?:de )?(?:trabajo|rodillo|tambor|compactacion)$/u.test(base);
  if (essential.key === loadCenter.key) return /^(?:centro de carga|centro de carga nominal del modelo)$/u.test(base);
  return essential.alternatives.some((pattern) => pattern.exec(base)?.[0] === base);
};

export const assessEssentialTechnicalCoverage = (family: PriorityTechnicalFamily, interpreted: readonly string[], unresolved: readonly string[]) =>
  family.essential.map((essential) => {
    const accepted = interpreted.filter((key) => unqualifiedEssentialKey(key, essential));
    const observed = essential.key === platformSize.key ? hasEssentialTechnicalSpec(accepted.map(fold), essential) : accepted.length > 0;
    const candidates = [...new Set([...interpreted, ...unresolved].filter((key) =>
      essential.alternatives.some((pattern) => pattern.test(fold(key))) || unqualifiedEssentialKey(key, essential)))].sort();
    const status: "observada" | "no_observada" | "no_evaluable" = observed ? "observada" : candidates.length ? "no_evaluable" : "no_observada";
    return { key: essential.key, label: essential.label, priority: family.priority, status, keys: candidates };
  });
