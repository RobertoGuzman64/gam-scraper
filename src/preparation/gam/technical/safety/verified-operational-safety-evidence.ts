import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

type SafetyKey = "Protección contra sobrecarga" | "Alarma de inclinación" | "Sensor de inclinación";

type Evidence = Readonly<{
  reference: string;
  brand: string;
  model: string;
  category: string;
  key: SafetyKey;
}>;

const evidence: readonly Evidence[] = [
  { reference: "4730", brand: "XCMG", model: "XG0608C", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4803", brand: "XCMG", model: "XG1523ERT-LI", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4805", brand: "XCMG", model: "XG1823ERT-LI", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4804", brand: "XCMG", model: "XG1823ERT", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4799", brand: "XCMG", model: "XG2225RT", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4785", brand: "XCMG", model: "XGS22K", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4787", brand: "XCMG", model: "XGS28E1", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4795", brand: "XCMG", model: "XGS28ACK", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4788", brand: "XCMG", model: "XGS32K", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4796", brand: "XCMG", model: "XGS32ACKⅡ", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4808", brand: "XCMG", model: "XGR08J", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4809", brand: "XCMG", model: "XGR10J", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4810", brand: "XCMG", model: "XGR12J", category: "elevacion-nueva", key: "Protección contra sobrecarga" },
  { reference: "4735", brand: "XCMG", model: "XG0807ACW", category: "elevacion-nueva", key: "Alarma de inclinación" },
  { reference: "4740", brand: "XCMG", model: "XG1012AC", category: "elevacion-nueva", key: "Alarma de inclinación" },
  { reference: "4742", brand: "XCMG", model: "XG1212AC", category: "elevacion-nueva", key: "Alarma de inclinación" },
  { reference: "4746", brand: "XCMG", model: "XG1614AC", category: "elevacion-nueva", key: "Alarma de inclinación" },
  { reference: "4807", brand: "XCMG", model: "XGR08", category: "elevacion-nueva", key: "Alarma de inclinación" },
  { reference: "2155", brand: "BRAVI", model: "LEONARDO HD", category: "elevacion-nueva", key: "Sensor de inclinación" },
  { reference: "2159", brand: "BRAVI", model: "Lui 460", category: "elevacion-nueva", key: "Sensor de inclinación" },
];

const byReference = new Map(evidence.map((entry) => [entry.reference, entry]));
const patterns: Readonly<Record<SafetyKey, RegExp>> = {
  "Protección contra sobrecarga": /\bprotecci[oó]n contra sobrecarga\b/iu,
  "Alarma de inclinación": /\balarma de inclinaci[oó]n\b/iu,
  "Sensor de inclinación": /\bsensor de inclinaci[oó]n\b/iu
};

export const recoverGamVerifiedOperationalSafety = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entry = byReference.get(record.reference ?? "");
  if (!entry || record.condition !== "Nuevo" || record.brand !== entry.brand || record.model !== entry.model ||
    record.categoryKey !== entry.category || !verifiedGamSourceVariant(record) ||
    Object.keys(source).some((key) => key.toLocaleLowerCase("es") === entry.key.toLocaleLowerCase("es")) ||
    !patterns[entry.key].test(record.longDescription ?? "")) return source;
  return { ...source, [entry.key]: true };
};
