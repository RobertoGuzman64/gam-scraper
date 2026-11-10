import type { ProductRecord } from "../../../../contracts/catalog.js";

export const reconcileGamVerifiedCteBLift18HvIdentity = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || record.reference !== "4650" ||
    record.categoryKey !== "elevacion-nueva" || record.condition !== "Nuevo" ||
    record.url !== "https://online.gamrentals.com/es/cte/4650-cte-b-lift-18hv" ||
    record.brand !== "CTE" || record.model !== "B-LIFT 18HV" ||
    record.externalReference !== "B-LIFT 18 HD" ||
    record.title !== "Plataforma elevadora sobre camión telescópica CTE B-LIFT 18HD" ||
    record.shortDescription !== "➨ CTE B-LIFT 18HD Nueva ➨ Venta de plataforma elevadora sobre camión de 18 metros de altura ⭐Capacidad de la cesta 360 kg" ||
    record.specs?.Marca !== "CTE" || record.specs.Modelo !== "B-LIFT 18HV" ||
    record.specs["Altura de elevación (m)"] !== "18 metros" ||
    record.specs["Capacidad de carga (kg)"] !== "300 KG" ||
    !record.image?.endsWith("/cte-b-lift-18hv.jpg") ||
    !record.longDescription?.includes("capacidad de carga en cesta de hasta 300 kg")) return record;
  return {
    ...record,
    title: "Plataforma elevadora sobre camión telescópica CTE B-LIFT 18HV",
    shortDescription: record.shortDescription.replace("B-LIFT 18HD", "B-LIFT 18HV")
  };
};
