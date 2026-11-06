import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

type Capability = Readonly<{
  key: "Frenado automático" | "Controles proporcionales" | "Dirección asistida" | "Detección de obstáculos" | "Control de estabilidad" | "Control de tracción TCS" | "Sistema antivuelco ACS" | "Parada de emergencia";
  declaration: RegExp;
  collision: RegExp;
}>;

const capabilities: readonly Capability[] = [
  {
    key: "Frenado automático",
    declaration: /\bfrenado\s+autom[aá]tico\b/giu,
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

export type GamSourceSafetyControl = Capability["key"];

export const hasGamAssertedSourceSafetyControl = (
  record: ProductRecord, key: GamSourceSafetyControl
): boolean => {
  const capability = capabilities.find((item) => item.key === key);
  return Boolean(capability && verifiedGamSourceVariant(record) &&
    isAsserted(record.longDescription ?? "", capability.declaration));
};

export const recoverGamSourceSafetyControls = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!verifiedGamSourceVariant(record)) return specs;
  const text = record.longDescription ?? "";
  let result = specs;
  for (const capability of capabilities) {
    if (Object.keys(result).some((key) => capability.collision.test(key)) ||
      Object.keys(record.specs ?? {}).some((key) => capability.collision.test(key)) ||
      !isAsserted(text, capability.declaration)) continue;
    result = { ...result, [capability.key]: true };
  }
  return result;
};
