import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedGomarizPriorityGeneral } from "../evidence/verified-priority-general.js";
import { resolveGomarizIndividualizedGeneral } from "./individualized-general.js";
import { resolveGomarizShortDescription } from "./short-description.js";
import { resolveGomarizCriticalBriefGeneral } from "./critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "./general-description.js";
import { resolveGomarizUnitSpecificGeneral } from "./unit-specific-general.js";

export const resolveGomarizPreparedSourceGeneral = (record: ProductRecord) =>
  verifiedGomarizPriorityGeneral(record) ?? resolveGomarizIndividualizedGeneral(record) ?? resolveGomarizCriticalBriefGeneral(record) ?? resolveGomarizGeneralDescription(record) ?? resolveGomarizUnitSpecificGeneral(record);

export const resolveGomarizPreparedSourceShort = resolveGomarizShortDescription;
