import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { numberToken, scalar } from "../../attribute-utils.js";
import { gamHandlingModelEvidence } from "./handling.js";
import { cleaningFamily, foldText } from "../../../evidence/providers/gam/cleaning-evidence.js";

const widthMillimetres = (raw: string, unit: string): number | null => {
  const parsed = numberToken(raw);
  if (parsed === null || parsed <= 0) return null;
  const mm = parsed * (unit === "mm" ? 1 : unit === "cm" ? 10 : 1000);
  return Number.isFinite(mm) ? Math.round(mm * 1000) / 1000 : null;
};

const workWidthExpressions = (description: string): readonly { value: number; optional: boolean }[] | null => {
  const text = foldText(description);
  const expression = /\b(?:(?:ancho|anchura) de (?:trabajo|barrido|fregado|restregado|limpieza)|(?:franja|trayectoria) de limpieza(?: total)?)\b[^\d.!?]{0,55}?(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g;
  const values: { value: number; optional: boolean }[] = [];
  for (const match of text.matchAll(expression)) {
    if (!match[1] || !match[2]) return null;
    const value = widthMillimetres(match[1], match[2]);
    if (value === null) return null;
    const tail = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 85).split(/[.!?]\s+[a-z]/, 1)[0] ?? "";
    const alternative = /\b(?:o|y|hasta)\s+\d[\d.,]*\s*(?:mm|cm|metros?|m)\b(?![a-z0-9²³])|(?:\/|-)\s*\d[\d.,]*\s*(?:mm|cm|metros?|m)\b(?![a-z0-9²³])/.exec(tail);
    if (alternative) {
      const after = tail.slice((alternative.index ?? 0) + alternative[0].length);
      if (!alternative[0].startsWith("hasta") || !/\bcon (?:el |un |la )?(?:cepillo|escobilla) lateral\b/.test(after)) return null;
    }
    const optional = /\b(?:hasta|maximo|puede llegar)\b/.test(match[0]) ||
      (!alternative && /\b(?:cuando se utiliza|cuando se usa|con)\b[^.!?]{0,40}\b(?:cepillo|escobilla) lateral\b/.test(tail));
    values.push({ value, optional });
  }
  return values;
};

const configuredWidthMatchesOptions = (record: ProductRecord, expected: number, description: string): boolean => {
  const suffix = record.model?.trim().match(/(?:^|\s)(\d{2})$/)?.[1];
  if (!suffix || Number(suffix) * 10 !== expected) return false;
  const model = foldText(record.model ?? "").trim();
  if ([record.title, record.shortDescription, record.longDescription].some((part) =>
    !part || !foldText(part).includes(model))) return false;
  const text = foldText(description);
  const expression = /\b(?:(?:ancho|anchura) de (?:trabajo|barrido|fregado|restregado|limpieza)|(?:franja|trayectoria) de limpieza(?: total)?)\b[^\d.!?]{0,55}?(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g;
  const matches = [...text.matchAll(expression)];
  if (matches.length === 0) return false;
  return matches.every((match) => {
    const first = match[1] && match[2] ? widthMillimetres(match[1], match[2]) : null;
    const tail = text.slice((match.index ?? 0) + match[0].length);
    const alternative = /^\s*(?:o|y|\/)\s*(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/.exec(tail);
    const second = alternative?.[1] && alternative[2] ? widthMillimetres(alternative[1], alternative[2]) : null;
    return first !== null && second !== null && first !== second && (first === expected || second === expected);
  });
};

const configuredWorkWidth = (record: ProductRecord): number | null => {
  if (cleaningFamily(record) !== "fregadora") return null;
  const model = foldText(record.model ?? "").trim();
  const suffix = /(?:^|\s)d(\d{2})$/.exec(model)?.[1];
  if (!suffix) return null;
  const chosen = Number(suffix) * 10;
  const title = foldText(record.title ?? "");
  const description = foldText(record.longDescription ?? "");
  const modelPattern = new RegExp(`(?:^|[^a-z0-9])${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`);
  if (!modelPattern.test(title) || !modelPattern.test(description)) return null;

  const widthKeys = Object.keys(record.specs ?? {}).filter((key) =>
    /^(?:anchura trabajo|ancho de trabajo)(?: \(mm\))?$/.test(foldText(key))
  );
  if (widthKeys.length !== 1 || foldText(widthKeys[0] ?? "") !== "anchura trabajo") return null;
  const rawSource = record.specs?.["Anchura trabajo"];
  if (rawSource === undefined) return null;
  const rawWidth = scalar(rawSource);
  if (typeof rawWidth !== "string") return null;
  const specMatch = rawWidth.trim().match(/^(\d[\d.,]*)\s*(mm|cm|metros?|m)$/i);
  if (!specMatch?.[1] || !specMatch[2]) return null;
  const published = widthMillimetres(specMatch[1], foldText(specMatch[2]));
  if (published === null) return null;

  const alternatives = [...description.matchAll(/\btrayectoria de limpieza que varia entre\s+(\d[\d.,]*)\s*(mm|cm|metros?|m)\s+y\s+(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g)];
  if (alternatives.length !== 1) return null;
  const first = alternatives[0]?.[1] && alternatives[0]?.[2]
    ? widthMillimetres(alternatives[0][1], alternatives[0][2]) : null;
  const second = alternatives[0]?.[3] && alternatives[0]?.[4]
    ? widthMillimetres(alternatives[0][3], alternatives[0][4]) : null;
  if (first === null || second === null || first === second || ![first, second].includes(chosen)) return null;
  const declaredWorkWidths = /\b(?:ancho|anchura) de (?:trabajo|barrido|fregado|limpieza)\s+(?:de\s+)?(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g;
  for (const source of [record.shortDescription ?? "", record.longDescription ?? ""]) {
    if (!modelPattern.test(foldText(source))) continue;
    for (const match of foldText(source).matchAll(declaredWorkWidths)) {
      const value = match[1] && match[2] ? widthMillimetres(match[1], match[2]) : null;
      if (value === null || ![first, second].includes(value)) return null;
    }
  }

  const squeegees = [...description.matchAll(/\bbayeta de (?:hasta )?(\d[\d.,]*)\s*(mm|cm|metros?|m) de ancho\b/g)];
  if (squeegees.length !== 1 || !squeegees[0]?.[1] || !squeegees[0][2]) return null;
  const squeegee = widthMillimetres(squeegees[0][1], squeegees[0][2]);
  if (squeegee === null) return null;
  const numericPrecision = specMatch[1].split(/[.,]/).at(-1)?.length ?? 0;
  const decimals = /[.,]/.test(specMatch[1]) ? numericPrecision : 0;
  const unitMillimetres = specMatch[2].toLowerCase() === "mm" ? 1 : specMatch[2].toLowerCase() === "cm" ? 10 : 1000;
  const roundingTolerance = unitMillimetres / 10 ** decimals / 2;
  if (Math.abs(squeegee - published) >= roundingTolerance || Math.abs(chosen - published) <= roundingTolerance) return null;
  return chosen;
};

const corroboratedCleaningWidth = (record: ProductRecord): number | null => {
  if (!cleaningFamily(record) || !record.model ||
    ![record.title, record.shortDescription, record.longDescription].every((text) =>
      text && gamHandlingModelEvidence(record, text))) return null;
  const raw = record.specs?.["Anchura trabajo"];
  const value = raw === undefined ? null : scalar(raw);
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d[\d.,]*)\s*(mm|cm|metros?|m)$/i);
  if (!match?.[1] || !match[2]) return null;
  const published = widthMillimetres(match[1], foldText(match[2]));
  if (published === null) return null;
  const long = foldText(record.longDescription ?? "");
  const variant = foldText(record.model).match(/(?:^|\s)(\d{2})$/)?.[1];
  if (cleaningFamily(record) === "fregadora" && variant) {
    const variants = [...long.matchAll(/\btrayectoria de limpieza de\s+(\d[\d.,]*)\s*(mm|cm|metros?|m)\s+o\s+(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g)];
    if (variants.length === 1) {
      const entry = variants[0];
      const first = entry?.[1] && entry[2] ? widthMillimetres(entry[1], foldText(entry[2])) : null;
      const second = entry?.[3] && entry[4] ? widthMillimetres(entry[3], foldText(entry[4])) : null;
      const selected = Number(variant) * 10;
      const independent = [...long.matchAll(/\bcabezales? de\s+(\d[\d.,]*)\s*(mm|cm|metros?|m)\s+o\s+(\d[\d.,]*)\s*(mm|cm|metros?|m)\b/g)];
      const mention = independent[0];
      const verifiedFirst = mention?.[1] && mention[2] ? widthMillimetres(mention[1], foldText(mention[2])) : null;
      const verifiedSecond = mention?.[3] && mention[4] ? widthMillimetres(mention[3], foldText(mention[4])) : null;
      if (first !== null && second !== null && first !== second && independent.length === 1 &&
        verifiedFirst === first && verifiedSecond === second &&
        [first, second].includes(published) && [first, second].includes(selected)) return selected;
    }
  }
  const described = workWidthExpressions(record.longDescription ?? "");
  const measured = described?.[0];
  if (described?.length !== 1 || !measured || measured.optional) return null;
  const exact = measured.value;
  const decimals = match[1].match(/[.,](\d+)$/)?.[1]?.length ?? 0;
  const resolution = (match[2].toLowerCase() === "mm" ? 1 : match[2].toLowerCase() === "cm" ? 10 : 1000) / 10 ** decimals;
  const difference = Math.abs(exact - published);
  if (difference > 0 && difference <= resolution / 2 + 0.001) return exact;
  const sameShort = workWidthExpressions(record.shortDescription ?? "");
  if (sameShort?.length === 1 && !sameShort[0]?.optional && sameShort[0]?.value === exact && difference <= 15) return exact;
  return null;
};

const verifiedTennantT600eD80Width = (record: ProductRecord): number | null => {
  if (record.providerId !== "gam" || record.reference !== "4004" ||
    record.categoryKey !== "limpieza-fregadoras" || record.condition !== "Nuevo" ||
    record.url !== "https://online.gamrentals.com/es/fregadoras-industriales-nuevas/4004-fca-t600e-d80" ||
    record.title !== "Fregadora TENNANT FCA T600e D80" ||
    record.shortDescription !== "➨ TENNANT FCA T600e D80 Nueva ➨ Venta de fregadora industrial" ||
    record.brand !== "Tennant" || record.model !== "FCA T600e D80" ||
    record.specs?.["Marca"] !== "Tennant" ||
    record.specs?.["Modelo"] !== "FCA T600e D80" ||
    record.specs?.["Anchura trabajo"] !== "1,1 metros" ||
    record.specs?.["RPM cepillo"] !== "300") return null;
  const description = record.longDescription;
  if (!description || !description.startsWith("La fregadora TENNANT FCA T600e D80 está diseñada") ||
    !description.includes("La TENNANT FCA T600e D80 está diseñada") ||
    !description.includes("La fregadora TENNANT FCA T600e D80 ofrece") ||
    !description.includes("Con un ancho de fregado de hasta 900 mm") ||
    !description.includes("4415 m² por hora") ||
    [...description.matchAll(/\b(?:ancho|anchura) de (?:trabajo|fregado|barrido|limpieza)\b/gi)].length !== 1 ||
    [...description.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:mm|cm|metros?)\b/gi)].some((match) => match[0] !== "900 mm")) return null;
  return 800;
};

export const gamCleaningCorrectedWidth = (record: ProductRecord): number | null =>
  configuredWorkWidth(record) ?? corroboratedCleaningWidth(record) ?? verifiedTennantT600eD80Width(record);


export const gamCleaningWidthConflicts = (record: ProductRecord): boolean => {
  if (!cleaningFamily(record) || gamCleaningCorrectedWidth(record) !== null) return false;
  const source = record.specs?.["Anchura trabajo"];
  if (source === undefined) return false;
  const raw = scalar(source);
  if (raw === null || typeof raw === "boolean") return true;
  const match = String(raw).trim().match(/^(\d[\d.,]*)\s*(mm|cm|metros?|m)$/i);
  const expected = match?.[1] && match[2] ? widthMillimetres(match[1], foldText(match[2])) : null;
  if (expected === null) return true;
  const description = `${record.shortDescription ?? ""}. ${record.longDescription ?? ""}`;
  const found = workWidthExpressions(description);
  if (found === null) return !configuredWidthMatchesOptions(record, expected, description);
  return found.some((entry) => entry.value !== expected && (!entry.optional || entry.value < expected));
};

export const workWidth = (description: string): number | null => {
  const text = foldText(description);
  if (/\bmientras que (?:el|los) (?:cabezal|cepillos?) [^.!?]{0,85}\b(?:cubre|abarca|tiene un ancho de)\s+\d[\d.,]*\s*(?:mm|cm|m)\b/.test(text)) return null;
  const found = workWidthExpressions(description);
  if (found === null) return null;
  const values = new Set(found.filter((entry) => !entry.optional).map((entry) => entry.value));
  if (found.some((entry) => entry.optional && values.size > 0 && !values.has(entry.value))) return null;
  return values.size === 1 ? [...values][0] ?? null : null;
};

