import type { ProductRecord } from "../../../contracts/catalog.js";
import { mercaelevaCorroboratedCapacity } from "../evidence/providers/mercaeleva/handling-evidence.js";
import { resolveMercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";
import { reconcileMercaelevaVerifiedUnicarriersCapacity } from "../evidence/providers/mercaeleva/unicarriers-used-capacity-evidence.js";
import { reconcileMercaelevaVerifiedLindeE16pMast } from "../evidence/providers/mercaeleva/linde-e16p-duplex-evidence.js";
import { describeMercaelevaE48pPublicationConflict } from "../evidence/providers/mercaeleva/linde-e48p-publication-evidence.js";

export const publicationConflictForMercaeleva = (record: ProductRecord): string | null => describeMercaelevaE48pPublicationConflict(record);

export const reconcileMercaelevaForPreparation = (record: ProductRecord): ProductRecord => {
  record = reconcileMercaelevaVerifiedUnicarriersCapacity(record);
  record = reconcileMercaelevaVerifiedLindeE16pMast(record);
  return record;
};

export const reconcileMercaelevaCorroboratedCapacity = (record: ProductRecord): ProductRecord => {
  const capacity = mercaelevaCorroboratedCapacity(record);
  return capacity === null ? record : { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": `${capacity} kg` } };
};
