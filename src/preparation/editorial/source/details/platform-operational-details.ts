import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFamily } from "../../core/editorial-families.js";
import { formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { resolvedEditorialUnitFamilies } from "../../identity/editorial-unit-provenance.js";
import { declaredBoolean, matchingMetric, affirmativeSpecs } from "./equipment-detail-values.js";

const wheelTraction = (record: ProductRecord): "4×2" | "4×4" | null => {
  const value = record.specs?.Tracción;
  const fourWheel = record.specs?.["Tracción 4x4"];
  const fourWheelDeclared = declaredBoolean(fourWheel);
  if (fourWheel !== undefined && fourWheelDeclared === null) return null;
  if (value === undefined) return fourWheelDeclared === true ? "4×4" : null;
  if (typeof value !== "string") return null;
  const match = /^4\s*[x×]\s*([24])$/iu.exec(value.trim());
  if (!match?.[1]) return null;
  const allWheels = match[1] === "4";
  return fourWheelDeclared !== null && fourWheelDeclared !== allWheels ? null : allWheels ? "4×4" : "4×2";
};

export const resolvePlatformOperationalDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily
): readonly string[] => {
  if (!["plataforma-tijera", "plataforma-articulada", "plataforma-telescopica", "plataforma-mastil",
      "plataforma-unipersonal", "plataforma-oruga", "camion-cesta"].includes(family)) return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const originalText = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  const addMetric = (keys: readonly string[], label: string, mention: RegExp, min: number, max: number): void => {
    const value = matchingMetric(source, prepared, keys);
    if (value !== null && value >= min && value <= max && !mention.test(originalText)) {
      details.push(`${label} de ${formatEditorialQuantity(value)} m`);
    }
  };
  const addFeature = (keys: readonly string[], label: string, mention: RegExp): void => {
    if (affirmativeSpecs(source, keys) && affirmativeSpecs(prepared, keys) && !mention.test(originalText)) details.push(label);
  };
  if (family !== "plataforma-oruga" && family !== "camion-cesta") {
    const traction = wheelTraction(source);
    if (traction !== null && traction === wheelTraction(prepared) &&
      !/\b(?:tracci[oó]n|4\s*[x×]\s*[24]|[24]wd)\b/iu.test(originalText)) {
      details.push(`tracción ${traction} declarada`);
    }
  }
  const work = matchingMetric(source, prepared, ["Altura trabajo", "Altura de trabajo", "Altura de trabajo (m)"]);
  if (family === "plataforma-mastil" && work !== null && work >= 3 && work <= 60) {
    const platformLength = matchingMetric(source, prepared, ["Longitud plataforma", "Longitud de plataforma"]);
    const keys = ["Alcance horizontal", "Alcance horizontal max.", "Alcance lateral", "Alcance Lateral"];
    const reach = matchingMetric(source, prepared, keys);
    if (platformLength !== null && platformLength >= 0.4 && platformLength <= 5 &&
      reach !== null && reach > platformLength && reach <= work &&
      !["Longitud extensión", "Extensión de plataforma"].some((key) =>
        source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined)) {
      addMetric(keys, "alcance horizontal declarado", /\b(?:alcance|radio de trabajo)\b/iu, platformLength, work);
    }
  }
  if (family === "plataforma-tijera") {
    const retracted = matchingMetric(source, prepared, ["Altura replegada", "Altura almacenaje"]);
    if (retracted !== null && work !== null && work >= 3 && work <= 60 && retracted <= Math.min(work, 30)) {
      addMetric(["Altura barandilla bajada", "Altura con barandillas bajadas"],
        "altura con barandillas bajadas", /\bbarandillas?\b/iu, 0.5, retracted);
    }
  }
  if (family === "plataforma-tijera" || family === "plataforma-unipersonal") {
    const length = matchingMetric(source, prepared, ["Longitud plataforma", "Longitud de plataforma"]);
    if (length !== null && length >= 0.5 && length <= 12) {
      addMetric(["Longitud extensión", "Extensión de plataforma"], "extensión de plataforma",
        /\bextensi[oó]n\b|\bplataforma\s+extensible\b/iu, 0.1, Math.min(length, 5));
    }
  }
  if (family === "plataforma-articulada" || family === "plataforma-telescopica") {
    const overall = matchingMetric(source, prepared, ["Longitud total", "Longitud", "Largo"]);
    if (overall !== null && overall >= 1 && overall <= 25) {
      addMetric(["Longitud transporte", "Longitud de transporte"], "longitud de transporte declarada",
        /\b(?:transporte|transportada|transportado)\b/iu, 1, overall - 0.01);
    }
  }
  if (family === "camion-cesta" && work !== null && work >= 3 && work <= 60) {
    const hasFields = (keys: readonly string[]): boolean => keys.some((key) =>
      source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    if (!hasFields(["Altura", "Altura total", "Altura exterior", "Altura almacenaje", "Altura replegada"])) {
      addMetric(["Altura transporte", "Altura de transporte"], "altura de transporte declarada",
        /\b(?:altura|alto)\s+(?:de\s+|en\s+)?(?:transporte|almacenaje|replegad[oa]|total|exterior)\b/iu, 1.5, Math.min(5, work - 0.1));
    }
    if (!hasFields(["Dimensiones Cesta", "Dimensiones de cesta", "Dimensiones de la cesta", "Cesta",
        "Longitud plataforma", "Longitud de plataforma", "Ancho plataforma", "Anchura de plataforma"]) &&
      !/\b(?:dimensiones|medidas|longitud|largo|ancho|anchura)\s+(?:de\s+)?(?:la\s+)?(?:cesta|plataforma)\b|\b(?:cesta|plataforma)\s+de\s+\d/iu.test(originalText)) {
      const length = matchingMetric(source, prepared, ["Longitud cesta", "Longitud de cesta", "Longitud de la cesta"]);
      const width = matchingMetric(source, prepared, ["Ancho cesta", "Anchura de cesta", "Anchura de la cesta"]);
      if (length !== null && width !== null && length >= 0.5 && length <= 5 && width >= 0.4 && width <= 3) {
        details.push(`dimensiones de cesta declaradas de ${formatEditorialQuantity(length)} × ${formatEditorialQuantity(width)} m`);
      }
    }
  }
  if (family === "plataforma-articulada" || family === "camion-cesta") {
    if (work !== null && work >= 3 && work <= 60) {
      addMetric(["Altura articulacion", "Altura de articulación"], "altura de articulación",
        /\baltura\s+(?:de\s+)?articulaci[oó]n\b/iu, 0.5, work);
    }
  }
  if (family === "plataforma-articulada" || family === "plataforma-telescopica" || family === "camion-cesta") {
    addFeature(["Trabajo negativo", "Trabajo en negativo"], "trabajo en negativo declarado", /\bnegativ[oa]\b/iu);
    addFeature(["Barra antiatrapamiento"], "barra antiatrapamiento declarada", /\banti[ -]?atrapamiento\b/iu);
  }
  if (["plataforma-tijera", "plataforma-articulada", "plataforma-telescopica", "plataforma-oruga", "camion-cesta"].includes(family)) {
    addFeature(["Estabilizadores"], "estabilizadores declarados", /\bestabilizador(?:es)?\b/iu);
  }
  return details;
};
