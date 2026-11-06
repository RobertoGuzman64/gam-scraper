import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../../identity/evidence/source-variant-identity.js";

type VerifiedKey = "Controles proporcionales" | "Sistema de presencia del operador";

type Evidence = Readonly<{
  reference: string;
  brand: string;
  model: string;
  category: string;
  key: VerifiedKey;
}>;

const evidence: readonly Evidence[] = [
  { reference: "4738", brand: "XCMG", model: "XG1008AC", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4742", brand: "XCMG", model: "XG1212AC", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4800", brand: "XCMG", model: "XG1218ERT", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4746", brand: "XCMG", model: "XG1614AC", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "6963", brand: "XCMG", model: "XG0807AEW", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4762", brand: "XCMG", model: "XGA12ACK", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4772", brand: "XCMG", model: "XGA20ACK", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4777", brand: "XCMG", model: "XGA22ACK-LI", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4776", brand: "XCMG", model: "XGA22ACK1", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "5900", brand: "XCMG", model: "XGA36K", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4791", brand: "XCMG", model: "XGS50E", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "6767", brand: "CTE", model: "B-LIFT 20 AUTO", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "6768", brand: "CTE", model: "B-LIFT 20 AUTO FIB", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "4807", brand: "XCMG", model: "XGR08", category: "elevacion-nueva", key: "Controles proporcionales" },
  { reference: "5903", brand: "BRAVI", model: "Residential 170", category: "marcas-nuevas", key: "Controles proporcionales" },
  { reference: "4626", brand: "HYSTER", model: "J2.0UTTL", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "5998", brand: "HYSTER", model: "J4.0XTLG", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "5999", brand: "HYSTER", model: "J4.5XTLG", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "6000", brand: "HYSTER", model: "J5.0XTLG", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "6001", brand: "HYSTER", model: "J5.0XTLGS6", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "5988", brand: "YALE", model: "ERP2.0MXLG", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "5993", brand: "YALE", model: "ERP4.5MXLG", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "5995", brand: "YALE", model: "ERP5.0MXLG6", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "5996", brand: "YALE", model: "ERP6.0MXLG6", category: "carretillas-nuevas", key: "Sistema de presencia del operador" },
  { reference: "5997", brand: "YALE", model: "ERP7.0MXLG6", category: "carretillas-nuevas", key: "Sistema de presencia del operador" }
];

const byReference = new Map(evidence.map((entry) => [entry.reference, entry]));
const proportionalControls = /\b(?:control(?:es)? proporcional(?:es)?)\b/iu;
const operatorPresence = /\bsistema de presencia del operador\b/iu;

export const recoverGamVerifiedOperatorControls = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entry = byReference.get(record.reference ?? "");
  if (!entry || record.condition !== "Nuevo" || record.brand !== entry.brand ||
    record.model !== entry.model || record.categoryKey !== entry.category ||
    !verifiedGamSourceVariant(record) ||
    Object.keys(source).some((key) => key.toLocaleLowerCase("es") === entry.key.toLocaleLowerCase("es"))) return source;
  const pattern = entry.key === "Controles proporcionales" ? proportionalControls : operatorPresence;
  if (!pattern.test(record.longDescription ?? "")) return source;
  return { ...source, [entry.key]: true };
};
