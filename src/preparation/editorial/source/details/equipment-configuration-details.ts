import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFamily } from "../../core/editorial-families.js";
import { editorialQuantity, formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { resolvedEditorialUnitFamilies } from "../../identity/editorial-unit-provenance.js";
import { equalSpec, declaredBoolean, declaredConfiguration } from "./equipment-detail-values.js";
import { dumperGeometryAndTraction } from "./equipment-table-details.js";

export const resolveEquipmentConfigurationDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily
): readonly string[] => {
  if (!["grupo-electrogeno", "excavadora", "miniexcavadora", "dumper"].includes(family)) return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const text = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  if (family === "dumper") {
    const capacityAliases = ["Capacidad de carga (kg)", "Capacidad de carga", "Capacidad"];
    const hasAny = (keys: readonly string[]): boolean => keys.some((key) =>
      source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    if (!hasAny(capacityAliases) && !/\b(?:capacidad|carga|tolva)\b[^.!?;\n]{0,40}\d+\s*(?:kg|t)\b/iu.test(text)) {
      const capacity = editorialQuantity(equalSpec(source, prepared, "Capacidad carga") ?? undefined, "kg");
      if (capacity !== null && capacity >= 100 && capacity <= 50000) {
        details.push(`capacidad de carga declarada de ${formatEditorialQuantity(capacity)} kg`);
      }
    }
    details.push(...dumperGeometryAndTraction(source, prepared).filter((detail) =>
      !(/^altura total\b/u.test(detail) && /\b(?:altura|alto)\b/iu.test(text)) &&
      !(/^tracción declarada\b/u.test(detail) && /\b(?:tracci[oó]n|4\s*[x×]\s*[24]|[24]wd)\b/iu.test(text))));
    const configurations = [
      { key: "Giratorio", label: "tolva giratoria declarada", mention: /\b(?:giratori[oa]s?|giro\s+de\s+(?:la\s+)?tolva|tolva\s+(?:es\s+)?fija)\b/iu },
      { key: "Autocargable", label: "configuración autocargable declarada", mention: /\b(?:autocarg\p{L}*|auto[ -]carg\p{L}*|carga\s+autom[aá]tica|carga\s+manual)\b/iu },
      { key: "Descarga altura", label: "descarga en altura declarada", mention: /\b(?:descarga\s+(?:en\s+)?altura|descarga\s+elevada|altura\s+de\s+descarga|descarga\s+a\s+nivel\s+del\s+suelo)\b/iu }
    ] as const;
    for (const configuration of configurations) {
      if (declaredBoolean(source.specs?.[configuration.key]) === true &&
        declaredBoolean(prepared.specs?.[configuration.key]) === true && !configuration.mention.test(text)) {
        details.push(configuration.label);
      }
    }
  } else if (family === "grupo-electrogeno") {
    if (!/\b(?:stage|emisiones|homologaci[oó]n|normativa)\b/iu.test(text)) {
      const classification = declaredConfiguration(source, prepared,
        ["Stage", "Normativa de emisiones", "Nivel de emisiones"], (value) => {
          const match = /^(?:stage\s+)?(i|ii|iiia|iiib|iv|v)(\s+flex)?$/u.exec(value);
          if (!match?.[1] || match[2] && match[1] !== "v") return null;
          return `${match[1].toUpperCase()}${match[2] ? " Flex" : ""}`;
        });
      if (classification !== null) details.push(`clasificación de emisiones declarada Stage ${classification}`);
    }
    const competingVoltageKeys = ["Voltaje", "Voltaje de la batería"];
    if (!/\b(?:voltios?|voltaje|tensi[oó]n|bater[ií]as?)\b|\b\d+\s*v\b/iu.test(text) &&
      competingVoltageKeys.every((key) => source.specs?.[key] === undefined && prepared.specs?.[key] === undefined)) {
      const raw = equalSpec(source, prepared, "Voltios");
      const voltage = editorialQuantity(raw ?? undefined, "V");
      const paired = raw && /^(\d{3})\s*\/\s*(\d{3})\s*V$/iu.exec(raw);
      if (voltage !== null && Number.isInteger(voltage) && voltage >= 100 && voltage <= 690) {
        details.push(`tensión eléctrica declarada de ${voltage} V`);
      } else if (paired?.[1] && paired[2]) {
        const first = Number(paired[1]);
        const second = Number(paired[2]);
        if (first >= 100 && first <= 690 && second >= 100 && second <= 690 && first !== second) {
          details.push(`tensiones eléctricas declaradas de ${first}/${second} V`);
        }
      }
    }
    if (!/\bpolos?\b/iu.test(text)) {
      const poles = equalSpec(source, prepared, "Polos");
      if (poles !== null && /^(?:2|4|6|8|10|12)$/u.test(poles)) {
        details.push(`${poles} polos declarados`);
      }
    }
    if (!/\bdep[oó]sitos?\b/iu.test(text)) {
      const keys = ["Capacidad depósito", "Capacidad del depósito", "Capacidad de depósito"];
      const values = keys.flatMap((key) => {
        if (source.specs?.[key] === undefined && prepared.specs?.[key] === undefined) return [];
        const raw = equalSpec(source, prepared, key);
        const match = raw && /^(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:l|litros?)$/iu.exec(raw);
        return [match?.[1] ? Number(match[1].replace(",", ".")) : null];
      });
      const capacity = values[0];
      if (capacity !== undefined && capacity !== null && capacity >= 1 && capacity <= 10000 &&
        values.every((value) => value === capacity)) {
        details.push(`capacidad de depósito declarada de ${formatEditorialQuantity(capacity)} l`);
      }
    }
  } else if (!/\b(?:cazos?|cucharas?|cucharones?|implementos?)\b/iu.test(text)) {
    const keys = ["Cazo 1 limpieza", "Cazo 2", "Cazo 3"];
    const present = keys.filter((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    const values = present.map((key) => {
      const raw = equalSpec(source, prepared, key);
      const value = editorialQuantity(raw ?? undefined, "mm");
      return value !== null && value >= 100 && value <= 3000 ? value : null;
    });
    if (present.length > 0 && values.every((value): value is number => value !== null)) {
      const sizes = [...new Set(values)].sort((left, right) => left - right);
      const formatted = sizes.map(formatEditorialQuantity);
      const listed = formatted.length === 1 ? formatted[0] :
        `${formatted.slice(0, -1).join(", ")} y ${formatted[formatted.length - 1]}`;
      details.push(`medidas de cazos declaradas de ${listed} mm`);
    }
  }
  return details;
};
