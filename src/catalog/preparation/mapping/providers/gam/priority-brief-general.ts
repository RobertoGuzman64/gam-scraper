import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { orion55cpEditorialEvidence } from "../../../evidence/providers/gam/orion55cp-editorial.js";

const spec = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" ? value : null;
};

const originalIdentity = (record: ProductRecord, reference: string, url: string): boolean =>
  record.providerId === "gam" && record.reference === reference && record.url === url &&
  !record.url.includes("?") && !record.url.includes("#");

const orionGeneral = (record: ProductRecord): string | null => {
  const evidence = orion55cpEditorialEvidence;
  if (!originalIdentity(record, evidence.reference, evidence.sellerUrl) ||
    record.categoryKey !== "portaferetros" || record.condition !== "Nuevo" ||
    record.title !== `Portaféretros ${evidence.model}` || record.model !== evidence.model ||
    record.externalReference !== evidence.model || record.brand ||
    record.longDescription?.trim() !== "Equipamiento Estándar:" ||
    record.shortDescription?.trim() !== "Portaféretros homologado con sistema de elevación por tijera, con altura máxima de trabajo 5,5 metros." ||
    spec(record, "Modelo") !== evidence.model ||
    spec(record, "Capacidad de carga (kg)") !== "400 KG" ||
    spec(record, "Altura de trabajo (m)") !== "5.5 metros" ||
    spec(record, "Peso") !== "1840 KG" || spec(record, "Anchura") !== "1360 mm") return null;

  return "El portaféretros Orion 55 CP es un equipo de elevación por tijera destinado a trabajos funerarios en altura. " +
    "La ficha del proveedor indica una altura máxima de trabajo de 5,5 metros, una capacidad de carga de 400 kg " +
    "y un peso de 1.840 kg. Su equipamiento estándar incluye una mesa portaféretros giratoria de 360°, " +
    "rodillos de apoyo, plataformas laterales y cuatro estabilizadores manuales para nivelar el equipo. " +
    "También dispone de un mando joystick para tracción y elevación progresivas, un sistema de descenso " +
    "de emergencia y protección frente a sobrecargas.";
};

const landRoverGeneral = (record: ProductRecord): string | null => {
  if (!originalIdentity(record, "6217", "https://online.gamrentals.com/es/vehiculos-segunda-mano/6217-2018-land-rover-range-rover-sport") ||
    record.categoryKey !== "movilidad" || record.condition !== "Segunda mano" ||
    record.title !== "2018 LAND ROVER RANGE ROVER SPORT" ||
    record.brand !== "LAND ROVER" || record.model !== "RANGE ROVER SPORT" ||
    record.externalReference !== "0026-KRK" ||
    record.longDescription?.trim() !== "ITV vigente hasta Noviembre 2026" ||
    record.shortDescription?.trim() !== "Todoterreno híbrido LAND ROVER RANGE ROVER SPORT. Año 2018." ||
    spec(record, "Marca") !== record.brand || spec(record, "Modelo") !== record.model ||
    spec(record, "Año de fabricación") !== "2018" || spec(record, "Kilómetros") !== "194101 KM" ||
    spec(record, "Longitud") !== "4880 mm" || spec(record, "Anchura") !== "1980 mm" ||
    spec(record, "Altura") !== "1780 mm" || spec(record, "Peso") !== "2625 KG") return null;

  return "Este Land Rover Range Rover Sport se ofrece como vehículo de ocasión, con año de fabricación 2018 " +
    "y un kilometraje publicado de 194.101 km. La ficha de la unidad recoge 4.880 mm de longitud, " +
    "1.980 mm de anchura y 1.780 mm de altura, además de un peso de 2.625 kg. " +
    "Estos datos permiten identificar las dimensiones y el uso registrado del vehículo anunciado. " +
    "La fecha de inspección indicada en el anuncio original debe verificarse por separado antes de una nueva operación comercial.";
};

const hysterGeneral = (record: ProductRecord): string | null => {
  if (!originalIdentity(record, "2150", "https://online.gamrentals.com/es/manipuladores-de-contenedores-hyster/2150-manipulador-de-contenedores-hyster-h8xd-ec7") ||
    record.categoryKey !== "marcas-nuevas" || record.condition !== "Nuevo" ||
    record.title !== "Manipulador de contenedores Hyster H8XD-EC7" ||
    record.brand !== "HYSTER" || record.model !== "H8XD-EC7" ||
    record.externalReference !== record.model ||
    record.shortDescription?.trim() !== record.longDescription?.trim() ||
    !record.longDescription?.includes("H8XD-EC7") ||
    !record.longDescription.includes("8000 kg") ||
    spec(record, "Marca") !== record.brand || spec(record, "Modelo") !== record.model ||
    spec(record, "Tipo motor") !== "MTU 7.7L Diesel" ||
    spec(record, "Capacidad de carga (kg)") !== "8000 KG" ||
    spec(record, "Altura de elevación (m)") !== "18,768 metros" ||
    spec(record, "Centro de carga") !== "1220 mm" ||
    spec(record, "Longitud") !== "9262 mm" || spec(record, "Anchura") !== "6824 mm" ||
    spec(record, "Peso") !== "36862 KG" || spec(record, "Transmisión") !== "ZF - 5WG211") return null;

  return "El manipulador de contenedores Hyster H8XD-EC7 está destinado a operaciones de elevación y " +
    "movimiento de contenedores en terminales y zonas logísticas. Su ficha técnica indica una capacidad " +
    "nominal de 8.000 kg, un centro de carga de 1.220 mm y una altura de elevación publicada de 18,768 metros. " +
    "Equipa un motor diésel MTU de 7,7 litros y transmisión ZF 5WG211. Sus dimensiones son 9.262 mm de " +
    "longitud por 6.824 mm de anchura, con un peso declarado de 36.862 kg; son datos relevantes para " +
    "comprobar el espacio y las condiciones de maniobra de la instalación.";
};

export const resolveGamPriorityBriefGeneral = (record: ProductRecord): string | null =>
  orionGeneral(record) ?? landRoverGeneral(record) ?? hysterGeneral(record);
