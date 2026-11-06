import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { fold } from "../../../shared/classification/mapping/attribute-utils.js";

type Editorial = { readonly short: string | null; readonly general: string | null };
type PreparedTowTractor = Editorial & { readonly spec: SpecsMap };

const supportedModels: Readonly<Record<string, { readonly model: string; readonly capacity: string }>> = {
  "2134": { model: "LO5.0T", capacity: "5000" },
  "2135": { model: "LO7.0T", capacity: "7000" }
};

const supportedSource = (source: ProductRecord): boolean => {
  const identity = supportedModels[source.reference ?? ""];
  if (!identity || source.providerId !== "gam" || source.categoryKey !== "marcas-nuevas" ||
    source.condition !== "Nuevo" || fold(source.brand ?? "") !== "hyster" ||
    fold(String(source.specs?.["Marca"] ?? "")) !== "hyster" ||
    fold(source.model ?? "") !== fold(identity.model) ||
    fold(String(source.specs?.["Modelo"] ?? "")) !== fold(identity.model) ||
    fold(source.title ?? "") !== fold(`Tractor de arrastre ${identity.capacity}Kg Hyster ${identity.model}`) ||
    fold(String(source.specs?.["Capacidad de carga (kg)"] ?? "")) !== `${identity.capacity} kg` ||
    !/^24v\s*\//i.test(String(source.specs?.["Capacidad de la batería"] ?? "")) ||
    source.shortDescription?.includes(`Capacidad de carga ${identity.capacity}kg`) !== true ||
    !/motor diésel de alta potencia/i.test(source.longDescription ?? "")) return false;
  try {
    const url = new URL(source.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && path[0] === "es" &&
      path[1] === "tractores-arrastre-hyster" && path.length === 3 &&
      path[2] === `${source.reference}-tractor-de-arrastre-hyster-${fold(identity.model).replace(/[^a-z0-9]/g, "")}`;
  } catch {
    return false;
  }
};

export const reconcileGamElectricTowTractorEditorial = (
  source: ProductRecord, editorial: Editorial, spec: SpecsMap
): PreparedTowTractor => {
  const supported = supportedModels[source.reference ?? ""];
  const general = editorial.general;
  if (!supported || !supportedSource(source) || !general ||
    !editorial.short?.includes(`Capacidad de carga ${supported.capacity}kg`) ||
    !/motor diésel de alta potencia/i.test(general) ||
    spec["Capacidad de carga (kg)"] !== source.specs?.["Capacidad de carga (kg)"]) {
    return { ...editorial, spec };
  }
  const { ["Capacidad de carga (kg)"]: towingCapacity, ...remainingSpecs } = spec;
  if (towingCapacity === undefined || "Capacidad de arrastre" in spec) return { ...editorial, spec };
  return {
    short: editorial.short.replace("Capacidad de carga", "Capacidad de arrastre"),
    general: general.replace(/motor diésel de alta potencia/gi, "sistema de tracción eléctrico de 24 V")
      .replace(/motor de alta potencia/gi, "accionamiento eléctrico"),
    spec: { ...remainingSpecs, "Capacidad de arrastre": towingCapacity }
  };
};
