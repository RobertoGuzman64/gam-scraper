import type { ProductRecord } from "../../../../../contracts/catalog.js";

export const resolveGomarizCriticalBriefGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz" || record.reference !== "BT1461" ||
    record.url !== "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-telescopico/skyjack-sj45t-telescopic-boom-lift-brazo-telescopico-16-metros/" ||
    record.categoryKey !== "venta" || record.brand !== "Skyjack" || record.model !== "SJ45T" ||
    record.title !== "SKYJACK SJ45T" || record.year !== "2017" ||
    record.longDescription !== "Dimensiones Altura: 16 metros Altura de trabajo: 15.60 m Altura almacenaje: 2.39 m Longitud: 8.79 m Anchura: 2.29 m" ||
    record.specs?.["Altura de trabajo"] !== "15.60 m" ||
    record.specs?.["Altura almacenaje"] !== "2.39 m" ||
    record.specs?.Longitud !== "8.79 m" || record.specs?.Anchura !== "2.29 m" ||
    record.specs?.Motor !== "Diésel" || record.specs?.Capacidad !== "227 kg") return null;

  return "El brazo telescópico Skyjack SJ45T, anunciado como unidad de 2017, es una plataforma " +
    "diésel para realizar trabajos en altura. Según la ficha del proveedor alcanza 15,60 m " +
    "de altura de trabajo y dispone de una capacidad de 227 kg. Su longitud es de 8,79 m " +
    "y su anchura de 2,29 m, dimensiones importantes para comprobar accesos y espacio de maniobra. " +
    "La altura de almacenaje publicada es de 2,39 m, dato útil para planificar su transporte " +
    "y almacenamiento. La capacidad y los requisitos de apoyo deben verificarse para cada trabajo.";
};
