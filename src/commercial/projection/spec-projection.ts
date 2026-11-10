import { isDeepStrictEqual } from "node:util";
import type { ProductRecord, SpecsMap, SpecValue } from "../../contracts/catalog.js";
import { inspectTechnicalCoherence, inspectTechnicalSpecifications } from "../../catalog/validation/technical-specifications.js";
import { verifiedMercaelevaMbCapacity } from "../../catalog/interventions/verified-mercaeleva-capacity.js";
import { gamCrossedBatteryValue, gamMislabelledOrderPickerLift, gamMislabelledStacker, gamPalletBatteryForCrossedSpecs, recoverGamCrossedTechnicalSpecs } from "../../preparation/gam/technical/crossed-specifications.js";

const repeatedUnit = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|kg)\s+\2\s*$/iu;

const samePublishedValues = (spec: SpecsMap, source: ProductRecord, keys: readonly string[]): boolean =>
  keys.every((key) => spec[key] === source.specs?.[key]);

export const projectPresentableSpecifications = (spec: SpecsMap, source?: ProductRecord): SpecsMap => {
  const issues = inspectTechnicalCoherence(spec);
  const invalid = new Set([
    ...inspectTechnicalSpecifications(spec).map(({ key }) => key),
    ...issues.filter(({ code }) => code !== "unidad-tecnica-duplicada").map(({ key }) => key)
  ]);
  const repeated = new Set(issues.filter(({ code }) => code === "unidad-tecnica-duplicada").map(({ key }) => key));
  const presentable: Record<string, SpecValue> = {};
  for (const [key, value] of Object.entries(spec)) {
    if (invalid.has(key)) continue;
    if (!repeated.has(key)) {
      presentable[key] = value;
      continue;
    }
    const match = typeof value === "string" ? repeatedUnit.exec(value) : null;
    if (match?.[1] && match[2]) presentable[key] = `${match[1]} ${match[2]}`;
  }
  if (source?.providerId === "mercaeleva") {
    const nominalCapacity = verifiedMercaelevaMbCapacity(source);
    const capacityKey = "Capacidad máxima de elevación";
    if (nominalCapacity !== null &&
      presentable.Marca === source.specs?.Marca && presentable.Modelo === source.specs?.Modelo &&
      presentable[capacityKey] === source.specs?.[capacityKey]) {
      presentable[capacityKey] = `${nominalCapacity} kg`;
    }
  }
  if (source?.providerId !== "gam") return presentable;
  const stacker = gamMislabelledStacker(source);
  if (stacker && samePublishedValues(spec, source, ["Marca", "Modelo", "Capacidad de carga (kg)",
      "Centro de carga", "Capacidad de la batería", "Radio de giro"]) &&
    ["Altura de elevación (mm)", "Peso", "Batería (V / Ah)"].every((key) => spec[key] === undefined)) {
    presentable["Altura de elevación (mm)"] = `${stacker.height} mm`;
    presentable["Peso"] = `${stacker.weight} kg`;
    presentable["Batería (V / Ah)"] = stacker.battery;
  }
  const lift = gamMislabelledOrderPickerLift(source);
  if (lift !== null && spec["Altura de elevación (mm)"] === undefined &&
    samePublishedValues(spec, source, ["Marca", "Modelo", "Altura", "Longitud", "Capacidad de carga (kg)", "Centro de carga"])) {
    presentable["Altura de elevación (mm)"] = `${lift} mm`;
  }
  const palletBattery = gamPalletBatteryForCrossedSpecs(source);
  if (palletBattery && spec["Batería (V / Ah)"] === undefined &&
    samePublishedValues(spec, source,
      ["Marca", "Modelo", "Altura Plataforma", "Capacidad de la batería", "Peso", "Capacidad de carga (kg)"])) {
    presentable["Batería (V / Ah)"] = gamCrossedBatteryValue(palletBattery) ?? palletBattery;
    if (recoverGamCrossedTechnicalSpecs(source)["Capacidad de la batería"] === undefined) {
      delete presentable["Capacidad de la batería"];
    }
  }
  return presentable;
};

export const isAccreditedMercaelevaMbCapacityProjection = (
  source: ProductRecord, published: SpecsMap, projected: SpecsMap
): boolean => {
  const capacity = verifiedMercaelevaMbCapacity(source);
  const key = "Capacidad máxima de elevación";
  if (capacity === null || published[key] !== source.specs?.[key] ||
    published.Marca !== source.specs?.Marca || published.Modelo !== source.specs?.Modelo) return false;
  const normalized = projectPresentableSpecifications(published);
  return normalized[key] === published[key] &&
    isDeepStrictEqual(projected, { ...normalized, [key]: `${capacity} kg` });
};
