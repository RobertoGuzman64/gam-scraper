import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveVerifiedUnitContextEditorial } from "./verified-unit-context-editorial.js";
import { resolveVerifiedFamilyProportionEditorial } from "./verified-family-proportion-editorial.js";
import { resolveVerifiedEditorialClosure } from "./verified-editorial-closure.js";

interface VerifiedEditorialDescriptions {
  readonly short: string | null;
  readonly general: string | null;
}

export const applyVerifiedEditorialComposition = (
  record: ProductRecord,
  preparedShort: string | null,
  preparedGeneral: string | null,
  eligible: boolean
): VerifiedEditorialDescriptions => {
  if (!eligible) return { short: preparedShort, general: preparedGeneral };
  const context = resolveVerifiedUnitContextEditorial(record, preparedShort, preparedGeneral);
  const contextualGeneral = context?.general ?? preparedGeneral;
  const proportionalGeneral = resolveVerifiedFamilyProportionEditorial(record, contextualGeneral) ?? contextualGeneral;
  const finalGeneral = resolveVerifiedEditorialClosure(record, proportionalGeneral) ?? proportionalGeneral;
  return { short: context?.short ?? preparedShort, general: finalGeneral };
};
