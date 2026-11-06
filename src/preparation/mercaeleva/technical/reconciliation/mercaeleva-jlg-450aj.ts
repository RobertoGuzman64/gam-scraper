import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedMercaelevaPriorityShortDescription } from "../../editorial/evidence/priority-short-descriptions.js";

const verifiedUnits = {
  "M838-0666": {
    reference: "M838-0666",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-SIII-M838-0666",
    fingerprint: "bb35026da840ccda877cb88053ece4cd5c9ba2cd105a757e893b99125aed889b",
    article: "449",
    hours: "4212"
  },
  "M969-4655": {
    reference: "M969-4655",
    url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-450-AJ-SIII-M969-4655",
    fingerprint: "bc7ff24bcde8afd4ef4ac0df9d2c2cb25b28550b7040032eb41181f915a13271",
    article: "453",
    hours: "3912"
  }
} as const;

const digest = (record: ProductRecord): string => createHash("sha256")
  .update(JSON.stringify(Object.entries(record).filter(([key]) => key !== "scrapedAt")))
  .digest("hex");

export const reconcileMercaelevaVerifiedJlg450AjBaseModel = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "mercaeleva") return record;
  const evidence = Object.values(verifiedUnits).find((unit) => unit.reference === record.reference);
  if (!evidence || record.url !== evidence.url || digest(record) !== evidence.fingerprint ||
    record.brand !== "JLG" || record.model !== "450 AJ SIII" ||
    record.specs?.Modelo !== "450 AJ SIII" ||
    record.specs["Artículo No."] !== evidence.article ||
    record.longDescription !== `Ref. ${evidence.article} PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 16 MT JLG 450 AJ SII HORAS: ${evidence.hours} AÑO DE FABRICACION 2013`) return record;
  return {
    ...record,
    model: "450 AJ",
    shortDescription: verifiedMercaelevaPriorityShortDescription(record),
    title: "JLG 450 AJ PLATAFORMA ARTICULADA DIESEL 16 MT",
    longDescription: record.longDescription.replace("JLG 450 AJ SII", "JLG 450 AJ"),
    specs: { ...record.specs, Modelo: "450 AJ" }
  };
};
