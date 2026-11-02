import type { ProductRecord, SpecsMap } from "../../../../../../contracts/catalog.js";
import { verifiedGamElectricalIdentity } from "../identity/electrical-identity-evidence.js";

export const recoverGamMislabelledBatterySpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  if (record.reference !== "2219" || record.categoryKey !== "carretillas-nuevas" ||
    record.brand !== "YALE" || record.model !== "ERP15VC" ||
    !verifiedGamElectricalIdentity(record) ||
    source["Ancho promedio"] !== "24V / 840-1000Ah(V/Ah)" ||
    !/\bbater[ií]a de 24\s*V\b/iu.test(record.longDescription ?? "") ||
    Object.keys(source).some((key) => /capacidad\s+(?:de\s+la\s+)?bater[ií]a/iu.test(key))) return source;
  const { "Ancho promedio": _wrongLabel, ...remaining } = source;
  return { ...remaining, "Voltaje batería (V)": "24 V", "Capacidad de la batería (Ah)": "840-1000 Ah" };
};
