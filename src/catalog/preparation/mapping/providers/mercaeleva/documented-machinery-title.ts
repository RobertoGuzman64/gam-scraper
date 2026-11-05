import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";

const compact = (value: string): string => fold(value).replace(/[^\p{L}\p{N}]+/gu, "");
const numericSpec = (record: ProductRecord, key: string, unit: "kg" | "m"): number | null => {
  const value = String(record.specs?.[key] ?? "");
  const match = new RegExp(`^(\\d[\\d., ]*)\\s*${unit}$`, "iu").exec(value);
  return match?.[1] ? numberToken(match[1]) : null;
};

export const resolveDocumentedMachineryTitle = (record: ProductRecord, title: string, brand: string, model: string): string | null => {
  if (record.condition !== "Segunda mano" || fold(String(record.specs?.Estado ?? "")) !== "usado") return null;
  const prefix = `${brand} ${model}`;
  if (!title.startsWith(`${prefix} `)) return null;
  const additional = title.slice(prefix.length).trim();
  if (fold(String(record.specs?.["Título adicional"] ?? "")) !== fold(additional)) return null;
  const description = fold(record.longDescription ?? "");
  if (!compact(description).includes(compact(prefix))) return null;

  const allTerrain = /^CARRETILLA 4x4 (\d{3,5})KG$/iu.exec(additional);
  if (allTerrain?.[1]) {
    const capacity = numberToken(allTerrain[1]);
    if (capacity !== null && numericSpec(record, "Capacidad máxima de elevación", "kg") === capacity &&
      description.includes(`carretilla 4x4 ${capacity}kg`)) {
      return `Carretilla todoterreno 4x4 ${brand} ${model} de ${capacity} kg`;
    }
  }

  const dumper = /^DUMPER GIRATORIO (\d{3,5}) KG$/iu.exec(additional);
  if (dumper?.[1]) {
    const capacity = numberToken(dumper[1]);
    if (capacity !== null && description.includes(`dumper giratorio capacidad de carga ${capacity} kg`)) {
      return `Dúmper giratorio ${brand} ${model} de ${capacity} kg`;
    }
  }

  const handler = /^MANIPULADOR TELESCOPICO (\d+(?:[.,]\d+)?) MT$/iu.exec(additional);
  if (handler?.[1]) {
    const height = numberToken(handler[1]);
    if (height !== null && fold(String(record.specs?.["Tipo de motor"] ?? "")) === "diesel" &&
      numericSpec(record, "Altura máxima de elevación", "m") === height &&
      description.includes(`manipulador telescopico altura de trabajo ${handler[1]} mt`)) {
      return `Manipulador telescópico ${brand} ${model} de ${handler[1].replace(".", ",")} m`;
    }
  }

  const vertical = /^PLATAFORMA VERTICAL AUTOPROPULSADA (\d+(?:[.,]\d+)?) MT$/iu.exec(additional);
  if (vertical?.[1]) {
    const height = numberToken(vertical[1]);
    if (height !== null && fold(String(record.specs?.["Tipo de motor"] ?? "")) === "electrico" &&
      numericSpec(record, "Altura de trabajo", "m") === height &&
      description.includes(`plataforma vertical autopropulsada altura de trabajo ${vertical[1]} mt`)) {
      return `Plataforma vertical autopropulsada eléctrica ${brand} ${model} de ${vertical[1].replace(".", ",")} m`;
    }
  }

  if (fold(additional) === "plataforma de tijera electrica" &&
    fold(String(record.specs?.["Tipo de motor"] ?? "")) === "electrico" &&
    numericSpec(record, "Altura de trabajo", "m") === 8 &&
    /plataforma tijera electrica altura de trabajo 8 mt/u.test(description)) {
    return `Plataforma de tijera eléctrica ${brand} ${model} de 8 m`;
  }

  const diesel = /^CARRETILLA ELEVADORA DIESEL (\d{3,5}) KG$/iu.exec(additional);
  if (diesel?.[1]) {
    const capacity = numberToken(diesel[1]);
    if (capacity !== null && numericSpec(record, "Capacidad máxima de elevación", "kg") === capacity &&
      description.includes(`carretilla elevadora diesel ${capacity} kg`)) {
      return `Carretilla elevadora diésel ${brand} ${model} de ${capacity} kg`;
    }
  }
  return null;
};
