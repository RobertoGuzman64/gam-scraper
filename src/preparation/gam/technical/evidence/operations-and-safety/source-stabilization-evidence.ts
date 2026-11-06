import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../../identity/evidence/source-variant-identity.js";

type StabilizationKey = "Nivelación automática" | "Estabilizadores hidráulicos";

const declarations: readonly Readonly<{ key: StabilizationKey; claim: RegExp }>[] = [
  { key: "Nivelación automática", claim: /\bnivelaci[oó]n\s+(?:hidr[aá]ulica\s+)?autom[aá]tica\b/giu },
  { key: "Estabilizadores hidráulicos", claim: /\bestabilizadores\s+hidr[aá]ulicos\b/giu }
];

const uncertainBefore = /\b(?:sin|carece\s+de|opci[oó]n(?:es)?(?:\s+de)?|opcional(?:es)?|alternativ[oa]s?|puede\s+(?:incluir|incorporar|equipar)|podr[ií]a\s+(?:incluir|incorporar|equipar)|no\s+(?:tiene|incluye|incorpora|dispone\s+de|cuenta\s+con))\b/iu;
const uncertainAfter = /^\s*(?:\([^)]*\)\s*)?(?:opcional(?:es)?|como\s+opci[oó]n|no\s+incluid[oa]s?|no\s+disponible(?:s)?)\b/iu;

const asserted = (description: string, claim: RegExp): boolean => {
  const matches = [...description.matchAll(claim)];
  return matches.length > 0 && matches.every((match) => {
    const index = match.index ?? 0;
    const before = description.slice(Math.max(0, index - 100), index).split(/[.!?;\n]/u).at(-1) ?? "";
    const after = description.slice(index + match[0].length, index + match[0].length + 48);
    return !uncertainBefore.test(before) && !uncertainAfter.test(after);
  });
};

export const recoverGamSourceStabilization = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!verifiedGamSourceVariant(record) ||
    !["elevacion", "elevacion-nueva"].includes(record.categoryKey)) return specs;
  const description = record.longDescription ?? "";
  let result = specs;
  for (const declaration of declarations) {
    if (Object.keys(result).some((key) => key.trim().toLocaleLowerCase("es") === declaration.key.toLocaleLowerCase("es")) ||
      Object.keys(record.specs ?? {}).some((key) => key.trim().toLocaleLowerCase("es") === declaration.key.toLocaleLowerCase("es")) ||
      !asserted(description, declaration.claim)) continue;
    result = { ...result, [declaration.key]: true };
  }
  return result;
};
