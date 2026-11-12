import type { ProductRecord } from "../../../../contracts/catalog.js";
import { inspectTechnicalCoherence } from "../../../../catalog/validation/technical-specifications.js";
import { mercaelevaCorroboratedCapacity } from "../evidence/handling-evidence.js";
import { reconcileMercaelevaVerifiedUnicarriersCapacity } from "../evidence/unicarriers-used-capacity-evidence.js";
import { reconcileMercaelevaVerifiedLindeE16pMast } from "../evidence/linde-e16p-duplex-evidence.js";
import { describeMercaelevaE48pPublicationConflict } from "../evidence/linde-e48p-publication-evidence.js";
import { verifiedMercaelevaMbCapacityProposal } from "../../../../catalog/interventions/verified-mercaeleva-capacity.js";
import { writeProposedField } from "../../../../catalog/interventions/values.js";

export const publicationConflictForMercaeleva = (record: ProductRecord): string | null => describeMercaelevaE48pPublicationConflict(record);

export const reconcileMercaelevaNonUsableSentinels = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "mercaeleva" || !record.specs) return record;
  const issues = inspectTechnicalCoherence(record.specs).filter((issue) =>
    issue.code === "valor-centinela-no-utilizable" && typeof record.specs?.[issue.key] === "string");
  if (issues.length === 0) return record;
  const specs = { ...record.specs };
  for (const issue of issues) delete specs[issue.key];
  return { ...record, specs };
};

export const reconcileMercaelevaVerifiedMbCapacity = (record: ProductRecord): ProductRecord => {
  const proposal = verifiedMercaelevaMbCapacityProposal(record);
  return proposal === null ? record : writeProposedField(record, proposal);
};

export const reconcileMercaelevaForPreparation = (record: ProductRecord): ProductRecord => {
  record = reconcileMercaelevaVerifiedUnicarriersCapacity(record);
  record = reconcileMercaelevaVerifiedLindeE16pMast(record);
  return record;
};

export const reconcileMercaelevaCorroboratedCapacity = (record: ProductRecord): ProductRecord => {
  const capacity = mercaelevaCorroboratedCapacity(record);
  return capacity === null ? record : { ...record, specs: { ...record.specs, "Capacidad máxima de elevación": `${capacity} kg` } };
};

export const reconcileMercaelevaVerifiedReachTruckFamily = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "mercaeleva" || record.reference !== "M547-2372" ||
    record.url !== "https://sales.mercaeleva.com/es/for-sale/machine/Toyota-6FBRE14-M547-2372" ||
    record.brand !== "Toyota" || record.model !== "6FBRE14" ||
    record.title !== "Toyota 6FBRE14 CARRETILLA ELEVADORA RETRACTIL 1350 KG" ||
    record.specs?.Marca !== "Toyota" || record.specs.Modelo !== "6FBRE14" ||
    record.specs["Artículo No."] !== "MER1123" || record.specs["Título adicional"] !== "CARRETILLA ELEVADORA RETRACTIL 1350 KG" ||
    record.longDescription !== "Ref. MER1123 TRANSPALET ELECTRICO 1350 KG ALTURA DE TRABAJO 6.500 mm TOYOTA 6FBRE14 HOURAS 14696 AÑO DE FABRICACCION 2000") return record;
  return { ...record, longDescription: "Ref. MER1123 CARRETILLA RETRACTIL ELECTRICA 1350 KG ALTURA DE ELEVACION 6.500 mm TOYOTA 6FBRE14 HORAS 14696 AÑO DE FABRICACION 2000" };
};
