import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../../mapping/providers/mercaeleva/technical.js";

const evidence = {
  "M432-1479": {
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Kubota-U10-3-M432-1479",
    title: "Kubota U10.3 MINIEXCAVADORA ORUGA 1000 KG",
    brand: "Kubota", model: "U10.3", year: "2020", article: "858", hours: "1393 h",
    original: "Ref. 858 MINIEXCAVADORA ORUGA CAPACIDAD 1000 KG KUBOTA U10.3 HORAS 1393 AÑO DE FABRICACION 2020",
    additional: "MINIEXCAVADORA ORUGA 1000 KG", motor: "Diesel",
    manufacturerSource: "https://ke.kubota-eu.com/constructionmachinery/products/u10-3/",
    description: "La miniexcavadora de orugas Kubota U10.3 se anuncia como una unidad usada de 2020 con 1.393 horas registradas. El fabricante describe el modelo U10-3 con giro sin voladizo trasero y ancho de orugas variable, características orientadas al acceso y la maniobra en espacios reducidos. Es un equipo para pequeñas excavaciones, zanjas y trabajos de mantenimiento en obra. Esta unidad utiliza motor diésel y está identificada mediante la referencia comercial 858 del vendedor."
  },
  "M913-0641": {
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Kubota-U27-4-M913-0641",
    title: "Kubota U27.4 MINIEXCAVADORA ORUGA 2700 KG",
    brand: "Kubota", model: "U27.4", year: "2019", article: "714", hours: "2753 h",
    original: "Ref. 714 MINIEXCAVADORA ORUGA CAPACIDAD 2700 KG KUBOTA U27.4 HORAS 2753 AÑO DE FABRICACION 2019",
    additional: "MINIEXCAVADORA ORUGA 2700 KG", motor: "Diesel",
    manufacturerSource: "https://kbm.kubota-eu.com/constructionmachinery/en/products/u27-4/",
    description: "La Kubota U27.4 es una miniexcavadora de orugas destinada a trabajos de excavación y movimiento de tierras en zonas con espacio limitado. La unidad del catálogo figura como usada, fabricada en 2019 y con 2.753 horas de trabajo registradas. Kubota documenta para el modelo U27-4 giro de cola cero y una profundidad máxima de excavación de 2,82 m, prestaciones relevantes para abrir zanjas o intervenir junto a obstáculos. El anuncio identifica esta unidad diésel mediante la referencia 714."
  },
  "M736-5615": {
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Ausa-D450AHG-M736-5615",
    title: "Ausa D450AHG DUMPER GIRATORIO 4500 KG",
    brand: "Ausa", model: "D450AHG", year: "2019", article: "691", hours: "2845 h",
    original: "Ref. 691 DUMPER GIRATORIO CAPACIDAD DE CARGA 4500 KG AUSA D450AHG HORAS 2845 AÑO DE FABRICACION 2019",
    additional: "DUMPER GIRATORIO 4500 KG", motor: null,
    manufacturerSource: "https://www.ausa.com/es-es/dumpers/d450ahg",
    description: "El dumper giratorio AUSA D450AHG está diseñado para transportar y descargar áridos y materiales sueltos en obra. El fabricante documenta una capacidad nominal de 4.500 kg, chasis articulado y tolva con giro de hasta 180°, que permite orientar la descarga sin recolocar por completo el vehículo. Esta unidad se anuncia usada, con año de fabricación 2019 y 2.845 horas registradas. Consta como referencia 691 del vendedor y la ficha original indica certificación CE."
  },
  "M095-5362": {
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-STAR-10-M095-5362",
    title: "Haulotte STAR-10 PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT",
    brand: "Haulotte", model: "STAR-10", year: "2013", article: "740", hours: "617 h",
    original: "Ref. 740 PLATAFORMA VERTICAL AUTOPROPULSADA ALTURA DE TRABAJO 10 MT HAULOTTE STAR-10 HORAS 617 AÑO DE FABRICACION 2013",
    additional: "PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT", motor: "Eléctrico",
    manufacturerSource: "https://www.haulotte.com.es/es_ES/productos/star-10",
    description: "La Haulotte STAR-10 anunciada es una plataforma vertical autopropulsada eléctrica con altura de trabajo indicada de 10 m. El mástil con plumín permite acercar la cesta a puntos de mantenimiento o instalación en zonas de acceso limitado. Haulotte describe para el modelo un alcance horizontal de hasta 3 m y un diseño que evita el voladizo trasero durante el giro. Esta unidad usada fue fabricada en 2013, registra 617 horas y corresponde a la referencia 740 del vendedor."
  },
  "M144-5512": {
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-STAR-10-M144-5512",
    title: "Haulotte STAR-10 PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT",
    brand: "Haulotte", model: "STAR-10", year: "2013", article: "448", hours: "377 h",
    original: "Ref. 448 PLATAFORMA VERTICAL AUTOPROPULSADA ALTURA DE TRABAJO 10 MT HAULOTTE STAR-10 HORAS 377 AÑO DE FABRICACION 2013",
    additional: "PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT", motor: "Eléctrico",
    manufacturerSource: "https://www.haulotte.com.es/es_ES/productos/star-10",
    description: "La plataforma eléctrica Haulotte STAR-10 está orientada a intervenciones de mantenimiento, montaje e instalaciones en altura. El vendedor declara 10 m de altura de trabajo para esta unidad; la documentación de gama señala un mástil vertical con plumín y hasta 3 m de alcance horizontal, útil para aproximarse a puntos de difícil acceso. El anuncio la identifica como equipo usado de 2013, con 377 horas registradas y referencia comercial 448. Son los datos que distinguen esta unidad de otras STAR-10 anunciadas."
  },
  "M171-6370": {
    url: "https://sales.mercaeleva.com/es/for-sale/machine/Haulotte-STAR-10-M171-6370",
    title: "Haulotte STAR-10 PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT",
    brand: "Haulotte", model: "STAR-10", year: "2013", article: "454", hours: "1126 h",
    original: "Ref. 454 PLATAFORMA VERTICAL AUTOPROPULSADA ALTURA DE TRABAJO 10 MT HAULOTTE STAR-10 HORAS 1126 AÑO DE FABRICACION 2013",
    additional: "PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT", motor: "Eléctrico",
    manufacturerSource: "https://www.haulotte.com.es/es_ES/productos/star-10",
    description: "Esta Haulotte STAR-10 es una plataforma vertical autopropulsada para elevar personal a puntos de trabajo en espacios limitados. Dispone de motorización eléctrica y la ficha del vendedor indica 10 m de altura de trabajo. El fabricante describe un plumín que aporta alcance horizontal al mástil, facilitando tareas sobre instalaciones u obstáculos. La unidad se publica como usada, fabricada en 2013 y con 1.126 horas de utilización registradas. Su referencia de vendedor es 454, distinta de otras máquinas del mismo modelo."
  },
  "M200-9533": {
    url: "https://sales.mercaeleva.com/es/for-sale/machine/JLG-4014PS-M200-9533",
    title: "JLG 4014PS MANIPULADOR TELESCOPICO 14 MT",
    brand: "JLG", model: "4014PS", year: "2014", article: "721", hours: "5324 h",
    original: "Ref. 721 MANIPULADOR TELESCOPICO ALTURA DE TRABAJO 14 MT JLG 4014PS HORAS 5324 AÑO DE FABRICACION 2014",
    additional: "MANIPULADOR TELESCOPICO 14 MT", motor: "Diesel",
    description: "El manipulador telescópico diésel JLG 4014PS se utiliza para elevar y posicionar cargas en trabajos de construcción y suministro de materiales. La ficha del vendedor declara 4.000 kg de capacidad máxima y 14 m de altura máxima de elevación, valores que deben evaluarse junto con el alcance y la configuración de trabajo. Esta unidad está anunciada como usada, se fabricó en 2014 y presenta 5.324 horas registradas. La referencia comercial 721 permite diferenciarla de otras unidades del modelo."
  }
} as const;

export const verifiedMercaelevaCriticalGeneral = (record: ProductRecord): string | null => {
  if (!validMercaelevaTechnicalSource(record) || record.providerId !== "mercaeleva" ||
    record.categoryKey !== "venta" || !record.reference || record.condition !== "Segunda mano" ||
    !record.longDescription) return null;
  const item = Object.entries(evidence).find(([reference]) => reference === record.reference)?.[1];
  if (!item || record.url !== item.url || record.title !== item.title ||
    record.brand !== item.brand || record.model !== item.model ||
    record.longDescription.trim() !== item.original || record.year !== item.year ||
    record.horometer !== item.hours || record.specs?.["Marca"] !== item.brand ||
    record.specs?.["Modelo"] !== item.model || record.specs?.["Título adicional"] !== item.additional ||
    record.specs?.["Año de fabricación"] !== item.year || record.specs?.["Artículo No."] !== item.article ||
    record.specs?.["Horas laborales"] !== item.hours || record.specs?.["Estado"] !== "Usado" ||
    (item.motor !== null && record.specs?.["Tipo de motor"] !== item.motor)) return null;
  if (item.model === "STAR-10" && record.specs?.["Altura de trabajo"] !== "10 m") return null;
  if (item.model === "D450AHG" && record.specs?.["Certificación CE"] !== "Yes") return null;
  if (item.model === "4014PS" && (record.specs?.["Altura máxima de elevación"] !== "14 m" ||
    record.specs?.["Capacidad máxima de elevación"] !== "4000 kg")) return null;
  return item.description;
};
