import type { ProductRecord } from "../../../../../contracts/catalog.js";

const spec = (record: ProductRecord, name: string): string | null => {
  const value = record.specs?.[name];
  return typeof value === "string" ? value : null;
};

const identity = (record: ProductRecord, reference: string, url: string): boolean =>
  record.providerId === "gam" && record.reference === reference && record.url === url &&
  !record.url.includes("?") && !record.url.includes("#");

const trailers = (record: ProductRecord): string | null => {
  if (!identity(record, "5710", "https://online.gamrentals.com/es/resto-maquinaria-segunda-mano/5710-1999-noteboom-mco") ||
    record.categoryKey !== "otros" || record.condition !== "Segunda mano" ||
    record.title !== "Platafora 4 ejes NOTEBOOM MCO" || record.brand !== "NOOTEBOOM" ||
    record.model !== "MCO" || record.externalReference !== "EIM-00001" ||
    record.shortDescription !== record.title ||
    record.longDescription?.trim() !== "· Equipo matriculado, ITV vigente hasta mayo 2026" ||
    spec(record, "Marca") !== record.brand || spec(record, "Modelo") !== record.model ||
    spec(record, "Nº de serie") !== "XMRMC0000W0000728" ||
    spec(record, "Longitud") !== "17600 mm" || spec(record, "Anchura") !== "2720 mm" ||
    spec(record, "Altura") !== "2550 mm" || spec(record, "Peso") !== "21400 KG" ||
    spec(record, "Año de fabricación") !== "1999") return null;

  return "Esta plataforma de cuatro ejes, modelo MCO, se anuncia como equipo de segunda mano de 1999. " +
    "La ficha de la unidad recoge 17.600 mm de longitud, 2.720 mm de anchura y 2.550 mm de altura, " +
    "con un peso declarado de 21.400 kg. Estas medidas permiten evaluar las necesidades de espacio " +
    "y transporte antes de su utilización. La identificación de la unidad se conserva mediante su " +
    "número de serie XMRMC0000W0000728. La situación de inspecciones y documentación de circulación " +
    "debe comprobarse de nuevo; el plazo indicado en el anuncio era mayo de 2026.";
};

const knott = (record: ProductRecord): string | null => {
  const serial = record.reference === "6358" ? "CPH200003" :
    record.reference === "6367" ? "CPH200004" : null;
  const external = record.reference === "6358" ? "GAM-11617" :
    record.reference === "6367" ? "GAM-11618" : null;
  if (!serial || !external || !identity(record, record.reference ?? "", `https://online.gamrentals.com/es/carro-de-equipaje/${record.reference}-2019-knott-krv20`) ||
    record.categoryKey !== "otros" || record.title !== "Carro de arrastre 2000Kg KNOTT KRV20" ||
    record.brand !== "KNOTT" || record.model !== "KRV20" ||
    record.externalReference !== external ||
    spec(record, "Marca") !== record.brand || spec(record, "Modelo") !== record.model ||
    spec(record, "Nº de serie") !== serial || spec(record, "Ubicación") !== "VIZCAYA" ||
    spec(record, "País") !== "ESPAÑA" || record.shortDescription !== record.longDescription ||
    record.shortDescription !== "Carro de arrastre KNOTT KRV20. Capacidad de carga 2000kg. Año de fabricación 2019.") return null;

  return `El carro de arrastre KNOTT KRV20 corresponde a una unidad anunciada con año de fabricación 2019 ` +
    `y capacidad de carga declarada de 2.000 kg. Es un equipo de arrastre para el traslado de cargas, ` +
    `cuya compatibilidad con el vehículo tractor y las condiciones de uso deben contrastarse antes ` +
    `de incorporarlo a la operación. Esta unidad figura ubicada en Vizcaya, con número de serie ${serial} ` +
    `y referencia comercial ${external}. Estos identificadores permiten distinguirla de otros carros ` +
    `del mismo modelo presentes en el catálogo.`;
};

const yaleAndHyster = (record: ProductRecord): string | null => {
  if (!record.reference || !record.title || !record.shortDescription ||
    record.categoryKey !== (record.reference === "920" ? "apiladores-nuevos" : "carretillas-nuevas") ||
    record.condition !== "Nuevo" || record.longDescription !== record.shortDescription ||
    record.longDescription.split(/\s+/u).filter(Boolean).length >= 20 ||
    spec(record, "Marca") !== record.brand || spec(record, "Modelo") !== record.model ||
    record.externalReference !== record.model) return null;

  if (identity(record, "920", "https://online.gamrentals.com/es/apiladores-yale/920-apilador-de-operario-a-pie-simplemente-eficiente") &&
    record.brand === "YALE" && record.model === "MS15UX" &&
    record.title === "Apilador eléctrico 1500Kg Yale MS15UX" &&
    record.shortDescription === "➨ YALE MS15UX ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1500 kg" &&
    spec(record, "Capacidad de carga (kg)") === "1500 KG" &&
    spec(record, "Motorización") === "Eléctrico" && spec(record, "Longitud") === "1950 mm" &&
    spec(record, "Altura") === "2235 mm" && spec(record, "Peso") === "1300 KG") {
    return "El apilador eléctrico Yale MS15UX está destinado a la manipulación y apilado de cargas " +
      "en operaciones de almacén y logística interna. La ficha técnica declara una capacidad de " +
      "carga de 1.500 kg y motorización eléctrica. El equipo tiene 1.950 mm de longitud y 2.235 mm " +
      "de altura, con un peso publicado de 1.300 kg. Estas dimensiones son relevantes para " +
      "comprobar los espacios disponibles y la compatibilidad de los recorridos con el equipo " +
      "antes de su incorporación a una instalación.";
  }

  if (identity(record, "2263", "https://online.gamrentals.com/es/carretillas-trilaterales-yale/2263-tractor-electrico-yale-mtc10") &&
    record.brand === "YALE" && record.model === "MTC10" &&
    record.title === "Carretilla trilateral 1000Kg Yale MTC10" &&
    record.shortDescription === "➨ YALE MTC10 ➨ Venta de Carretilla trilateral nueva ⭐Capacidad de carga de 1000 kg" &&
    spec(record, "Capacidad de carga (kg)") === "1000 KG" &&
    spec(record, "Longitud") === "3538 mm" && spec(record, "Altura") === "3290 mm" &&
    spec(record, "Peso") === "6276 KG" &&
    spec(record, "Capacidad de la batería") === "48V / 560-700Ah(V/Ah)") {
    return "La carretilla trilateral Yale MTC10 está orientada a operaciones de manutención en " +
      "pasillos estrechos y zonas de almacenamiento con estanterías. Su capacidad de carga " +
      "publicada es de 1.000 kg. La ficha identifica una alimentación de batería de 48 V, " +
      "con un intervalo indicado de 560 a 700 Ah. El equipo mide 3.538 mm de longitud " +
      "y 3.290 mm de altura, y declara 6.276 kg de peso. Las dimensiones y la carga " +
      "permiten valorar su encaje en las instalaciones de almacenamiento.";
  }

  if (identity(record, "2111", "https://online.gamrentals.com/es/carretillas-trilaterales-hyster/2111-carretilla-para-pasillos-estrechos-hyster-c13-48v") &&
    record.brand === "HYSTER" && record.model === "C1.3 48V" &&
    record.title === "Carretilla para pasillos estrechos Hyster C1.3 48V" &&
    record.shortDescription === "➨ HYSTER C1.3 48V ➨ Venta de Carretilla Elevadora Pasillos Estrechos 10 metros ⭐Capacidad de carga de 1300 kg" &&
    spec(record, "Capacidad de carga (kg)") === "1300 KG" &&
    spec(record, "Altura de elevación (mm)") === "10880 mm" &&
    spec(record, "Capacidad de la batería") === "48V / 700-840Ah(V/Ah)" &&
    spec(record, "Peso") === "6701 KG") {
    return "La carretilla para pasillos estrechos Hyster C1.3 48V está concebida para " +
      "operaciones de almacenamiento y preparación de cargas en zonas de espacio limitado. " +
      "Su ficha indica una capacidad de carga de 1.300 kg y una altura de elevación de " +
      "10.880 mm. La batería publicada es de 48 V, con capacidades de 700 a 840 Ah " +
      "según configuración, y el peso declarado del equipo es de 6.701 kg. Estos valores " +
      "permiten contrastar la capacidad, los niveles de trabajo y las necesidades de la instalación.";
  }

  return null;
};

const genieS65 = (record: ProductRecord): string | null => {
  if (!identity(record, "6617", "https://online.gamrentals.com/es/elevadores-telescopicos-segunda-mano/6617-2005-genie-s-65") ||
    record.categoryKey !== "elevacion" || record.brand !== "GENIE" || record.model !== "S-65" ||
    record.title !== "GENIE S-65 | Plataforma Telescópica Diésel 20M | GAM Online" ||
    record.externalReference !== "JP-00316" || record.condition !== "Segunda mano" ||
    record.shortDescription !== record.longDescription ||
    record.shortDescription !== "➨ GENIE S-65 de ocasión ➨ Venta de plataforma telescópica diésel de 20 metros de altura ⭐Capacidad de la cesta 227 kg" ||
    spec(record, "Marca") !== "GENIE" || spec(record, "Modelo") !== "S-65" ||
    spec(record, "Capacidad de carga (kg)") !== "227 KG" ||
    spec(record, "Pendiente superable") !== "45%" ||
    spec(record, "Longitud") !== "9500 mm" || spec(record, "Anchura") !== "2490 mm" ||
    spec(record, "Peso") !== "10430 KG" || spec(record, "Horómetro") !== "6043 horas" ||
    spec(record, "Nº de serie") !== "S6005-11160") return null;

  return "La plataforma telescópica diésel Genie S-65 se ofrece como unidad de segunda mano, " +
    "con una capacidad de carga en cesta declarada de 227 kg. La ficha identifica " +
    "una pendiente superable del 45 % y unas dimensiones de 9.500 mm de longitud " +
    "y 2.490 mm de anchura, con un peso de 10.430 kg. Consta un horómetro de 6.043 horas " +
    "y el número de serie S6005-11160, útiles para identificar y comprobar esta unidad. " +
    "La altura operativa debe contrastarse antes de su utilización, ya que el anuncio y la ficha técnica difieren.";
};

export const resolveGamCriticalBriefGeneral = (record: ProductRecord): string | null =>
  trailers(record) ?? knott(record) ?? yaleAndHyster(record) ?? genieS65(record);
