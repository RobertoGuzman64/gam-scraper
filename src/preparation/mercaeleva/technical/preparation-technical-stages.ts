import { reconcileMercaelevaVerifiedA14jeHeight } from "../evidence/verified-a14je-height.js";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";
import { reconcileMercaelevaVerifiedLindeE48p } from "../evidence/linde-e48p-publication-evidence.js";
import { reconcileMercaelevaVerifiedJlg450AjBaseModel } from "./mercaeleva-jlg-450aj.js";
import { reconcileMercaelevaVerifiedPlatformSourceSpecs } from "../evidence/verified-platform-source-specs.js";
import { reconcileMercaelevaForPreparation, reconcileMercaelevaVerifiedReachTruckFamily, reconcileMercaelevaVerifiedMbCapacity, reconcileMercaelevaCorroboratedCapacity, reconcileMercaelevaNonUsableSentinels } from "./mercaeleva.js";

export const reconcileMercaelevaInitialTechnicalEvidence = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaVerifiedJlg450AjBaseModel(reconcileMercaelevaVerifiedLindeE48p(record));

export const reconcileMercaelevaSourceFamily = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaVerifiedReachTruckFamily(reconcileMercaelevaVerifiedA14jeHeight(record));

export const reconcileMercaelevaSourceTechnicalSpecs = (
  record: ProductRecord, observe?: TechnicalRecoveryObservation
): ProductRecord => {
  const recovered = reconcileMercaelevaVerifiedPlatformSourceSpecs(record);
  observe?.(record.specs ?? {}, recovered.specs ?? {},
    "src/preparation/mercaeleva/technical/evidence/verified-platform-source-specs.ts", "longDescription");
  return recovered;
};

export const reconcileMercaelevaTechnicalBeforeEditorial = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaForPreparation(record);

export const reconcileMercaelevaTechnicalCapacity = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaVerifiedMbCapacity(record);

export const reconcileMercaelevaTechnicalCorroboratedCapacity = (record: ProductRecord): ProductRecord =>
  reconcileMercaelevaCorroboratedCapacity(record);

export const sanitizeMercaelevaTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap =>
  reconcileMercaelevaNonUsableSentinels({ ...record, specs }).specs ?? specs;
