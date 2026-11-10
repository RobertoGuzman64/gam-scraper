import type { ProductRecord } from "../../contracts/catalog.js";
import { buildProductIdentity } from "../identity.js";
import type { ManualInterventionProposal } from "./contracts.js";
import { readProposedField } from "./values.js";
import { fold } from "../../preparation/shared/classification/mapping/attribute-utils.js";
import { validMercaelevaTechnicalSource } from "../../preparation/mercaeleva/technical/mapping/technical.js";

export const mercaelevaMbManufacturerCapacityEvidence = {
  EFL303: { capacityKg: 3000, url: "https://ep-equipment.com/es/product/efl303/" },
  EPL185: { capacityKg: 1800, url: "https://ep-equipment.com/es/product/epl185/" }
} as const;

const interventions = [
  {
    providerId: "mercaeleva",
    identity: "mercaeleva:ref:m062-8951",
    field: "spec:Capacidad máxima de elevación",
    expected: "2500 kg",
    next: "3000 kg",
    reason: "La unidad se anuncia como MB EFL303 de 3.000 kg; el fabricante confirma 3.000 kg nominales y el campo técnico heredado contiene 2.500 kg.",
    evidence: mercaelevaMbManufacturerCapacityEvidence.EFL303.url
  },
  {
    providerId: "mercaeleva",
    identity: "mercaeleva:ref:m119-9334",
    field: "spec:Capacidad máxima de elevación",
    expected: "1500 kg",
    next: "1800 kg",
    reason: "La unidad se anuncia como MB EPL185 de 1.800 kg; el fabricante confirma 1.800 kg nominales y el campo técnico heredado contiene 1.500 kg.",
    evidence: mercaelevaMbManufacturerCapacityEvidence.EPL185.url
  }
] satisfies readonly ManualInterventionProposal[];

export const verifiedMercaelevaMbCapacityProposal = (record: ProductRecord): ManualInterventionProposal | null => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    record.condition !== "Nuevo" || record.year !== "2025" ||
    fold(record.brand ?? "") !== "mb" || fold(String(record.specs?.Marca ?? "")) !== "mb" ||
    !record.model || fold(String(record.specs?.Modelo ?? "")) !== fold(record.model) ||
    record.specs?.Estado !== "Nuevo" || record.shortDescription?.trim() ||
    record.longDescription?.trim() || record.specs?.["Tipo de Batería"] !== "Li-ion") return null;

  const id = buildProductIdentity(record).key;
  const proposal = interventions.find((item) => item.identity === id);
  if (!proposal || readProposedField(record, proposal.field) !== proposal.expected) return null;

  if (record.reference === "M062-8951" && record.model === "EFL303" &&
    record.url === "https://sales.mercaeleva.com/es/for-sale/machine/MB-EFL303-M062-8951" &&
    record.title === "MB EFL303 Carretilla eléctrica de 3.000 kg con batería de Litio" &&
    record.specs?.["Título adicional"] === "Carretilla eléctrica de 3.000 kg con batería de Litio" &&
    record.specs?.["Voltaje de la batería"] === "80 V" &&
    record.specs?.["Capacidad de la batería"] === "205 Ah") return proposal;

  if (record.reference === "M119-9334" && record.model === "EPL185" &&
    record.url === "https://sales.mercaeleva.com/es/for-sale/machine/MB-EPL185-M119-9334" &&
    record.title === "MB EPL185 Transpaleta Eléctrica con batería de Litio de 1.800kg" &&
    record.specs?.["Título adicional"] === "Transpaleta Eléctrica con batería de Litio de 1.800kg" &&
    record.specs?.["Voltaje de la batería"] === "48 V" &&
    record.specs?.["Capacidad de la batería"] === "30 Ah") return proposal;

  return null;
};

export const verifiedMercaelevaMbCapacity = (record: ProductRecord): number | null => {
  const proposal = verifiedMercaelevaMbCapacityProposal(record);
  if (!proposal || typeof proposal.next !== "string") return null;
  const match = /^(\d+) kg$/u.exec(proposal.next);
  return match?.[1] ? Number(match[1]) : null;
};
