import type { ProductRecord } from "../../../../contracts/catalog.js";
import { containsEditorialBrandModel } from "../../identity/editorial-identity-match.js";
import { resolveEditorialSource } from "../../core/editorial-source.js";
import { verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";

type SourceEnergy = "electrica" | "diesel" | "glp" | "gasolina";

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

const energy = (value: string): SourceEnergy | null => {
  const normalized = fold(value).trim();
  return normalized === "electrico" || normalized === "electrica" ? "electrica" :
    normalized === "diesel" ? "diesel" :
      normalized === "glp" || normalized === "lpg" ? "glp" :
        normalized === "gasolina" ? "gasolina" : null;
};

const sourceEnergy = (record: ProductRecord): SourceEnergy | null => {
  const values = [record.specs?.Motor, record.specs?.["Tipo motor"],
    record.specs?.["Tipo de motor"], record.specs?.Motorización].filter((value): value is string => typeof value === "string");
  if (values.length === 0) return null;
  const energies = values.map(energy);
  if (energies.some((value) => value === null)) return null;
  const unique = new Set(energies);
  return unique.size === 1 ? energies[0] ?? null : null;
};

const assertedEnergy = (value: string | null): SourceEnergy | null => {
  const energies = [...fold(value ?? "").matchAll(/\b(?:electrico|electrica|diesel|glp|lpg|gasolina)\b/gu)]
    .map(([token]) => energy(token));
  const unique = new Set(energies);
  return unique.size === 1 ? energies[0] ?? null : null;
};

const introductoryUnitEnergy = (description: string, brand: string, model: string): SourceEnergy | null => {
  const introduction = fold(description).slice(0, 180);
  const position = introduction.indexOf(fold(`${brand} ${model}`));
  if (position < 0 || position > 100) return null;
  const preceding = introduction.slice(0, position).trim();
  if (/\b(?:no|sin|excepto|versi[oó]n(?:es)?|alternativas?|opcional(?:es|mente)?)\b/u.test(preceding)) return null;
  const matched = /\b(electrico|electrica|diesel|glp|lpg|gasolina)$/u.exec(preceding);
  return matched?.[1] ? energy(matched[1]) : null;
};

export const withoutContradictoryFamilyGeneral = (record: ProductRecord): ProductRecord => {
  const description = record.longDescription?.trim();
  if (!description || !verifiedEditorialIdentity(record) || !record.brand || !record.model) return record;
  const technical = sourceEnergy(record);
  if (!technical || !resolveEditorialSource(record)) return record;
  if (containsEditorialBrandModel(description, record.brand, record.model)) {
    const declared = introductoryUnitEnergy(description, record.brand, record.model);
    if (!declared || declared === technical || assertedEnergy(record.title) !== technical ||
      assertedEnergy(record.shortDescription) !== technical ||
      /\b(?:versi[oó]n(?:es)?|alternativas?|opcional(?:es|mente)?|compatible\s+con|puede\s+(?:equipar|montar|funcionar))\b/iu.test(description)) return record;
    return { ...record, longDescription: null };
  }
  const heading = /^(?:las?|los?)\s+(?:articuladas?|tijeras?|telescopicas?)\s+(electricas?|diesel)\b/u
    .exec(fold(description));
  const declared = heading?.[1]?.startsWith("electric") ? "electrica" : heading?.[1] === "diesel" ? "diesel" : null;
  if (!declared || declared === technical) return record;
  return { ...record, longDescription: null };
};
