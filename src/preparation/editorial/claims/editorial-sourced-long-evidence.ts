import { sameProductProvider } from "../../../catalog/identity.js";
import type { ProductTechnicalProvenance } from "../../../contracts/technical-provenance.js";
import { matchesTechnicalDocumentVerification } from "../../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";
import { containsEditorialBrandModel } from "../identity/editorial-identity-match.js";
import { editorialMetricOf, formatEditorialQuantity } from "../measurements/editorial-measurements.js";
import { captureSourceEditorialEvidence } from "./source-editorial-evidence.js";
import { normalizeSpecKey } from "../../../catalog/normalization/normalize-specs.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { EditorialFamily } from "../core/editorial-families.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import { verifiedEditorialIdentity } from "../core/editorial-source-contract.js";
import { verifiedEditorialUnitPair, resolvedEditorialUnitFamilies } from "../identity/editorial-unit-provenance.js";

type DocumentedFeature = Readonly<{
  families: readonly EditorialFamily[];
  declaration: RegExp;
  additional: readonly RegExp[];
  mention: RegExp;
  text: string;
}>;

const features: readonly DocumentedFeature[] = [
  {
    families: ["barredora"],
    declaration: /\b(?:7[., ]?440\s*m[²2]\s*(?:por\s*hora|\/h)|7[., ]?440\s*m[²2]\s*\/\s*h)\b/giu,
    additional: [/\bcepillo\s+principal\s+de\s+680\s*mm\b/giu, /\bcepillo\s+lateral\s+de\s+520\s*mm\b/giu],
    mention: /\b7[., ]?440\b/iu,
    text: "La descripción del fabricante indica una cobertura de hasta 7.440 m² por hora y especifica cepillos principal de 680 mm y lateral de 520 mm. Estas cifras son prestaciones de catálogo, sujetas a la configuración y las condiciones de uso."
  },
  {
    families: ["grupo-electrogeno"],
    declaration: /\bcarrocer[ií]a\s+(?:es\s+)?insonora\b/giu,
    additional: [/\bsoportes?\s+antivibraci[oó]n\b/giu, /\bpaneles?\s+modulares?\b/giu],
    mention: /\b(?:insonora|antivibraci[oó]n)\b/iu,
    text: "El proveedor describe una carrocería insonora formada por paneles modulares y una bancada con soportes antivibración. La composición de la carrocería corresponde a la descripción del producto y debe contrastarse al comprobar la unidad suministrada."
  },
  {
    families: ["carretilla-retractil"],
    declaration: /\bmodo\s+de\s+rendimiento\s+ECO-eLo\b/giu,
    additional: [],
    mention: /\bECO-eLo\b/iu,
    text: "El fabricante menciona el modo de rendimiento ECO-eLo para gestionar el consumo energético en operaciones prolongadas. Su disponibilidad, configuración y efecto sobre el consumo han de comprobarse para la máquina ofertada."
  },
  {
    families: ["apilador"],
    declaration: /\bacero\s+resistente\s+al\s+[aá]cido\s+AISI\s*316L\b/giu,
    additional: [/\bchasis\s+de\s+las\s+horquillas\b/giu],
    mention: /\bAISI\s*316L\b/iu,
    text: "La fuente documenta acero AISI 316L para el chasis de las horquillas, dentro de una propuesta orientada a actividades que exigen higiene. El material y la configuración deben confirmarse en la unidad anunciada."
  }
];

export const resolveSourcedLongEvidence = (
  source: ProductRecord, prepared: ProductRecord, general: string | null
): string | null => {
  const description = source.longDescription?.trim();
  if (!description || !general?.trim() || description.split(/\s+/u).length < 60 ||
    general.trim().split(/\s+/u).length >= 60 ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !verifiedEditorialUnitPair(source, prepared)) return null;
  const family = resolvedEditorialUnitFamilies(source, prepared);
  const currentFamily = family?.[0];
  if (!currentFamily || currentFamily !== family?.[1]) return null;
  const additions = features.filter((feature) =>
    feature.families.includes(currentFamily) && !feature.mention.test(general) &&
    hasUnconditionalEditorialClaim(description, feature.declaration) &&
    feature.additional.every((pattern) => hasUnconditionalEditorialClaim(description, pattern))
  ).map((feature) => feature.text);
  return additions.length ? `${general.trim()} ${additions.join(" ")}` : null;
};

const reviewedPlatformMeasures = [
  { fields: ["Extensión de plataforma"], label: "extensión de plataforma", mention: /\b(?:extensi[oó]n|extensible|prolongaci[oó]n)\b[^.!?;]{0,35}\d|\d[.,\d]*\s*(?:m|mm)\s+de\s+extensi[oó]n/iu, min: 0.2, max: 3 },
  { fields: ["Altura de plataforma", "Altura máxima de plataforma"], label: "altura de plataforma", mention: /\baltura\s+(?:m[aá]xima\s+)?(?:de\s+)?(?:la\s+)?(?:plataforma|cesta)\b[^.!?;]{0,22}\d|\d[.,\d]*\s*(?:m|mm)\s+de\s+altura\s+(?:de\s+)?(?:la\s+)?(?:plataforma|cesta)/iu, min: 0.5, max: 80 },
  { fields: ["Alcance horizontal (m)", "Alcance horizontal máximo"], label: "alcance horizontal", mention: /\balcance\s+(?:horizontal|lateral)\b[^.!?;]{0,22}\d|\d[.,\d]*\s*(?:m|mm)\s+de\s+alcance\s+(?:horizontal|lateral)/iu, min: 0.5, max: 60 },
  { fields: ["Distancia entre ejes (mm)"], label: "distancia entre ejes", mention: /\b(?:distancia\s+entre\s+ejes|batalla)\b/iu, min: 0.5, max: 8 },
  { fields: ["Anchura de plataforma"], label: "anchura de plataforma", mention: /\b(?:anchura|ancho)\s+(?:de\s+)?(?:la\s+)?(?:plataforma|cesta)\b|\b(?:plataforma|cesta)\s+(?:de\s+)?\d[\d.,]*\s*(?:m|mm)\s+de\s+(?:anchura|ancho)\b|\b(?:plataforma|cesta)\s+(?:(?:con|tiene|presenta)\s+)?(?:una?\s+)?(?:anchura|ancho|dimensiones)\b|\b(?:dimensiones|medidas)\s+(?:de\s+)?(?:la\s+)?(?:plataforma|cesta)\b|\b(?:plataforma|cesta)\s+(?:de\s+)?\d[\d.,]*\s*(?:m|mm)?\s*[x×]\s*\d[\d.,]*\s*(?:m|mm)\b/iu, min: 0.3, max: 5 },
  { fields: ["Longitud de plataforma"], label: "longitud de plataforma", mention: /\b(?:longitud|largo)\s+(?:de\s+)?(?:la\s+)?(?:plataforma|cesta)\b|\b(?:plataforma|cesta)\s+(?:de\s+)?\d[\d.,]*\s*(?:m|mm)\s+de\s+(?:longitud|largo)\b|\b(?:plataforma|cesta)\s+(?:(?:con|tiene|presenta)\s+)?(?:una?\s+)?(?:longitud|largo|dimensiones)\b|\b(?:dimensiones|medidas)\s+(?:de\s+)?(?:la\s+)?(?:plataforma|cesta)\b|\b(?:plataforma|cesta)\s+(?:de\s+)?\d[\d.,]*\s*(?:m|mm)?\s*[x×]\s*\d[\d.,]*\s*(?:m|mm)\b/iu, min: 0.3, max: 15 }
] as const;

const reviewedModelValue = (
  original: ProductRecord, prepared: ProductRecord, provenance: ProductTechnicalProvenance, fields: readonly string[]
): string | null => {
  if (Object.keys(original.specs ?? {}).some((key) => fields.includes(normalizeSpecKey(key)))) return null;
  const entries = provenance.entries.filter((entry) => fields.includes(entry.field));
  if (entries.length !== 1) return null;
  const entry = entries[0];
  if (!entry || entry.scope !== "model-document" || entry.document.brand !== original.brand ||
    entry.document.model !== original.model ||
    !matchesTechnicalDocumentVerification(entry.document, entry.field, entry.value, entry.verification)) return null;
  const keys = Object.keys(prepared.specs ?? {}).filter((key) => fields.includes(normalizeSpecKey(key)));
  const preparedValue = prepared.specs?.[keys[0] ?? ""];
  return keys.length === 1 && preparedValue === entry.value ? entry.value : null;
};

const reviewedModelCaution = "Son prestaciones de referencia del modelo; deben contrastarse con la configuración concreta de la unidad.";

export const resolveReviewedModelGeneral = (
  original: ProductRecord, prepared: ProductRecord, general: string | null, provenance: ProductTechnicalProvenance
): string | null => {
  if (!general?.trim() || general.includes(reviewedModelCaution) || general.trim().split(/\s+/u).length > 150 ||
    !original.brand || !original.model || !sameProductProvider(original, prepared) ||
    !captureSourceEditorialEvidence(original).identityVerified || !captureSourceEditorialEvidence(prepared).identityVerified ||
    !verifiedEditorialUnitPair(original, prepared) ||
    !containsEditorialBrandModel(general, original.brand, original.model) ||
    provenance.originalRecordSha256 !== originalRecordFingerprint(original)) return null;
  const families = resolvedEditorialUnitFamilies(original, prepared);
  const family = families?.[0];
  if (!family || family !== families?.[1]) return null;
  const additions: string[] = [];
  const forklift = family === "carretilla-elevadora" || family === "carretilla-retractil";
  const boom = family === "plataforma-articulada" || family === "plataforma-telescopica";
  const modelReferencePrefix = `La documentación técnica de referencia del modelo ${original.brand} ${original.model} recoge `;
  const modelReferenceCaution = ". Las magnitudes corresponden al modelo o versión documentada y no acreditan la configuración ni las prestaciones de esta unidad.";
  const referenceStart = general.indexOf(modelReferencePrefix);
  const referenceEnd = referenceStart < 0 ? -1 : general.indexOf(modelReferenceCaution, referenceStart + modelReferencePrefix.length);
  const existingModelReference = referenceStart >= 0 && referenceEnd >= 0 &&
    general.indexOf(modelReferencePrefix, referenceStart + modelReferencePrefix.length) < 0;
  const longGeneral = general.trim().split(/\s+/u).length > 100;
  if (!forklift && longGeneral && !(boom && existingModelReference)) return null;
  if (family === "plataforma-tijera" || family === "plataforma-articulada" || family === "plataforma-telescopica" || family === "plataforma-oruga") {
    for (const measure of longGeneral ? [] : reviewedPlatformMeasures) {
      if (measure.mention.test(general)) continue;
      if (measure.label === "extensión de plataforma" && family !== "plataforma-tijera") continue;
      const value = reviewedModelValue(original, prepared, provenance, measure.fields);
      const metres = value === null ? null : editorialMetricOf({ value }, ["value"]);
      if (metres === null || metres < measure.min || metres > measure.max) continue;
      additions.push(`${measure.label} de ${formatEditorialQuantity(metres)} m`);
      if (additions.length === 2) break;
    }
    const texts = [general, original.title, original.shortDescription, original.longDescription,
      prepared.title, prepared.shortDescription, prepared.longDescription];
    if (boom && !texts.some((text) => /\b(?:plum[ií]n|jib)\b/iu.test(text ?? ""))) {
      const fields = ["Longitud de plumín"];
      const competing = [original, prepared].some((record) => Object.keys(record.specs ?? {}).some((key) =>
        /\b(?:plum[ií]n|jib)\b/iu.test(key) && !fields.includes(normalizeSpecKey(key))));
      const value = competing ? null : reviewedModelValue(original, prepared, provenance, fields);
      const metres = value === null ? null : editorialMetricOf({ value }, ["value"]);
      if (metres !== null && metres >= 0.3 && metres <= 10 && additions.length < 2) {
        additions.push(`longitud de plumín de ${formatEditorialQuantity(metres)} m`);
      }
    }

  } else if (forklift) {
    const centreFields = ["Centro de carga nominal del modelo"];
    const centre = reviewedModelValue(original, prepared, provenance, centreFields);
    const metres = centre === null ? null : editorialMetricOf({ value: centre }, ["value"]);
    const explicitCentre = /\bcentro\s+de\s+carga\b[^.!?;]{0,35}\d|\d[\d.,]*\s*(?:mm|m)\s+(?:de|al)\s+centro\s+de\s+carga\b/iu;
    const otherCentre = [original, prepared].some((record) => Object.keys(record.specs ?? {}).some((key) =>
      /^centro\s+de\s+carga\b/iu.test(key.trim()) && !centreFields.includes(normalizeSpecKey(key))));
    if (metres !== null && metres >= 0.1 && metres <= 3 && !otherCentre &&
      ![general, original.title, original.shortDescription, original.longDescription, prepared.title,
        prepared.shortDescription, prepared.longDescription].some((text) => explicitCentre.test(text ?? ""))) {
      additions.push(`centro de carga nominal de ${formatEditorialQuantity(metres * 1000)} mm`);
    }
  } else if (family === "almacen-vertical") {
    const widthValue = reviewedModelValue(original, prepared, provenance, ["Anchura de bandeja"]);
    const depthValue = reviewedModelValue(original, prepared, provenance, ["Profundidad de bandeja"]);
    const width = widthValue === null ? null : editorialMetricOf({ value: widthValue }, ["value"]);
    const depth = depthValue === null ? null : editorialMetricOf({ value: depthValue }, ["value"]);
    const mentions = /\b(?:anchura|ancho|profundidad|fondo|dimensiones|medidas)\s+(?:de\s+)?(?:(?:la|las)\s+)?bandejas?\b|\bbandejas?\s+(?:de\s+)?\d[\d.,]*\s*(?:m|mm)?\s*[x×]\s*\d[\d.,]*\s*(?:m|mm)\b/iu;
    if (width !== null && depth !== null && width >= 0.3 && width <= 8 && depth >= 0.2 && depth <= 3 &&
      !mentions.test(general) && !mentions.test(original.longDescription ?? "") && !mentions.test(original.shortDescription ?? "")) {
      additions.push(`anchura de bandeja de ${formatEditorialQuantity(width)} m y profundidad de bandeja de ${formatEditorialQuantity(depth)} m`);
    }
  } else if (family === "apilador" || family === "transpaleta") {
    const propulsion = reviewedModelValue(original, prepared, provenance, ["Propulsión"]);
    const lifting = reviewedModelValue(original, prepared, provenance, ["Accionamiento de elevación", "Elevación"]);
    const sourceText = [original.title, original.shortDescription, original.longDescription, prepared.title, prepared.shortDescription, prepared.longDescription].filter(Boolean).join(" ");
    if (propulsion === "Manual" && !/\b(?:propulsi[oó]n|tracci[oó]n|desplazamiento)\s+(?:manual|el[eé]ctric[oa])\b|\b(?:apilador|transpaleta)\s+manual\b/iu.test(general) &&
      !/\b(?:propulsi[oó]n|tracci[oó]n|desplazamiento)\s+el[eé]ctric[oa]\b/iu.test(sourceText)) additions.push("propulsión manual");
    if (!/\b(?:elevaci[oó]n|accionamiento)\s+(?:hidr[aá]ulic[oa]\s+)?(?:manual|el[eé]ctric[oa])\b/iu.test(general)) {
      const manualConflict = /\b(?:elevaci[oó]n|accionamiento)\s+el[eé]ctric[oa]\b/iu.test(sourceText);
      const electricConflict = /\b(?:elevaci[oó]n|accionamiento)\s+(?:hidr[aá]ulic[oa]\s+)?manual\b/iu.test(sourceText);
      if ((lifting === "Hidráulico manual" || lifting === "Hidráulica manual") && !manualConflict) additions.push("accionamiento hidráulico manual de elevación");
      else if (lifting === "Manual" && !manualConflict) additions.push("accionamiento manual de elevación");
      else if (lifting === "Eléctrico" && !electricConflict) additions.push("accionamiento eléctrico de elevación");
    }
    const tiller = reviewedModelValue(original, prepared, provenance, ["Conducción con timón vertical"]);
    if (tiller === "Permitida" && !/\btim[oó]n\s+vertical\b/iu.test(general)) additions.push("posibilidad de conducción con el timón en posición vertical");
    const steering = reviewedModelValue(original, prepared, provenance, ["Dirección"]);
    if (steering === "Asistida en ambas ruedas" && !/\bdirecci[oó]n\b/iu.test(general)) additions.push("dirección asistida en ambas ruedas");
    const travel = reviewedModelValue(original, prepared, provenance, ["Recorrido de elevación"]);
    const metres = travel === null ? null : editorialMetricOf({ value: travel }, ["value"]);
    if (metres !== null && metres >= 0.05 && metres <= 2 && !/\b(?:recorrido|carrera)\s+de\s+elevaci[oó]n\b/iu.test(general)) additions.push(`recorrido de elevación de ${formatEditorialQuantity(metres)} m`);
    const workHeight = reviewedModelValue(original, prepared, provenance, ["Altura de trabajo con caja inclinada"]);
    const range = workHeight === null ? null : /^(\d{3,4})[–-](\d{3,4})\s*mm$/u.exec(workHeight);
    if (range?.[1] && range[2] && !/\baltura\s+de\s+trabajo\b/iu.test(general)) {
      const [min, max] = [Number(range[1]), Number(range[2])];
      if (min >= 300 && min < max && max <= 2000) additions.push(`altura de trabajo con caja inclinada de ${formatEditorialQuantity(min / 1000)} a ${formatEditorialQuantity(max / 1000)} m`);
    }
    if (additions.length > 2) additions.splice(2);
  } else if (family === "recogepedidos") {
    const speed = reviewedModelValue(original, prepared, provenance, ["Velocidad máxima de desplazamiento"]);
    const match = speed === null ? null : /^(\d{1,2}(?:[.,]\d{1,2})?)\s*km\/h$/iu.exec(speed);
    const kmh = match?.[1] ? Number(match[1].replace(",", ".")) : null;
    if (kmh !== null && kmh >= 0.5 && kmh <= 25 && !/\bvelocidad\b|\bkm\s*\/\s*h\b/iu.test(general)) {
      additions.push(`velocidad máxima de desplazamiento de ${formatEditorialQuantity(kmh)} km/h`);
    }
    const steering = reviewedModelValue(original, prepared, provenance, ["Dirección"]);
    if (steering === "Eléctrica" && !/\bdirecci[oó]n\b/iu.test(general)) additions.push("dirección eléctrica");
  }
  if (additions.length === 0) return null;
  if (boom && longGeneral && existingModelReference) {
    return `${general.slice(0, referenceEnd)}, ${additions.join(" y ")}${general.slice(referenceEnd)}`;
  }
  return `${general.trim()}\n\nLa documentación técnica del modelo ${original.brand} ${original.model} recoge ${additions.join(" y ")}. ` +
    reviewedModelCaution;
};
