import type { ProductRecord } from "../../../../../contracts/catalog.js";

export const gomarizPriorityShortEvidence = {
  GR1113: {
    url: "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/himoinsa-hfw-605t-generador-generator/",
    brand: "Himoinsa",
    model: "HFW-605T",
    title: "Himoinsa HFW-605T",
    year: "2006",
    condition: "Segunda mano",
    general: "Las torres de iluminación son remolcables y regulables en altura para optimizar el área de iluminación. Tenemos con generador integrado que son energéticamente autosuficientes. Tenemos que funcionan con gasoil y otras que son mixtas baterías y gasoil. Dependiendo de donde vayas a trabajar, solución a medida.",
    specs: { Potencia: "60kVA", Peso: "1786kg" },
    description: "Grupo electrógeno Himoinsa HFW-605T de segunda mano, año 2006, con potencia aparente anunciada de 60 kVA.",
    manufacturerSource: "https://www.himoinsa.com/gama-generadores-diesel-50hz/grupos-electrogenos-para-industria/hfw/6-My0yLTItMS0xLTE%3D/esp.html",
    supplierSource: "https://www.gomarizrent.com/wp-content/uploads/2024/08/FICHA-TECNICA-1.pdf"
  },
  BA1465: {
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/lgmg-a14je-3/",
    brand: "LGMG",
    model: "A14JE",
    title: "LGMG A14JE",
    year: "2022",
    condition: "Segunda mano",
    general: "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.",
    specs: { "Altura de trabajo": "15.8 m", "Alcance lateral": "7.81 m", Capacidad: "230 kg", Motor: "Eléctrico" },
    description: "Plataforma articulada eléctrica LGMG A14JE, año 2022, con altura de trabajo de 15,8 m, alcance lateral de 7,81 m y capacidad de 230 kg.",
    manufacturerSource: "https://www.lgmglifts.com/es/product/pro-detail-1951.htm",
    supplierSource: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/lgmg-a14je-3/"
  }
} as const;

export const verifiedGomarizPriorityShortDescription = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.shortDescription?.trim() || !record.reference) return null;
  const evidence = Object.entries(gomarizPriorityShortEvidence).find(([reference]) => reference === record.reference)?.[1];
  if (!evidence || record.url !== evidence.url || record.brand !== evidence.brand ||
    record.model !== evidence.model || record.title !== evidence.title ||
    record.year !== evidence.year || record.condition !== evidence.condition ||
    record.longDescription !== evidence.general) return null;
  for (const [key, value] of Object.entries(evidence.specs)) {
    if (record.specs?.[key] !== value) return null;
  }
  return evidence.description;
};
