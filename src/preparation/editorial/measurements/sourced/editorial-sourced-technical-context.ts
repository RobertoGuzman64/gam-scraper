import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { parseNumber } from "../../../../catalog/normalization/spec-parsers.js";
import { normalizeSpecKey } from "../../../../catalog/normalization/normalize-specs.js";
import { containsEditorialBrandModel } from "../../identity/editorial-identity-match.js";
import { editorialMetricOf, editorialQuantity, editorialQuantityOf, formatEditorialQuantity } from "../editorial-measurements.js";
import { resolveMissingEditorialUnitName, sameEditorialUnit } from "../../core/editorial-source-contract.js";
import { resolvedEditorialUnitFamilies, verifiedEditorialLiteralUnitPair } from "../../identity/editorial-unit-provenance.js";

import { editorialFamilyFromSourceGeneral } from "../../core/editorial-families.js";
import { resolveEditorialLiteralTitleSource } from "../../core/editorial-source.js";
import { hasEditorialAdapterHeightConflict, hasEditorialSourceWorkHeightConflict } from "../coherence/editorial-height-consistency.js";
import { reconcileTechnicalSourceForRecovery } from "../../../technical/preparation-technical-stages.js";

type TechnicalDetail = Readonly<{
  key: string;
  label: string;
  unit: "m" | "kg" | "mm";
  min: number;
  max: number;
}>;

const technicalDetails: readonly TechnicalDetail[] = [
  { key: "Altura de trabajo", label: "altura de trabajo", unit: "m", min: 1, max: 100 },
  { key: "Altura de elevación (mm)", label: "altura de elevación", unit: "m", min: 0.3, max: 50 },
  { key: "Altura almacenaje", label: "altura de almacenaje", unit: "m", min: 0.3, max: 20 },
  { key: "Longitud", label: "longitud", unit: "m", min: 0.2, max: 50 },
  { key: "Anchura", label: "anchura", unit: "m", min: 0.2, max: 20 },
  { key: "Altura", label: "altura exterior", unit: "m", min: 0.2, max: 20 },
  { key: "Peso", label: "peso declarado", unit: "kg", min: 10, max: 500000 },
  { key: "Capacidad", label: "capacidad de carga declarada", unit: "kg", min: 10, max: 100000 },
  { key: "Capacidad de carga (kg)", label: "capacidad de carga declarada", unit: "kg", min: 10, max: 100000 },
  { key: "Centro de carga", label: "centro de carga", unit: "mm", min: 100, max: 3000 },
  { key: "Radio de giro", label: "radio de giro", unit: "mm", min: 100, max: 15000 }
];

const measureOf = (record: ProductRecord, detail: TechnicalDetail): number | null => {
  if (detail.unit === "m") return editorialMetricOf(record.specs, [detail.key]);
  return editorialQuantityOf(record.specs, [detail.key], detail.unit);
};

const sourcingIsSafe = (source: ProductRecord, prepared: ProductRecord): boolean => {
  if (verifiedEditorialLiteralUnitPair(source, prepared) &&
    editorialFamilyFromSourceGeneral(source.longDescription) === "torre-iluminacion" &&
    resolveEditorialLiteralTitleSource(source) === "torre de iluminación") return true;
  if (!sameEditorialUnit(source, prepared) ||
    !source.title?.trim() || !prepared.title?.trim() ||
    source.specs?.Marca !== prepared.specs?.Marca || source.specs?.Modelo !== prepared.specs?.Modelo) return false;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  return families === null || !families[0] || !families[1] || families[0] === families[1];
};

const shortSourceContext = (source: ProductRecord, general: string): string | null => {
  const short = source.shortDescription?.replace(/\s+/gu, " ").trim() ?? "";
  const sourceGeneral = source.longDescription?.trim() ?? "";
  const model = source.model?.trim();
  if (!model || short.length < 155 || short.length > 600 ||
    short.split(/\s+/u).length < sourceGeneral.split(/\s+/u).length + 9 ||
    /<[^>]+>|https?:\/\/|@|\b(?:precio|descuento|oferta)\b/iu.test(short) ||
    !short.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    !source.title?.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    general.toLocaleLowerCase("es").includes(short.toLocaleLowerCase("es"))) return null;
  return `La descripción breve del mismo anuncio precisa: ${short}${/[.!?]$/u.test(short) ? "" : "."}`;
};

const sourcedMeasures = (source: ProductRecord, prepared: ProductRecord, general: string): readonly string[] => {
  const described = new Set<string>();
  const additions: string[] = [];
  for (const detail of technicalDetails) {
    if (source.specs?.[detail.key] === undefined || source.specs[detail.key] !== prepared.specs?.[detail.key] ||
      described.has(detail.label)) continue;
    const value = measureOf(source, detail);
    if (value === null || value !== measureOf(prepared, detail) || value < detail.min || value > detail.max) continue;
    const formatted = `${formatEditorialQuantity(value)} ${detail.unit}`;
    const ungrouped = formatted.replace(/(?<=\d)\.(?=\d{3}\b)/gu, "");
    if (general.includes(formatted) || general.includes(ungrouped) ||
      detail.unit === "mm" && general.includes(`${formatEditorialQuantity(value / 1000)} m`)) continue;
    described.add(detail.label);
    additions.push(`${detail.label} de ${formatted}`);
  }
  const sourcePower = source.specs?.Potencia;
  if (typeof sourcePower === "string" && sourcePower === prepared.specs?.Potencia) {
    const match = /^([1-9]|1[0-2])\s*[x×]\s*([1-9]\d{1,3})\s*W$/iu.exec(sourcePower.trim());
    if (match?.[1] && match[2] && Number(match[2]) <= 5000 &&
      !/\bpotencia\b/iu.test(general) &&
      !general.replace(/\s+/gu, "").replace(/x/giu, "×").includes(`${match[1]}×${match[2]}W`)) additions.push(`potencia declarada de ${match[1]} × ${Number(match[2]).toLocaleString("es-ES")} W`);
  }
  return additions;
};

export const resolveSourcedTechnicalContext = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || !source.longDescription?.trim() ||
    general.trim().split(/\s+/u).length >= 60 || source.longDescription.trim().split(/\s+/u).length >= 60 ||
    !sourcingIsSafe(source, prepared)) return null;
  const additions: string[] = [];
  const short = shortSourceContext(source, general);
  if (short !== null) additions.push(short);
  const measures = sourcedMeasures(source, prepared, `${general} ${short ?? ""}`);
  const identity = resolveMissingEditorialUnitName(source, prepared, `${general} ${short ?? ""}`, authenticatedOrigin);
  const attribution = identity ? `, identificada como ${identity},` : "";
  if (measures.length >= 2) {
    additions.push(`En la ficha técnica de esta misma referencia${attribution} constan además ${measures.join(", ")}. Estas magnitudes describen el equipo anunciado y son útiles para comprobar dimensiones, capacidades y condiciones de utilización.`);
  } else if (measures.length === 1 && /^altura (?:de|exterior)/u.test(measures[0] ?? "") &&
    general.trim().split(/\s+/u).length >= 45) {
    additions.push(`La ficha técnica de esta misma referencia${attribution} añade ${measures[0]}, una cota útil para comprobar las dimensiones y condiciones de acceso del equipo anunciado.`);
  }
  if (additions.length === 0) return null;
  return `${general.trim()}${/[.!?]$/u.test(general.trim()) ? "" : "."} ${additions.join(" ")}`;
};

export const resolveDocumentedPlatformShort = (
  original: ProductRecord, prepared: ProductRecord, short: string | null, reviewedModelSpecs: SpecsMap | undefined
): string | null => {
  if (!short || !original.brand || !original.model || original.shortDescription?.trim() ||
    !containsEditorialBrandModel(short, original.brand, original.model) || !/\baltura de trabajo de \d/u.test(short)) return null;
  const reconciled = hasEditorialAdapterHeightConflict(original) ? reconcileTechnicalSourceForRecovery(original) : original;
  const identitySource = reconciled !== original && sameEditorialUnit(original, reconciled) &&
    !hasEditorialSourceWorkHeightConflict(reconciled) ? reconciled : original;
  const families = resolvedEditorialUnitFamilies(identitySource, prepared);
  const family = families?.[0];
  if (!family || family !== families?.[1] || !family.startsWith("plataforma-")) return null;
  const sourceText = [short, original.title, original.longDescription].join(" ");
  const sources = [original.specs, prepared.specs, reviewedModelSpecs];
  const matching = (specs: SpecsMap | undefined, keys: readonly string[]) => Object.entries(specs ?? {})
    .filter(([key]) => keys.includes(normalizeSpecKey(key)));
  const details: string[] = [];
  const field = "Capacidad máxima de plataforma";
  const capacity = editorialQuantity(reviewedModelSpecs?.[field], "kg");
  const capacityKeys = [field, "Capacidad de plataforma", "Capacidad de la cesta", "Capacidad de cesta", "Capacidad", "Capacidad carga", "Capacidad de carga", "Capacidad de carga (kg)", "Capacidad máxima de elevación"].map(normalizeSpecKey);
  if (!/\b(?:capacidad|carga|kg)\b/iu.test(sourceText) && capacity !== null && capacity >= 100 && capacity <= 1500 &&
    editorialQuantity(prepared.specs?.[field], "kg") === capacity &&
    sources.every((specs) => matching(specs, capacityKeys).every(([, raw]) => editorialQuantity(raw, "kg") === capacity)) &&
    sources.every((specs) => Object.keys(specs ?? {}).every((key) =>
      !/capacidad.*(?:restricci[oó]n|restringida|extensi[oó]n|condicionada)/iu.test(key)))) {
    details.push(`capacidad máxima de plataforma del modelo de ${formatEditorialQuantity(capacity)} kg`);
  }
  if (["plataforma-articulada", "plataforma-telescopica", "plataforma-oruga"].includes(family) &&
    !/\b(?:alcance|radio)\b/iu.test(sourceText) && sources.every((specs) => Object.keys(specs ?? {}).every((key) =>
      !/alcance.*(?:restricci[oó]n|restringid[oa]|carga|condicionad[oa])/iu.test(key)))) {
    const reachKeys = ["Alcance lateral", "Alcance horizontal", "Alcance horizontal máximo", "Alcance horizontal max.", "Alcance horizontal (m)"].map(normalizeSpecKey);
    const measure = (raw: SpecsMap[string] | undefined): number | null => {
      const millimetres = editorialQuantity(raw, "mm");
      return editorialQuantity(raw, "m") ?? (millimetres === null ? null : millimetres / 1000);
    };
    const reviewed = matching(reviewedModelSpecs, reachKeys);
    const current = matching(prepared.specs, reachKeys);
    const reach = measure(reviewed[0]?.[1]);
    if (reach !== null && Number.isFinite(reach) && reach >= 0.5 && reach <= 60 && current.length &&
      sources.every((specs) => matching(specs, reachKeys).every(([, raw]) => measure(raw) === reach))) {
      details.push(`alcance horizontal del modelo de ${formatEditorialQuantity(reach)} m`);
    }
  }
  if (family === "plataforma-tijera" && !/\b(?:extensi[oó]n|extensible|desplegable|desplazable)\b/iu.test(sourceText)) {
    const extensionKeys = ["Extensión de plataforma", "Extensión plataforma", "Extensión máxima de plataforma", "Longitud extensión", "Longitud de extensión"].map(normalizeSpecKey);
    const measure = (raw: SpecsMap[string] | undefined): number | null => {
      const millimetres = editorialQuantity(raw, "mm");
      return editorialQuantity(raw, "m") ?? (millimetres === null ? null : millimetres / 1000);
    };
    const extension = measure(matching(reviewedModelSpecs, extensionKeys)[0]?.[1]);
    if (extension !== null && extension >= 0.2 && extension <= 4 && matching(prepared.specs, extensionKeys).length &&
      sources.every((specs) => matching(specs, extensionKeys).every(([, raw]) => measure(raw) === extension))) {
      details.push(`extensión de plataforma del modelo de ${formatEditorialQuantity(extension)} m`);
    }
  }
  if (!/\baltura\s+(?:m[aá]xima\s+)?(?:de\s+(?:la\s+)?)?(?:plataforma|cesta)\b/iu.test(sourceText)) {
    const heightKeys = ["Altura de plataforma", "Altura plataforma", "Altura de la plataforma", "Altura máxima de plataforma",
      "Altura de plataforma (m)", "Altura de plataforma (mm)", "Altura de cesta"].map(normalizeSpecKey);
    const measure = (raw: SpecsMap[string] | undefined): number | null => {
      const millimetres = editorialQuantity(raw, "mm");
      return editorialQuantity(raw, "m") ?? (millimetres === null ? null : millimetres / 1000);
    };
    const height = measure(matching(reviewedModelSpecs, heightKeys)[0]?.[1]);
    const work = editorialMetricOf(prepared.specs, ["Altura de trabajo", "Altura trabajo", "Altura de trabajo (m)", "Altura de trabajo (mm)"]);
    const shortWork = /\baltura de trabajo de (\d+(?:[.,]\d+)?) m\b/u.exec(short)?.[1];
    if (height !== null && height >= 1 && work !== null && height < work &&
      shortWork !== undefined && Number(shortWork.replace(",", ".")) === work &&
      matching(prepared.specs, heightKeys).length &&
      sources.every((specs) => matching(specs, heightKeys).every(([, raw]) => measure(raw) === height))) {
      const extended = [...details, `altura de plataforma del modelo de ${formatEditorialQuantity(height)} m`];
      const candidate = short.replace(/(;|\.$)/u, `${extended.length > 1 ? ", " : " y "}${extended.join(" y ")}$1`);
      if (candidate !== short && candidate.split(/\s+/u).length <= 45) return candidate;
    }
  }
  if (!details.length) return null;
  const result = short.replace(/(;|\.$)/u, `${details.length > 1 ? ", " : " y "}${details.join(" y ")}$1`);
  if (result !== short && result.split(/\s+/u).length <= 45) return result;
  if (details.length > 1) {
    const capacityOnly = short.replace(/(;|\.$)/u, ` y ${details[0]}$1`);
    if (capacityOnly !== short && capacityOnly.split(/\s+/u).length <= 45) return capacityOnly;
  }
  return null;
};

export const resolveDocumentedModelGeneral = (
  original: ProductRecord, prepared: ProductRecord, general: string | null,
  reviewedModelSpecs: SpecsMap | undefined
): string | null => {
  if (!general?.trim() || !general.startsWith("La ficha técnica de ") ||
    !reviewedModelSpecs || !original.brand || !original.model ||
    !containsEditorialBrandModel(general, original.brand, original.model)) return null;
  const reconciled = hasEditorialAdapterHeightConflict(original) ? reconcileTechnicalSourceForRecovery(original) : original;
  const identitySource = reconciled !== original && sameEditorialUnit(original, reconciled) &&
    !hasEditorialSourceWorkHeightConflict(reconciled) ? reconciled : original;
  const families = resolvedEditorialUnitFamilies(identitySource, prepared);
  const family = families?.[0];
  if (!family || family !== families?.[1]) return null;
  const sourceText = [general, original.title, original.shortDescription, original.longDescription].join(" ");
  const atCompositionLimit = general.trim().split(/\s+/u).length >= 100;
  const boomPlatform = family === "plataforma-articulada" || family === "plataforma-telescopica" || family === "plataforma-oruga";
  if (atCompositionLimit && family !== "plataforma-tijera" && !boomPlatform) return null;
  const details: string[] = [];
  const add = (keys: readonly string[], label: string, unit: "m" | "kg" | "mm" | "km/h" | "°" | "%", minimum: number, maximum: number, mention: RegExp): void => {
    if (mention.test(sourceText)) return;
    const normalizedKeys = keys.map(normalizeSpecKey);
    const matchingFields = (record: ProductRecord) => Object.entries(record.specs ?? {})
      .filter(([key]) => normalizedKeys.includes(normalizeSpecKey(key)));
    const fields = matchingFields(prepared);
    const measure = (value: unknown): number | null => typeof value !== "string" ? null :
      unit === "°" ? (/^\d{1,3}\s*°$/u.test(value.trim()) ? Number(value.replace(/\s*°$/u, "")) : null) :
      unit === "km/h" ? (/^\d+(?:[.,]\d{1,2})?\s*km\/h$/iu.test(value.trim()) ? parseNumber(value, unit) : null) :
      editorialQuantity(value, unit) ?? (unit === "m" ? (editorialQuantity(value, "mm") ?? NaN) / 1000 :
        unit === "mm" ? (editorialQuantity(value, "m") ?? NaN) * 1000 : null);
    const value = measure(fields[0]?.[1]);
    if (value === null || !Number.isFinite(value) || value < minimum || value > maximum ||
      [...fields, ...matchingFields(original)].some(([, raw]) => measure(raw) !== value)) return;
    const reviewed = Object.entries(reviewedModelSpecs).filter(([key]) => normalizedKeys.includes(normalizeSpecKey(key)));
    if (reviewed.length === 0 || reviewed.some(([, raw]) => measure(raw) !== value)) return;
    details.push(`${label} de ${formatEditorialQuantity(value)}${unit === "°" ? "" : " "}${unit}`);
  };
  const addStowedGradeability = (): void => add(["Pendiente superable del modelo con plataforma bajada"],
    "pendiente superable nominal con plataforma bajada", "%", 1, 99,
    /\b(?:pendientes?|trepabilidad|gradeability|inclinaci[oó]n)\b/iu);
  const addExteriorTurningRadius = (): void => add(["Radio de giro exterior del modelo"], "radio de giro exterior", "m", 0.3, 15,
    /\b(?:radio(?: m[ií]nimo| m[aá]ximo)? (?:de )?giro|radio de (?:viraje|rotaci[oó]n)|di[aá]metro (?:de )?giro|turning (?:radius|circle))\b/iu);
  const addWheelbase = (): void => add(["Distancia entre ejes", "Distancia entre ejes (mm)", "Distancia entre ejes (m)"],
    "distancia entre ejes", "m", 0.3, Math.min(editorialMetricOf(prepared.specs, ["Longitud", "Longitud total", "Largo"]) ?? 12, 12),
    /\b(?:distancia entre ejes|batalla)\b/iu);
  const addPlatformExtension = (): void => add(["Extensión de plataforma", "Extensión plataforma", "Extensión máxima de plataforma"],
    "extensión de plataforma", "m", 0.2, 4,
    /\bextensi[oó]n\s+(?:de\s+(?:la\s+)?)?plataforma\b/iu);
  const addPlatformDimensions = (): void => {
    const combinedDimensionKeys = ["Dimensiones Cesta", "Dimensiones de cesta", "Dimensiones plataforma", "Dimensiones de plataforma"].map(normalizeSpecKey);
    const combinedDimensions = [original, prepared].some((record) =>
      Object.keys(record.specs ?? {}).some((key) => combinedDimensionKeys.includes(normalizeSpecKey(key))));
    if (!combinedDimensions && !/\b(?:dimensiones|medidas)\s+(?:de\s+)?(?:la\s+)?(?:cesta|plataforma)\b|\b(?:cesta|plataforma)\s+(?:de\s+)?\d[\d., ]*\s*(?:mm|m)?\s*[x×]/iu.test(sourceText)) {
      const exteriorLength = editorialMetricOf(prepared.specs, ["Longitud", "Longitud total", "Largo"]);
      const exteriorWidth = editorialMetricOf(prepared.specs, ["Anchura", "Ancho total", "Anchura total", "Ancho"]);
      add(["Longitud de plataforma", "Longitud plataforma", "Largo de plataforma"], "longitud de plataforma", "m", 0.5,
        Math.min(exteriorLength ?? 12, 12), /\b(?:longitud|largo)\s+(?:de\s+(?:la\s+)?)?(?:cesta|plataforma)\b/iu);
      add(["Anchura de plataforma", "Ancho de plataforma", "Ancho plataforma", "Anchura plataforma"], "anchura de plataforma", "m", 0.4,
        Math.min(exteriorWidth ?? 6, 6), /\b(?:anchura|ancho)\s+(?:de\s+(?:la\s+)?)?(?:cesta|plataforma)\b/iu);
    }
  };
  const addPlatformHeight = (work: number): void => add(["Altura plataforma", "Altura Plataforma", "Altura de plataforma", "Altura máxima de plataforma"],
    "altura de plataforma", "m", 0.5, work - 0.1, /\baltura\s+(?:m[aá]xima\s+)?(?:de\s+(?:la\s+)?)?plataforma\b[^.!?;\n]{0,30}\d/iu);
  const addBoomGeometry = (): void => {
    add(["Longitud de plumín", "Longitud del plumín"], "longitud de plumín", "m", 0.2, 10, /\b(?:plum[ií]n|jib)\b/iu);
    add(["Rotación de torreta"], "rotación de torreta", "°", 1, 360, /\b(?:torreta|torre|rotaci[oó]n|giro|giratori[oa])\b/iu);
  };
  if (atCompositionLimit) {
    const work = editorialMetricOf(prepared.specs, ["Altura de trabajo", "Altura trabajo", "Altura de trabajo (m)"]);
    if (work === null || work < 3 || work > 60) return null;
    if (family === "plataforma-tijera") addStowedGradeability();
    const gradeability = details[0];
    addExteriorTurningRadius();
    addWheelbase();
    if (family === "plataforma-tijera") addPlatformExtension();
    if (boomPlatform) {
      addPlatformHeight(work);
      addBoomGeometry();
    }
    addPlatformDimensions();
    const geometry = details.filter((detail) => detail !== gradeability);
    if (!gradeability && geometry.length === 0) return null;
    const geometryText = geometry.length <= 1 ? geometry[0] : `${geometry.slice(0, -1).join(", ")} y ${geometry[geometry.length - 1]}`;
    const maneuverability = geometryText ? `El modelo presenta ${geometryText}.` : "";
    const slope = gradeability ? `El modelo presenta ${gradeability}. Esta prestación no indica la inclinación admisible durante el trabajo en altura.` : "";
    return `${general.trim()}\n\n${[maneuverability, slope].filter(Boolean).join(" ")}`;
  }
  const addReviewedDetail = (key: string, expected: string, text: string, mention: RegExp): void => {
    if (mention.test(sourceText)) return;
    const foldedKey = (field: string) => normalizeSpecKey(field).normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
    const fields = (specs: SpecsMap | undefined) => Object.entries(specs ?? {})
      .filter(([field]) => foldedKey(field) === foldedKey(key));
    const reviewed = fields(reviewedModelSpecs);
    const current = fields(prepared.specs);
    if (reviewed.length && current.length &&
      [...reviewed, ...current, ...fields(original.specs)].every(([, value]) => value === expected)) details.push(text);
  };
  if (family === "apilador" || family === "transpaleta") {
    addReviewedDetail("Propulsión", "Manual", "propulsión manual", /\b(?:propulsi[oó]n|tracci[oó]n|desplazamiento)\s+(?:manual|el[eé]ctric[oa])\b/iu);
    addReviewedDetail("Dirección", "Asistida en ambas ruedas", "dirección asistida en ambas ruedas", /\bdirecci[oó]n\b/iu);
    const liftMention = /\b(?:accionamiento(?: [a-záéíóú]+){0,2} de elevaci[oó]n|elevaci[oó]n\s+(?:manual|el[eé]ctrica|hidr[aá]ulica)|bomba hidr[aá]ulica)\b/iu;
    addReviewedDetail("Accionamiento de elevación", "Hidráulico manual", "accionamiento hidráulico manual de elevación", liftMention);
    addReviewedDetail("Accionamiento de elevación", "Manual", "accionamiento manual de elevación", liftMention);
    if (!/\b(?:apilador|transpaleta)\s+manual\b/iu.test(sourceText)) {
      addReviewedDetail("Accionamiento de elevación", "Eléctrico", "accionamiento eléctrico de elevación", liftMention);
    }
    addReviewedDetail("Conducción con timón vertical", "Permitida", "conducción con el timón en posición vertical", /\btim[oó]n\b[^.!?;\n]{0,55}\bvertical\b/iu);
    addReviewedDetail("Freno de estacionamiento", "Incorporado", "freno de estacionamiento", /\bfreno de estacionamiento\b/iu);
    addReviewedDetail("Patas envolventes", "Para palés cerrados", "patas envolventes para palés cerrados", /\b(?:pal[eé]s cerrados|patas envolventes)\b/iu);
    const controllerMention = /\b(?:controlador|curtis|ACF2C)\b/iu;
    addReviewedDetail("Controlador de tracción", "Curtis (CA)", "controlador de tracción Curtis (CA)", controllerMention);
    addReviewedDetail("Controlador de tracción", "Curtis ACF2C", "controlador de tracción Curtis ACF2C", controllerMention);
    if (family === "transpaleta") {
      add(["Recorrido de elevación"], "recorrido de elevación", "mm", 50, 2000,
        /\b(?:recorrido|carrera)\s+de\s+elevaci[oó]n\b/iu);
      add(["Elevación de las horquillas"], "recorrido de elevación de las horquillas", "mm", 50, 800,
        /\b(?:altura|recorrido|carrera)\s+de\s+elevaci[oó]n\b|\belevaci[oó]n\s+de\s+(?:las\s+)?horquillas\b/iu);
      addReviewedDetail("Sistema de elevación", "Elevación rápida permanente", "sistema de elevación rápida permanente", /\belevaci[oó]n\s+r[aá]pida\b/iu);
      addReviewedDetail("Protección de las células de carga", "IP68", "protección IP68 de las células de carga", /\bIP\s*\d{2}\b/iu);
    }
  } else if (family === "martillo-miniexcavadora") {
    add(["Diámetro nominal de herramienta compatible"], "diámetro nominal de herramienta compatible", "mm", 20, 300,
      /\b(?:di[aá]metro|medida|tama[ñn]o)\b[^.!?;\n]{0,45}\b(?:herramienta|puntero|cincel|pica)\b|\b(?:herramienta|puntero|cincel|pica)\b[^.!?;\n]{0,45}\d+\s*mm\b/iu);
  } else if (family === "manipulador-telescopico") {
    add(["Alcance horizontal", "Alcance horizontal (m)"], "alcance horizontal", "m", 0.5, 50,
      /\balcance\s+horizontal\b[^.!?;\n]{0,35}\d/iu);
    add(["Longitud de transporte"], "longitud de transporte", "m", 0.5, 30,
      /\blongitud\s+de\s+transporte\b/iu);
    add(["Anchura de transporte"], "anchura de transporte", "m", 0.5, 8,
      /\b(?:anchura|ancho)\s+de\s+transporte\b/iu);
  }
  if (family.startsWith("plataforma-")) {
    const work = editorialMetricOf(prepared.specs, ["Altura de trabajo", "Altura trabajo", "Altura de trabajo (m)"]);
    if (work === null || work < 3 || work > 60) return null;
    addPlatformHeight(work);
    if (family === "plataforma-articulada" || family === "plataforma-telescopica" || family === "plataforma-oruga") {
      add(["Alcance lateral", "Alcance Lateral", "Alcance horizontal", "Alcance horizontal máximo", "Alcance horizontal max.", "Alcance horizontal (m)"],
        "alcance horizontal", "m", 0.5, 60, /\balcance\s+(?:lateral|horizontal)\b[^.!?;\n]{0,35}\d/iu);
      addBoomGeometry();
      add(["Rotación de cesta"], "rotación de cesta", "°", 1, 360,
        /\b(?:rotaci[oó]n|giro|gira|giratori[oa]|orientaci[oó]n|orientable)\b[^.!?;\n]{0,45}\b(?:cesta|plataforma)\b|\b(?:cesta|plataforma)\b[^.!?;\n]{0,45}\b(?:rotaci[oó]n|giro|gira|giratori[oa]|orientaci[oó]n|orientable)\b/iu);
    }
    if (family === "plataforma-telescopica") {
      add(["Anchura con ejes recogidos"], "anchura con ejes recogidos", "m", 0.5, 8,
        /\b(?:anchura|ancho)\b[^.!?;\n]{0,45}\bejes\b/iu);
      add(["Capacidad de plataforma sin restricciones"], "capacidad de plataforma sin restricciones", "kg", 100, 1500,
        /\b(?:capacidad|carga)\b[^.!?;\n]{0,55}\d+\s*kg\b/iu);
    }
    addWheelbase();
    add(["Capacidad máxima de plataforma", "Capacidad de plataforma", "Capacidad", "Capacidad de carga", "Capacidad de carga (kg)", "Capacidad carga"],
      "capacidad máxima de plataforma", "kg", 100, 1500, /\b(?:capacidad|carga)\b[^.!?;\n]{0,45}\d+\s*kg\b/iu);
    if (family === "plataforma-articulada" || family === "plataforma-tijera") {
      addExteriorTurningRadius();
    }
    if (family === "plataforma-tijera") {
      addStowedGradeability();
      addPlatformExtension();
    }
    addPlatformDimensions();
  } else if (family === "carretilla-elevadora" || family === "carretilla-retractil" || family === "apilador") {
    if (family === "carretilla-elevadora" && /\btrilateral\b/iu.test(sourceText)) {
      add(["Rotación del cabezal trilateral"], "rotación del cabezal trilateral", "°", 1, 360,
        /\b(?:rotaci[oó]n|giro)\s+(?:del?\s+)?cabezal\b/iu);
    }
    const centreKeys = ["Centro de carga", "Centro de carga (mm)", "Centro de carga nominal", "Centro de carga nominal del modelo"];
    const nominalKey = normalizeSpecKey("Centro de carga nominal del modelo");
    if (Object.keys(reviewedModelSpecs).some((key) => normalizeSpecKey(key) === nominalKey)) {
      add(centreKeys, "centro de carga nominal", "mm", 100, 3000,
        /\bcentro\s+de\s+carga\b[^.!?;\n]{0,35}\d/iu);
    }
  } else if (family === "almacen-vertical") {
    const trayDimensions = ["Dimensiones de bandeja", "Dimensiones bandeja", "Medidas de bandeja"].map(normalizeSpecKey);
    const combinedTray = [original, prepared].some((record) => Object.keys(record.specs ?? {}).some((key) => trayDimensions.includes(normalizeSpecKey(key)))) ||
      /\bbandejas?\s+(?:de\s+)?\d[\d., ]*\s*(?:mm|m)?\s*[x×]/iu.test(sourceText);
    if (!combinedTray) {
      add(["Anchura de bandeja", "Ancho de bandeja"], "anchura de bandeja", "mm", 100, 10000,
      /\b(?:anchura|ancho|dimensiones|medidas)\s+(?:de\s+)?(?:la\s+)?bandeja\b[^.!?;\n]{0,35}\d/iu);
      add(["Profundidad de bandeja"], "profundidad de bandeja", "mm", 100, 5000,
      /\b(?:profundidad|dimensiones|medidas)\s+(?:de\s+)?(?:la\s+)?bandeja\b[^.!?;\n]{0,35}\d/iu);
    }
    add(["Anchura exterior del almacén", "Ancho exterior del almacén"], "anchura exterior del almacén", "mm", 100, 15000,
      /\b(?:anchura|ancho)\s+exterior\b[^.!?;\n]{0,35}\d/iu);
  } else if (family === "recogepedidos") {
    if (reviewedModelSpecs["Velocidad máxima de desplazamiento"] !== undefined) add(["Velocidad máxima de desplazamiento", "Velocidad de desplazamiento (km/h)"],
      "velocidad máxima de desplazamiento", "km/h", 0.1, 30, /\bvelocidad\b[^.!?;\n]{0,45}\d/iu);
    const steering = reviewedModelSpecs["Dirección"];
    if (steering === "Eléctrica" && prepared.specs?.["Dirección"] === steering &&
      (original.specs?.["Dirección"] === undefined || original.specs["Dirección"] === steering) &&
      !/\bdirecci[oó]n\b/iu.test(sourceText)) details.push("dirección eléctrica");
  }
  if (details.length === 0) return null;
  const text = details.length === 1 ? details[0] : `${details.slice(0, -1).join(", ")} y ${details[details.length - 1]}`;
  return `${general.trim()}\n\nEl modelo presenta ${text}.`;
};
