import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";

type CapacityPresentation = Pick<ImportCandidate, "title" | "description_general">;

export const normalizeVerifiedCommercialCapacity = (
  source: ProductRecord, published: ImportCandidate, title: string | null,
  descriptionGeneral: string | null
): CapacityPresentation => {
  if (source.providerId !== "gam" || !title || source.reference !== published.reference ||
    source.url !== published.sourceUrl || published.spec["Marca"] !== "YALE" ||
    published.spec["Capacidad de carga (kg)"] === undefined) {
    return { title, description_general: descriptionGeneral };
  }
  if (source.reference === "1145" &&
    source.url === "https://online.gamrentals.com/es/transpaletas-yale/1145-transporte-facil-de-cargas-de-hasta-14-toneladas-yale-mpc14" &&
    source.model === "MPC14" &&
    published.spec["Modelo"] === "MPC14" &&
    published.spec["Capacidad de carga (kg)"] === "1400 KG" &&
    published.title === "Transpaleta YALE MPC14 2000Kg" &&
    title === "Transpaleta YALE MPC14 2000 kg") {
    return { title: "Transpaleta YALE MPC14 1400 kg", description_general: descriptionGeneral };
  }
  if (source.reference === "6837" &&
    source.url === "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6837-2015-yale-erp25vl" &&
    source.model === "ERP25VL" &&
    published.spec["Modelo"] === "ERP25VL" &&
    published.spec["Capacidad de carga (kg)"] === "2500 KG" &&
    published.title === "Carretilla elevadora eléctrica 3500 Kg YALE ERP25VL" &&
    title === "Carretilla elevadora eléctrica 3500 kg YALE ERP25VL" &&
    descriptionGeneral?.includes("una capacidad de carga indicada de 3500 kg")) {
    return { title: "Carretilla elevadora eléctrica 2500 kg YALE ERP25VL",
      description_general: descriptionGeneral.replace("una capacidad de carga indicada de 3500 kg",
        "una capacidad de carga nominal de 2500 kg") };
  }
  return { title, description_general: descriptionGeneral };
};
