import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { hasUnconditionalEditorialClaim } from "../../editorial/claims/editorial-claim-evidence.js";
import { containsEditorialBrandModel, containsEditorialIdentity } from "../../editorial/identity/editorial-identity-match.js";
import { verifiedGamSourceVariant } from "../identity/evidence/source-variant-identity.js";

type Capability = Readonly<{
  key: "Frenado automático" | "Controles proporcionales" | "Dirección asistida" | "Detección de obstáculos" | "Control de estabilidad" | "Control de tracción TCS" | "Sistema antivuelco ACS" | "Parada de emergencia" | "Reducción de velocidad en curvas";
  declaration: RegExp;
  collision: RegExp;
}>;

const capabilities: readonly Capability[] = [
  {
    key: "Frenado automático",
    declaration: /\b(?:frenado\s+autom[aá]tico|freno\s+autom[aá]tico|frenos\s+autom[aá]ticos)\b/giu,
    collision: /\bfren(?:o|ad)/iu
  },
  {
    key: "Controles proporcionales",
    declaration: /\bcontroles?\s+proporcionales?\b/giu,
    collision: /\b(?:controles?|mandos?)\s+proporcionales?\b/iu
  },
  {
    key: "Dirección asistida",
    declaration: /\bdirecci[oó]n\s+asistida\b/giu,
    collision: /\b(?:direcci[oó]n|servodirecci[oó]n)\b/iu
  },
  {
    key: "Detección de obstáculos",
    declaration: /\bdetecci[oó]n\s+de\s+obst[aá]culos\b/giu,
    collision: /\b(?:detecci[oó]n|sensores?)\s+de\s+obst[aá]culos\b/iu
  },
  {
    key: "Control de estabilidad",
    declaration: /\bcontrol\s+de\s+estabilidad\b/giu,
    collision: /\bcontrol\s+de\s+estabilidad\b/iu
  },
  {
    key: "Control de tracción TCS",
    declaration: /\bsistema\s+de\s+control\s+de\s+tracci[oó]n\s+TCS\b/giu,
    collision: /\b(?:control\s+de\s+tracci[oó]n\s+TCS|tracci[oó]n\s+TCS)\b/iu
  },
  {
    key: "Sistema antivuelco ACS",
    declaration: /\bsistema\s+antivuelco\s+ACS\b/giu,
    collision: /\b(?:sistema\s+antivuelco|antivuelco\s+ACS)\b/iu
  },
  {
    key: "Reducción de velocidad en curvas",
    declaration: /\b(?:reducci[oó]n\s+(?:autom[aá]tica\s+)?de\s+(?:la\s+)?velocidad\s+en\s+(?:las\s+)?curvas|velocidad\s+reducida\s+en\s+(?:las\s+)?curvas)\b/giu,
    collision: /(?:velocidad.*curvas?|curvas?.*velocidad)/iu
  },
  {
    key: "Parada de emergencia",
    declaration: /\b(?:parada|paro)\s+de\s+emergencia\b/giu,
    collision: /\b(?:parada|paro)\s+de\s+emergencia\b/iu
  }
];

const conditionalPrefix = /\b(?:sin|opcional(?:es)?|opci[oó]n|alternativ[oa]s?|podr[ií]a|puede\s+(?:incorporar|incluir|equipar)|no\s+(?:tiene|incluye|dispone\s+de|cuenta\s+con))\b/iu;
const conditionalSuffix = /^\s*(?:\([^)]*\)\s*)?(?:opcional(?:es)?|como\s+opci[oó]n|no\s+(?:incluid[oa]s?|disponible(?:s)?))\b/iu;

const isAsserted = (description: string, declaration: RegExp): boolean => {
  const matches = [...description.matchAll(declaration)];
  if (matches.length === 0) return false;
  return matches.every((match) => {
    const start = match.index ?? 0;
    const before = description.slice(Math.max(0, start - 80), start).split(/[.!?;\n]/u).at(-1) ?? "";
    const after = description.slice(start + match[0].length, start + match[0].length + 50);
    return !conditionalPrefix.test(before) && !conditionalSuffix.test(after);
  });
};

const automaticBrakingIsAsserted = (record: ProductRecord, declaration: RegExp): boolean => {
  const description = record.longDescription ?? "";
  const { brand, model } = record;
  if (!brand || !model || ![record.title, record.shortDescription, description].every((text) =>
    containsEditorialBrandModel(text ?? "", brand, model))) return false;
  const context = `${record.title ?? ""}. ${record.shortDescription ?? ""}. ${description}`;
  const brandPattern = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "giu");
  return ![...context.matchAll(namedModel)].some((match) =>
    !!match[1] && !containsEditorialIdentity(model, match[1])) && hasUnconditionalEditorialClaim(context, declaration) &&
    [...context.matchAll(declaration)].every((match) => {
      const start = match.index ?? 0;
      const clause = context.slice(Math.max(0, start - 150), start).split(/[.!?;\n]/u).at(-1) ?? "";
      return !/\b(?:comparaci[oó]n|comparad[oa]|a diferencia de|otros? modelos?|otras? m[aá]quinas?)\b/iu.test(clause);
    }) &&
    !/\b(?:sin|carece de|no (?:tiene|incluye|incorpora|dispone de|funciona con|lleva|monta|equipa)|opci[oó]n de)\s+(?:(?:el|los|un|unos|sistema de)\s+)?fren(?:o|os|ado)\s+autom[aá]tic[oa]s?\b|\bfren(?:o|os|ado)\s+autom[aá]tic[oa]s?\s+(?:no (?:instalad[oa]s?|disponible(?:s)?)|opcional(?:es)?|desactivad[oa]s?)\b/iu.test(context);
};

const curveSpeedIsAsserted = (record: ProductRecord, declaration: RegExp): boolean => {
  const { brand, model } = record;
  if (record.condition !== "Nuevo" || !["carretillas-nuevas", "apiladores-nuevos", "marcas-nuevas"].includes(record.categoryKey) ||
    !brand || !model || ![record.title, record.shortDescription, record.longDescription].every((text) =>
      containsEditorialBrandModel(text ?? "", brand, model))) return false;
  const context = `${record.title ?? ""}. ${record.shortDescription ?? ""}. ${record.longDescription ?? ""}`;
  const brandPattern = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "giu");
  return ![...context.matchAll(namedModel)].some((match) =>
    !!match[1] && !containsEditorialIdentity(model, match[1])) &&
    hasUnconditionalEditorialClaim(context, declaration) &&
    [...context.matchAll(declaration)].every((match) => {
      const start = match.index ?? 0;
      const before = context.slice(Math.max(0, start - 150), start).split(/[.!?;\n]/u).at(-1) ?? "";
      const after = context.slice(start + match[0].length, start + match[0].length + 150).split(/[.!?;\n]/u)[0] ?? "";
      return !/\b(?:sin|carece de|no|opcional(?:es)?|desactivad[oa]|comparaci[oó]n|comparad[oa]|a diferencia de|otros? modelos?|otras? m[aá]quinas?|seg[uú]n configuraci[oó]n)\b/iu.test(`${before} ${after}`);
    });
};

const assertedCapability = (record: ProductRecord, capability: Capability): boolean => {
  const text = record.longDescription ?? "";
  if (capability.key === "Reducción de velocidad en curvas") return isAsserted(text, capability.declaration) && curveSpeedIsAsserted(record, capability.declaration);
  if (capability.key !== "Frenado automático") return isAsserted(text, capability.declaration);
  if (isAsserted(text, /\bfrenado\s+autom[aá]tico\b/giu)) return true;
  return isAsserted(text, capability.declaration) && automaticBrakingIsAsserted(record, capability.declaration);
};

export type GamSourceSafetyControl = Capability["key"];

export const hasGamAssertedSourceSafetyControl = (
  record: ProductRecord, key: GamSourceSafetyControl
): boolean => {
  const capability = capabilities.find((item) => item.key === key);
  return Boolean(capability && verifiedGamSourceVariant(record) &&
    assertedCapability(record, capability));
};

export const recoverGamSourceSafetyControls = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!verifiedGamSourceVariant(record)) return specs;
  let result = specs;
  for (const capability of capabilities) {
    if (Object.keys(result).some((key) => capability.collision.test(key)) ||
      Object.keys(record.specs ?? {}).some((key) => capability.collision.test(key)) ||
      !assertedCapability(record, capability)) continue;
    result = { ...result, [capability.key]: true };
  }
  return result;
};
