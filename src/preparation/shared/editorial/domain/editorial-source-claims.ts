import type { ProductRecord, SpecValue } from "../../../../contracts/catalog.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";
import { resolveAssertedBatteryVoltage } from "./editorial-battery-claims.js";

type EditorialSourceClaim = Readonly<{
  key: string;
  declaration: RegExp;
  mention: RegExp;
  statement: string;
}>;

const claims: readonly EditorialSourceClaim[] = [
  {
    key: "Frenado regenerativo",
    declaration: /\b(?:frenado|frenos?)\s+regenerativ[oa]s?\b/giu,
    mention: /\b(?:frenado|frenos?)\s+regenerativ[oa]s?\b/iu,
    statement: "La descripción de origen declara frenado regenerativo."
  },
  {
    key: "Frenado automático",
    declaration: /\bfrenado\s+autom[aá]tico\b/giu,
    mention: /\bfren(?:ado|os?)\s+autom[aá]tic[oa]s?\b/iu,
    statement: "La descripción de origen declara frenado automático."
  },
  {
    key: "Controles proporcionales",
    declaration: /\b(?:controles?|mandos?)\s+proporcionales?\b/giu,
    mention: /\b(?:controles?|mandos?)\s+proporcionales?\b/iu,
    statement: "La descripción de origen declara mandos proporcionales."
  },
  {
    key: "Dirección asistida",
    declaration: /\b(?:direcci[oó]n\s+asistida|servodirecci[oó]n)\b/giu,
    mention: /\b(?:direcci[oó]n\s+asistida|servodirecci[oó]n)\b/iu,
    statement: "La descripción de origen declara dirección asistida."
  },
  {
    key: "Detección de obstáculos",
    declaration: /\b(?:detecci[oó]n|sensores?)\s+de\s+obst[aá]culos\b/giu,
    mention: /\b(?:detecci[oó]n|sensores?)\s+de\s+obst[aá]culos\b/iu,
    statement: "La descripción de origen declara detección de obstáculos."
  },
  {
    key: "Control de estabilidad",
    declaration: /\bcontrol\s+de\s+estabilidad\b/giu,
    mention: /\bcontrol\s+de\s+estabilidad\b/iu,
    statement: "La descripción de origen declara control de estabilidad."
  },
  {
    key: "Control de tracción TCS",
    declaration: /\b(?:sistema\s+de\s+)?control\s+de\s+tracci[oó]n\s+TCS\b/giu,
    mention: /\b(?:control\s+de\s+tracci[oó]n\s+TCS|tracci[oó]n\s+TCS)\b/iu,
    statement: "La descripción de origen declara control de tracción TCS."
  },
  {
    key: "Sistema antivuelco ACS",
    declaration: /\bsistema\s+antivuelco\s+ACS\b/giu,
    mention: /\b(?:sistema\s+antivuelco|antivuelco\s+ACS)\b/iu,
    statement: "La descripción de origen declara sistema antivuelco ACS."
  },
  {
    key: "Parada de emergencia",
    declaration: /\b(?:parada|paro)\s+de\s+emergencia\b/giu,
    mention: /\b(?:parada|paro)\s+de\s+emergencia\b/iu,
    statement: "La descripción de origen declara parada de emergencia."
  }
];

const uncertainBefore = /\b(?:sin|no|carece\s+de|opci[oó]n|opcional(?:es)?|alternativ[oa]s?|podr[ií]a|puede(?:n)?|posibilidad\s+de|versi[oó]n(?:es)?|seg[uú]n\s+(?:la\s+)?versi[oó]n)\b/iu;
const uncertainAfter = /^\s*(?:\([^)]*\)\s*)?(?:(?:son|es|se\s+ofrecen|se\s+ofrece)\s+)?(?:opcional(?:es)?|como\s+opci[oó]n|no\s+incluid[oa]s?|seg[uú]n\s+(?:la\s+)?versi[oó]n|disponible\s+como\s+opci[oó]n)\b/iu;
const uncertainty = /\b(?:puede\s+(?:incorporar|equipar|incluir|disponer)|no\s+(?:incorpora|dispone|incluye|tiene|cuenta))\b/iu;

const affirmative = (text: string, pattern: RegExp): boolean => {
  const matches = [...text.matchAll(pattern)];
  return matches.length > 0 && matches.every((match) => {
    const start = match.index ?? 0;
    const prefix = text.slice(Math.max(0, start - 110), start).split(/[.!?;\n]/u).at(-1) ?? "";
    const suffix = text.slice(start + match[0].length, start + match[0].length + 70);
    return !uncertainBefore.test(prefix) && !uncertainty.test(prefix) && !uncertainAfter.test(suffix);
  });
};

const assertedSpec = (value: SpecValue | undefined): boolean => value === true;

export const resolveSourceEditorialClaims = (
  source: ProductRecord,
  prepared: ProductRecord,
  general: string | null
): string | null => {
  if (!general?.trim() || !verifiedEditorialIdentity(source) || !resolveEditorialSource(source) ||
    !resolveEditorialSource(prepared) || source.reference !== prepared.reference ||
    source.url !== prepared.url || source.brand !== prepared.brand || source.model !== prepared.model) return general;
  const description = source.longDescription ?? "";
  const additions = claims.filter((claim) => {
    if (claim.mention.test(general)) return false;
    const original = source.specs?.[claim.key];
    const reconciled = prepared.specs?.[claim.key];
    if (original !== undefined && !assertedSpec(original) || reconciled !== undefined && !assertedSpec(reconciled)) return false;
    return affirmative(description, claim.declaration);
  }).map((claim) => claim.statement);
  const battery = resolveAssertedBatteryVoltage(source, prepared, general);
  if (battery !== null) additions.push(battery);
  if (additions.length === 0) return general;
  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} ${additions.join(" ")}`;
};
