import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { AliasOutcome, Attribute, Candidate } from "../../attribute-types.js";
import { fold } from "../../attribute-utils.js";
import { mercaelevaHandlingEvidence, mercaelevaMislabelledCapacity } from "./handling-evidence.js";
import { mercaelevaTechnicalCandidate } from "./technical.js";
import { verifiedMercaelevaMbCapacity } from "./verified-mb-capacity.js";

export const applyMercaelevaAliasesDetailed = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): AliasOutcome => {
  const title = String(record.specs?.["Título adicional"] ?? record.title ?? "");
  const family = fold(title);
  const isForklift = /\bcarretilla\b/.test(family);
  const isStacker = /\bapilador\b/.test(family);
  const isPalletTruck = /\btranspalet(?:a)?\b/.test(family);
  const isTelehandler = /\bmanipulador telescopico\b/.test(family);
  const conflictingAliases = attribute.name === "Capacidad de carga"
    ? ["Capacidad máxima de elevación", "Capacidad nominal"]
    : attribute.name === "Altura de elevación" ? ["Altura máxima de elevación"] : [];
  if (Object.entries(record.specs ?? {}).some(([key, value]) =>
    Array.isArray(value) && value.length > 1 &&
    (keys.has(fold(key)) || conflictingAliases.some((alias) => fold(alias) === fold(key))))) return "contradiction";
  const maxLoad = record.specs?.["Capacidad máxima de elevación"];
  const hasExplicitLoad = typeof maxLoad === "string" && /\bkg\s*$/i.test(maxLoad.trim());
  if (attribute.name === "Capacidad máxima" && isTelehandler && hasExplicitLoad) {
    keys.add(fold("Capacidad máxima de elevación"));
  }
  if (attribute.name === "Altura de elevación" && (isForklift || isStacker)) {
    keys.add(fold("Altura máxima de elevación"));
  }
  if (attribute.name === "Capacidad de carga" && (isForklift || isStacker || isPalletTruck)) {
    if (hasExplicitLoad && !mercaelevaMislabelledCapacity(record) && verifiedMercaelevaMbCapacity(record) === null) {
      keys.add(fold("Capacidad máxima de elevación"));
    }
    if (typeof record.specs?.["Capacidad nominal"] === "string" && /\bkg\s*$/i.test(record.specs["Capacidad nominal"])) {
      keys.add(fold("Capacidad nominal"));
    }
    const load = title.match(/\b(\d{3,5}|\d{1,2}[.,]\d{3})\s*kg\b/i)?.[1];
    if (load) candidates.push({ key: "Capacidad de carga (kg)", value: `${load} kg` });
  }
  if (attribute.name === "Peso operativo" && /\b(?:dumper|(?:mini)?excavadora)\b/.test(family)) {
    keys.add(fold("Peso en servicio"));
  }
  if (attribute.name === "Longitud de horquillas") keys.add(fold("Longitud de tenedor"));
  const technical = mercaelevaTechnicalCandidate(record, attribute);
  if (technical !== null) candidates.push(technical);
  const evidence = mercaelevaHandlingEvidence(record, attribute);
  if (!evidence.safe) return evidence.reason;
  if (evidence.candidate !== null) candidates.push(evidence.candidate);
  return "accepted";
};

export const applyMercaelevaAliases = (record: ProductRecord, attribute: Attribute, keys: Set<string>, candidates: Candidate[]): boolean =>
  applyMercaelevaAliasesDetailed(record, attribute, keys, candidates) === "accepted";
