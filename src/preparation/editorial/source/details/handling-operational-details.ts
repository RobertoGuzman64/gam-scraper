import { parseDimension, parseMeasuredLength } from "../../../../catalog/normalization/spec-parsers.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFamily } from "../../core/editorial-families.js";
import { formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { hasUnconditionalEditorialClaim } from "../../claims/editorial-claim-evidence.js";
import { verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";
import { containsEditorialBrandModel } from "../../identity/editorial-identity-match.js";
import { resolvedEditorialUnitFamilies } from "../../identity/editorial-unit-provenance.js";
import { equalSpec, matchingMetric, affirmativeSpecs, declaredBoolean, declaredConfiguration } from "./equipment-detail-values.js";

const hydraulicControls = (value: string): string | null => {
  if (/^(?:mini[ -]?palancas|minilevers)$/u.test(value)) return "minipalancas";
  if (value === "palancas" || value === "joystick") return value;
  if (value === "electricos") return "eléctrico";
  return null;
};

const wheelType = (value: string): string | null => {
  if (/^super[ -]?elasticas$/u.test(value)) return "superelásticas";
  if (value === "macizas") return "macizas";
  return null;
};

export const resolveHandlingOperationalDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily
): readonly string[] => {
  const mastFamily = ["carretilla-elevadora", "carretilla-retractil", "apilador"].includes(family);
  if (!mastFamily && family !== "transpaleta" && family !== "manipulador-telescopico") return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const text = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  const addMetric = (keys: readonly string[], label: string, min: number, max: number): void => {
    const value = matchingMetric(source, prepared, keys);
    if (value !== null && value >= min && value <= max) details.push(`${label} de ${formatEditorialQuantity(value * 1000)} mm`);
  };
  if (mastFamily && !/m[aá]stil\s+(?:replegado|recogido|cerrado)|altura\s+(?:de\s+)?replegado/iu.test(text)) {
    const mastKeys = ["Altura mástil replegado", "Altura de mástil replegado"];
    const explicitMast = mastKeys.some((key) => source.specs?.[key] !== undefined && prepared.specs?.[key] !== undefined);
    addMetric([...mastKeys, "Altura max. replegada"],
      explicitMast ? "altura de mástil replegado declarada" : "altura máxima replegada declarada", 0.8, 6);
  }
  if (!/\b(?:horquillas?|tenedores?)\b/iu.test(text)) {
    const keys = ["Largo horquillas", "Longitud de horquillas", "Longitud de tenedor"];
    const combinedKeys = ["Dimensiones Horquillas", "Dimensiones de horquillas", "Dimensiones horquillas (mm)", "Horquillas", "Dim horquillas", "Medidas horquillas", "Dimensión horquillas", "Dimensiones horquilla"];
    const hasFields = (fields: readonly string[]): boolean => fields.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    if (hasFields(keys) && !hasFields(combinedKeys)) {
      const length = matchingMetric(source, prepared, keys);
      if (length !== null && length >= 0.4 && length <= 4) {
        details.push(`longitud de horquillas declarada de ${formatEditorialQuantity(length * 1000)} mm`);
        addMetric(["Ancho horquillas", "Anchura de horquillas"], "anchura de horquillas declarada", 0.05, 0.4);
        addMetric(["Grosor horquillas", "Grosor de horquillas"], "grosor de horquillas declarado", 0.01, 0.15);
      }
    } else if (!hasFields(keys) && !hasFields(["Ancho horquillas", "Anchura de horquillas", "Grosor horquillas", "Grosor de horquillas"])) {
      const present = combinedKeys.filter((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
      const raw = present.length === 1 && present[0] !== undefined ? equalSpec(source, prepared, present[0]) : null;
      const single = raw && /^\d{3,4}\s*mm$/iu.test(raw) ? parseDimension(raw) : null;
      if (single && single.largo !== null && single.ancho === null && single.grosor === null && single.largo >= 400 && single.largo <= 4000) {
        details.push(`longitud de horquillas declarada de ${formatEditorialQuantity(single.largo)} mm`);
      }
      const triple = raw ? /^(\d{3,4})\s*[x×]\s*(\d{2,3})\s*[x×]\s*(\d{2,3})\s*mm$/iu.exec(raw) : null;
      const values = triple?.slice(1).map(Number);
      if (values && values[0] !== undefined && values[1] !== undefined && values[2] !== undefined &&
        values[0] >= 400 && values[0] <= 4000 && values[1] >= 50 && values[1] <= 400 &&
        values[2] >= 10 && values[2] <= 150 && values[2] <= values[1]) {
        details.push(`dimensiones de horquillas declaradas de ${values.map(formatEditorialQuantity).join(" × ")} mm`);
      }
    }
  }
  if (mastFamily && !/\bdesplaza(?:dor|miento)\s+lateral\b/iu.test(text) &&
    affirmativeSpecs(source, ["Desplazador lateral", "Desplazamiento lateral"]) &&
    affirmativeSpecs(prepared, ["Desplazador lateral", "Desplazamiento lateral"])) details.push("desplazador lateral declarado");
  if (mastFamily && !/\belevaci[oó]n libre\b/iu.test(text)) {
    const keys = ["Elevación libre", "Elevación libre (mm)"];
    const availability = ["Elevación libre disponible", "Elevación libre (sí/no)"];
    const unavailable = [source, prepared].some((record) => availability.some((key) =>
      record.specs?.[key] !== undefined && declaredBoolean(record.specs[key]) !== true));
    const values = keys.flatMap((key) => source.specs?.[key] === undefined && prepared.specs?.[key] === undefined ? [] :
      [equalSpec(source, prepared, key)]);
    const heights = values.map((value) => parseMeasuredLength(value, "Elevación libre (mm)", "mm"));
    const free = heights[0];
    const lift = matchingMetric(source, prepared, ["Altura de elevación (mm)", "Altura máxima de elevación", "Altura de elevación", "Altura elevacion"]);
    const mast = matchingMetric(source, prepared, ["Altura mástil replegado", "Altura de mástil replegado", "Altura max. replegada"]);
    if (!unavailable && free !== undefined && free !== null && Number.isInteger(free) && free >= 50 &&
      lift !== null && mast !== null && free < lift * 1000 && free < mast * 1000 && heights.every((value) => value === free)) {
      details.push(`elevación libre declarada de ${formatEditorialQuantity(free)} mm`);
    } else if (!unavailable && affirmativeSpecs(source, keys) && affirmativeSpecs(prepared, keys)) details.push("elevación libre declarada");
  }
  if (family !== "manipulador-telescopico") {
    const raw = equalSpec(source, prepared, "Radio de giro");
    const aliases = ["Radio de giro (mm)", "Radio de giro (m)", "Radio de giro exterior", "Radio giro"];
    if (raw && /^\d{3,4}$/u.test(raw) && !aliases.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined)) {
      const radius = parseMeasuredLength(raw, "Radio de giro (mm)", "mm");
      const mention = /\bradio\s+(?:(?:m[ií]nimo|exterior)\s+)?(?:de\s+)?(?:giro|viraje)\b/giu;
      const explicit = /\bradio\s+(?:(?:m[ií]nimo|exterior)\s+)?(?:de\s+)?(?:giro|viraje)\s*(?:reducido\s+)?(?:(?:es\s+)?de\s+|:\s*)?(?:solo\s+)?(\d{1,4}(?:[.,]\d{1,3})?\s*(?:mm|m|metros?))\b/giu;
      const corroborated = mastFamily && Boolean(source.brand && source.model &&
        verifiedEditorialIdentity(source) && verifiedEditorialIdentity(prepared) &&
        containsEditorialBrandModel(source.longDescription ?? "", source.brand, source.model)) &&
        [source.longDescription, prepared.longDescription].every((description) => {
          const value = description ?? "";
          const claims = [...value.matchAll(explicit)];
          return claims.length > 0 && claims.length === [...value.matchAll(mention)].length &&
            claims.every((claim) => parseMeasuredLength(claim[1], "", "mm") === radius &&
              !/^\s*(?:[-–/]|a\s+\d|o\s+\d|seg[uú]n\b)/iu.test(value.slice((claim.index ?? 0) + claim[0].length))) &&
            hasUnconditionalEditorialClaim(value, explicit);
        }) && [source.title, source.shortDescription, prepared.title, prepared.shortDescription].every((description) =>
          !/\bradio\s+(?:(?:m[ií]nimo|exterior)\s+)?(?:de\s+)?(?:giro|viraje)\b/iu.test(description ?? ""));
      if (radius !== null && radius >= 750 && radius <= 7500 &&
        (!/\bradio\s+(?:(?:m[ií]nimo|exterior)\s+)?(?:de\s+)?(?:giro|viraje)\b/iu.test(text) || corroborated)) {
        details.push(`radio de giro declarado de ${formatEditorialQuantity(radius)} mm`);
      }
    }
  }
  if (mastFamily && source.condition === "Segunda mano") {
    if (!/\b(?:mandos?|controles?|palancas?|minipalancas?|minilevers|joystick|hidr[aá]ulic[oa]s?)\b/iu.test(text)) {
      const controls = declaredConfiguration(source, prepared,
        ["Controles Hidraúlicos", "Controles hidráulicos", "Mandos hidráulicos"], hydraulicControls);
      if (controls !== null) details.push(`mandos hidráulicos declarados de tipo ${controls}`);
    }
    if (!/\b(?:ruedas?|neum[aá]ticos?|bandajes?|maciz[oa]s?|super[ -]?el[aá]stic[oa]s?|triciclos?)\b/iu.test(text)) {
      const wheels = declaredConfiguration(source, prepared, ["Ruedas", "Tipo de ruedas", "Tipo de neumáticos"], wheelType);
      if (wheels !== null) details.push(`ruedas ${wheels} declaradas`);
    }
  }
  return details;
};
