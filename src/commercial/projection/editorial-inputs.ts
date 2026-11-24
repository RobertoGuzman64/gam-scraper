import type { CommercialBaselineInput } from "../diagnostics/commercial-baseline.js";
import { normalizePreparedEditorialPresentation } from "../../preparation/editorial/writing/prepared-editorial-presentation.js";

export const prepareCommercialEditorialInputs = (
  inputs: readonly CommercialBaselineInput[]
): readonly CommercialBaselineInput[] => inputs.map((input) => ({
  ...input, published: normalizePreparedEditorialPresentation(input.source, input.published)
}));
