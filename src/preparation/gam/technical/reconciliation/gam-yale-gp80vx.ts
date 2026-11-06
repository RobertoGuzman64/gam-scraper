import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";

const sourceFingerprint = "631b197a86ddc8621878eb2785467951c2b29a1cbcb6986c7759f6ca46cd49db";

const fingerprint = (record: ProductRecord): string => createHash("sha256")
  .update(JSON.stringify(Object.entries(record).filter(([field]) => field !== "scrapedAt")))
  .digest("hex");

export const reconcileGamVerifiedYaleGp80vx = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "2328" ||
    record.url !== "https://online.gamrentals.com/es/carretillas-elevadora-diesel-yale/2328-carretilla-frontal-diesel-yale-gp80svx" ||
    record.categoryKey !== "carretillas-nuevas" || record.condition !== "Nuevo" ||
    record.brand !== "YALE" || record.model !== "GDP/GLP80VX" ||
    record.specs?.Marca !== "YALE" || record.specs.Modelo !== "GDP/GLP80VX" ||
    record.specs["Capacidad de carga (kg)"] !== "8000 KG" ||
    record.specs.Motorización !== "Diésel" ||
    fingerprint(record) !== sourceFingerprint) return record;

  return {
    ...record,
    model: "GDP80VX",
    title: "Carretilla frontal diésel Yale GDP80VX de 8.000 kg",
    shortDescription: "Carretilla elevadora diésel Yale GDP80VX nueva, con capacidad de carga de 8.000 kg y centro de carga de 600 mm.",
    longDescription: "Carretilla elevadora frontal diésel Yale GDP80VX de 8.000 kg de capacidad nominal a 600 mm de centro de carga. Su ficha técnica comercial indica 2.082 mm de anchura y 11.466 kg de peso. El fabricante identifica la familia GDP/GLP80VX y la ficha de venta especifica la configuración diésel.",
    specs: { ...record.specs, Modelo: "GDP80VX" }
  };
};
