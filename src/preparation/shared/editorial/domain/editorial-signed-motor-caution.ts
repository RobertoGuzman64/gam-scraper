import type { ProductRecord } from "../../../../contracts/catalog.js";

export const hasUncorroboratedSignedMotor = (general: string | null): boolean =>
  general !== null && /\bmotor\s+(?:el[eé]ctric[oa]|di[eé]sel|gasolina|glp)\b[^.]{0,120}\bno se traslada\b[^.]{0,120}\bno estar corroborad[oa]\b/iu.test(general);

export const withoutUncorroboratedMotorClaim = (record: ProductRecord, withheld: boolean): ProductRecord => {
  if (!withheld) return record;
  const specs = { ...record.specs };
  delete specs.Motor;
  delete specs["Tipo motor"];
  delete specs["Tipo de motor"];
  delete specs.Motorización;
  return { ...record, specs };
};
