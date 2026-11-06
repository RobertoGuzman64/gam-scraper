import type { ImportCandidate } from "../../catalog/legacy-export/contracts.js";
import type { PublicationDifference } from "./publication-contracts.js";

export type SpecificationReconciliation = {
  readonly resolved: readonly string[];
  readonly unresolved: readonly string[];
};

const caseIdentity = (product: ImportCandidate): string =>
  product.reference?.trim() ? `ref:${product.reference.trim().toLowerCase()}` : `url:${product.sourceUrl}`;

const byIdentity = (products: readonly ImportCandidate[]): ReadonlyMap<string, ImportCandidate> =>
  new Map(products.map((product) => [caseIdentity(product), product]));

const verifiedCorrections: Readonly<Record<string, {
  readonly model: string;
  readonly previous: string;
  readonly replacement: Readonly<Record<string, string>>;
}>> = {
  "ref:6688:ALFA ROMEO": { model: "SPIDE JUNIOR", previous: "ALFA ROMEO", replacement: { "Marca": "ALFA ROMEO", "Modelo": "SPIDER JUNIOR" } },
  "ref:6689:AUDI": { model: "6 CABRIO 80 2", previous: "AUDI", replacement: { "Marca": "AUDI", "Modelo": "80 2,6 CABRIO" } },
  "ref:6690:PEUGEOUT": { model: "304 S CABRIOLET", previous: "PEUGEOUT", replacement: { "Marca": "PEUGEOT" } },
  "ref:2218:Ancho promedio": { model: "ERP13VC", previous: "24V / 735-875Ah(V/Ah)", replacement: { "Voltaje batería (V)": "24 V", "Capacidad de la batería (Ah)": "735-875 Ah" } },
  "ref:2109:Capacidad de la batería": { model: "S1.5UT", previous: "24V / 240h(V/Ah)", replacement: { "Voltaje batería (V)": "24 V" } },
  "ref:2108:Capacidad de la batería": { model: "S1.5UTS", previous: "24V / 240h(V/Ah)", replacement: { "Voltaje batería (V)": "24 V" } },
  "ref:920:Capacidad de la batería": { model: "MS15UX", previous: "24V / 240h(V/Ah)", replacement: { "Voltaje batería (V)": "24 V" } },
  "ref:2134:Capacidad de carga (kg)": { model: "LO5.0T", previous: "5000 KG", replacement: { "Capacidad de arrastre": "5000 KG" } },
  "ref:2135:Capacidad de carga (kg)": { model: "LO7.0T", previous: "7000 KG", replacement: { "Capacidad de arrastre": "7000 KG" } },
  "ref:1714:Altura Plataforma": { model: "MS20XD", previous: "4.8mm metros", replacement: { "Altura": "1346 mm" } },
  "ref:2737:Potencia Motor (KW)": { model: "6K 36V BR", previous: "36", replacement: { "Modelo": "6K 36V BR" } },
  "ref:2573:Potencia Motor (CV)": { model: "15k 48v BR", previous: "48", replacement: { "Modelo": "15k 48v BR" } }
};

export const reconcileRemovedSpecifications = (
  providerId: string,
  difference: PublicationDifference,
  previousProducts: readonly ImportCandidate[],
  nextProducts: readonly ImportCandidate[]
): SpecificationReconciliation => {
  const previous = byIdentity(previousProducts);
  const next = byIdentity(nextProducts);
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const key of difference.removedSpecifications) {
    const rule = providerId === "gam" ? verifiedCorrections[key] : undefined;
    const separator = key.indexOf(":", key.indexOf(":") + 1);
    const identity = separator < 0 ? "" : key.slice(0, separator);
    const removedKey = separator < 0 ? "" : key.slice(separator + 1);
    const old = previous.get(identity);
    const updated = next.get(identity);
    if (!rule || !old || !updated || old.sourceUrl !== updated.sourceUrl ||
      old.reference !== updated.reference || old.spec["Modelo"] !== rule.model ||
      updated.spec["Modelo"] !== (rule.replacement["Modelo"] ?? rule.model) ||
      old.spec[removedKey] !== rule.previous || Object.hasOwn(updated.spec, removedKey) ||
      !Object.entries(rule.replacement).every(([name, value]) => updated.spec[name] === value)) {
      unresolved.push(key);
    } else resolved.push(key);
  }
  return { resolved, unresolved };
};
