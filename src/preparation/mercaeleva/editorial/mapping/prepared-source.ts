import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveMercaelevaShortDescription } from "./descriptions.js";
import { resolveMercaelevaConciseDescription } from "./concise-description.js";
import { resolveMercaelevaGeneralDescription } from "./general-description.js";
import { resolveMercaelevaDocumentedPlatformGeneral } from "./documented-platform-general.js";
import { resolveMercaelevaDocumentedAdditionalPlatformGeneral } from "./documented-additional-platform-general.js";
import { resolveMercaelevaDocumentedModelDimensionsGeneral } from "./documented-model-dimensions-general.js";
import { resolveMercaelevaDocumentedFurtherPlatformGeneral } from "./documented-further-platform-general.js";
import { resolveMercaelevaDocumentedModelOperatingGeneral } from "./documented-model-operating-general.js";
import { resolveMercaelevaPreviousGenerationPlatformGeneral } from "./documented-previous-generation-platform-general.js";
import { verifiedMercaelevaCriticalGeneral } from "../evidence/critical-general-descriptions.js";
import { verifiedPriorityPlatformGeneral } from "../evidence/priority-platform-generals.js";
import { verifiedMercaelevaUnitSpecificGeneral } from "../evidence/verified-unit-specific-generals.js";
import { verifiedMercaelevaUnitGeneral } from "./verified-unit-general.js";
import { mercaelevaMissingDescriptions } from "./missing-descriptions.js";

export const resolveMercaelevaPreparedSourceShort = (record: ProductRecord) => {
  const descriptionEvidence = resolveMercaelevaShortDescription(record);
  const conciseShort = resolveMercaelevaConciseDescription(record);
  const missingDescriptions = mercaelevaMissingDescriptions(record);
  return { descriptionEvidence, conciseShort, missingDescriptions };
};

export const resolveMercaelevaPreparedSourceGeneral = (record: ProductRecord) => {
  const existingGeneral = resolveMercaelevaDocumentedModelOperatingGeneral(record) ?? resolveMercaelevaDocumentedFurtherPlatformGeneral(record) ?? verifiedMercaelevaCriticalGeneral(record) ?? verifiedPriorityPlatformGeneral(record) ?? verifiedMercaelevaUnitSpecificGeneral(record) ?? verifiedMercaelevaUnitGeneral(record) ?? resolveMercaelevaDocumentedPlatformGeneral(record) ?? resolveMercaelevaDocumentedAdditionalPlatformGeneral(record) ?? resolveMercaelevaDocumentedModelDimensionsGeneral(record) ?? resolveMercaelevaGeneralDescription(record);
  return existingGeneral && existingGeneral.trim().split(/\s+/u).length >= 60
    ? existingGeneral
    : resolveMercaelevaPreviousGenerationPlatformGeneral(record) ?? existingGeneral;
};
