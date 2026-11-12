import type { ProductRecord } from "../../../../contracts/catalog.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { platformMeasurements } from "./platform-measurements.js";

const render = (value: number): string => {
  const [whole, fraction] = value.toFixed(2).split(".");
  const integer = (whole ?? "").replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
  const decimals = (fraction ?? "").replace(/0+$/u, "");
  return decimals ? `${integer},${decimals}` : integer;
};

export const resolveReusableEditorial = (record: ProductRecord) => {
  const facts = resolveEditorialFacts(record);
  if (!facts) return { short: null, general: null };
  const identity = `${facts.brand} ${facts.model}`;
  const platformName = facts.family === "plataforma-tijera" ? "plataforma de tijera" :
    facts.family === "plataforma-articulada" ? "plataforma articulada" :
      facts.family === "plataforma-telescopica" ? "plataforma telescópica" : null;
  if (platformName !== null && facts.workingHeightM !== null) {
    const measures = platformMeasurements(render(facts.workingHeightM),
      facts.lateralReachM === null ? null : render(facts.lateralReachM),
      facts.loadCapacityKg === null ? null : render(facts.loadCapacityKg));
    const energy = facts.energy === "eléctrica" ? " eléctrica" : facts.energy === "diésel" ? " diésel" : "";
    return {
      short: `${platformName.charAt(0).toLocaleUpperCase("es")}${platformName.slice(1)}${energy} ${identity}, con ${measures}.`,
      general: `La ficha técnica de la ${platformName} ${identity} indica una ${measures}.`
    };
  }
  if (facts.family === "carretilla-elevadora" && facts.loadCapacityKg !== null) {
    const height = facts.liftingHeightM === null ? "" : ` y altura de elevación de ${render(facts.liftingHeightM)} m`;
    const energy = facts.energy === "eléctrica" ? " eléctrica" : facts.energy === "diésel" ? " diésel" : "";
    return {
      short: `Carretilla elevadora${energy} ${identity}, con capacidad de carga de ${render(facts.loadCapacityKg)} kg${height}.`,
      general: `La ficha técnica de la carretilla elevadora ${identity} declara una capacidad de carga de ${render(facts.loadCapacityKg)} kg${height}.`
    };
  }
  return { short: null, general: null };
};
