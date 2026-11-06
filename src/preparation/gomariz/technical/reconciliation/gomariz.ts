import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedGomarizPlatformHeight } from "../../../../catalog/normalization/gomariz/technical.js";

export const reconcileGomarizVerifiedPlatformHeight = (record: ProductRecord): ProductRecord => {
  try {
    const source = new URL(record.url);
    if (source.search || source.hash) return record;
  } catch {
    return record;
  }
  const height = verifiedGomarizPlatformHeight(record);
  if (height === null) return record;
  return {
    ...record,
    specs: { ...record.specs, "Altura plataforma": `${height.toLocaleString("es-ES", { maximumFractionDigits: 2 })} m` }
  };
};

export const reconcileGomarizVerifiedElectricSemanticSource = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gomariz" || record.reference !== "BA1465" || record.categoryKey !== "venta" ||
    record.url !== "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/lgmg-a14je-3/" ||
    record.brand !== "LGMG" || record.model !== "A14JE" || record.title !== "LGMG A14JE" ||
    record.specs?.Motor !== "Eléctrico" || record.specs["Altura de trabajo"] !== "15.8 m" ||
    record.specs["Altura plataforma"] !== "13.8 m" || record.specs.Capacidad !== "230 kg" ||
    record.longDescription !== "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.") return record;
  return { ...record, longDescription: "La plataforma articulada eléctrica LGMG A14JE alcanza 15,8 m de altura de trabajo y 13,8 m de altura de plataforma, con 7,81 m de alcance lateral y 230 kg de capacidad." };
};
