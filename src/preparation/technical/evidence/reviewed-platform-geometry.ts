import type { SpecsMap } from "../../../contracts/catalog.js";
import { fold } from "../../classification/category-utils.js";
import { editorialMetricOf } from "../../editorial/measurements/editorial-measurements.js";

export const geometryAliases: Readonly<Record<string, RegExp>> = {
  "Altura de plataforma": /^altura (?:maxima )?(?:de (?:la )?)?plataforma(?: (?:maxima|max\.?))?(?: \(m[m]?\))?$/u,
  "Longitud de plataforma": /^(?:longitud|largo) (?:de (?:la )?)?(?:plataforma|cesta)(?: principal)?(?: \(m[m]?\))?$/u,
  "Anchura de plataforma": /^(?:anchura|ancho) (?:de (?:la )?)?(?:plataforma|cesta)(?: principal)?(?: \(m[m]?\))?$/u,
  "Longitud de plumín": /^(?:longitud|largo) (?:de(?:l)? )?(?:plumin|jib|brazo auxiliar)(?: \(m[m]?\))?$/u,
  "Rotación de torreta": /^(?:rotacion|giro|angulo de giro).*(?:torreta|torre)\b|^torreta giratoria$/u,
  "Rotación de cesta": /^(?:rotacion|giro|angulo de giro).*(?:cesta|plataforma)\b/u,
  "Extensión de plataforma": /^(?:extension(?: de (?:la )?(?:plataforma|cesta))?|longitud (?:de )?extension|plataforma (?:extensible|desplegable|desplazable)|lateral extensible)(?: \(m[m]?\))?$/u
};

export const angularGeometry = (field: string): boolean => field === "Rotación de torreta" || field === "Rotación de cesta";
export const geometryAngle = (value: unknown): number | null => {
  const match = typeof value === "string" ? /^(\d{1,3})\s*[°º]$/u.exec(value.trim()) : null;
  const angle = Number(match?.[1]);
  return Number.isInteger(angle) && angle > 0 && angle <= 360 ? angle : null;
};

export const combinedGeometry = /^(?:dimensiones|medidas) (?:de (?:la )?)?(?:cesta|plataforma)\b/u;
export const explicitGeometry = /\b(?:altura|longitud|anchura|ancho|largo|dimensiones|medidas|extension) (?:de (?:la )?)?(?:plataforma|cesta)\b[^.!?;\n]{0,50}\d|\b(?:plataforma extensible|longitud (?:de )?extension)\b[^.!?;\n]{0,50}\d/u;

export const geometryConfigurationConflict = /\b(?:sin|carece de|no (?:dispone|cuenta) de) (?:una? |la )?(?:extension|plataforma|cesta)\b|\b(?:extension|plataforma|cesta)\b[^.!?;]{0,40}\b(?:opcional|no instalada|no incluida|modificada|sustituida)\b/u;

const wheelbaseEvidence = /\b(?:distancia entre (?:los )?ejes|batalla|wheelbase)\b/u;
const chassisConflict = /\b(?:chasis|bastidor|ejes?)\b[^.!?;]{0,40}\b(?:modificad[oa]s?|sustituid[oa]s?|alargad[oa]s?|acortad[oa]s?)\b|\b(?:modificad[oa]s?|sustituid[oa]s?|alargad[oa]s?|acortad[oa]s?)\b[^.!?;]{0,40}\b(?:chasis|bastidor|ejes?)\b/u;

export const reviewedWheelbase = (value: string, sources: readonly SpecsMap[], sourceText: string, lengthM: number | null): string | null => {
  if (wheelbaseEvidence.test(sourceText) || chassisConflict.test(sourceText) ||
    sources.some((source) => Object.entries(source).some(([key, sourceValue]) =>
      wheelbaseEvidence.test(fold(key)) || chassisConflict.test(fold(`${key} ${String(sourceValue)}`))))) return null;
  const wheelbase = editorialMetricOf({ "Distancia entre ejes (mm)": value }, ["Distancia entre ejes (mm)"]);
  return wheelbase !== null && lengthM !== null && wheelbase < lengthM ? value : null;
};

const turningRadiusEvidence = /\b(?:radio(?: minimo| maximo)? (?:de )?giro|radio de (?:viraje|rotacion)|diametro (?:de )?giro|circulo (?:de )?giro|turning (?:radius|circle))\b/u;
const steeringConflict = /\b(?:direccion|ruedas?|neumaticos?|llantas?|ejes?)\b[^.!?;]{0,40}\b(?:modificad[oa]s?|sustituid[oa]s?|convertid[oa]s?|opcional(?:es)?)\b|\b(?:modificad[oa]s?|sustituid[oa]s?|convertid[oa]s?)\b[^.!?;]{0,40}\b(?:direccion|ruedas?|neumaticos?|llantas?|ejes?)\b/u;

export const reviewedExteriorTurningRadius = (value: string, sources: readonly SpecsMap[], sourceText: string, widthM: number | null): string | null => {
  const conflicts = (text: string): boolean => turningRadiusEvidence.test(text) || chassisConflict.test(text) || steeringConflict.test(text);
  if (conflicts(sourceText) || sources.some((source) => Object.entries(source).some(([key, sourceValue]) =>
    conflicts(fold(`${key} ${String(sourceValue)}`))))) return null;
  const radius = editorialMetricOf({ "Radio de giro exterior del modelo": value }, ["Radio de giro exterior del modelo"]);
  return radius !== null && widthM !== null && radius > widthM / 2 ? value : null;
};

const gradeabilityEvidence = /\b(?:pendientes?|trepabilidad|gradeability|inclinaci[oó]n)\b/u;
const driveConflict = /\b(?:traccion|accionamiento|motor(?:es)?|transmision|bateria(?:s)?)\b[^.!?;]{0,40}\b(?:modificad[oa]s?|sustituid[oa]s?|convertid[oa]s?|opcional(?:es)?)\b|\b(?:modificad[oa]s?|sustituid[oa]s?|convertid[oa]s?)\b[^.!?;]{0,40}\b(?:traccion|accionamiento|motor(?:es)?|transmision|bateria(?:s)?)\b/u;

export const reviewedStowedGradeability = (value: string, sources: readonly SpecsMap[], sourceText: string): string | null => {
  const conflicts = (text: string): boolean => gradeabilityEvidence.test(text) || chassisConflict.test(text) || steeringConflict.test(text) || driveConflict.test(text);
  if (conflicts(sourceText) || sources.some((source) => Object.entries(source).some(([key, sourceValue]) =>
    conflicts(fold(`${key} ${String(sourceValue)}`)) || /^(?:traccion|drive mode)$/u.test(fold(key)) &&
    !/^4\s*[x×]\s*2$/iu.test(String(sourceValue).trim())))) return null;
  const percentage = /^(\d{1,2}) %$/u.exec(value);
  return percentage && Number(percentage[1]) > 0 ? value : null;
};
