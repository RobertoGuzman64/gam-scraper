import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

const apiladores = new Set(["apiladores-hyster", "apiladores-yale", "apiladores-logitrans"]);
const transpaletas = new Set(["transpaletas-hyster", "transpaletas-yale", "transpaletas-logitrans", "transpaleta-electrica-compacta-1500-kg", "transpaleta-electrica-conductor-acompanante-1600-kg"]);
const preparapedidos = new Set(["recogepedidos-hyster", "recogepedidos-yale", "yale"]);

export const gamHandlingCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  if (preparapedidos.has(parent) && /\b(?:recogepedidos?|preparapedidos?)\b/.test(title)) {
    return /\b(?:plataforma|carretilla|apilador|transpaleta)\b/.test(title) ? null : "preparapedido";
  }
  const apilador = apiladores.has(parent) && /\bapilador(?:a|es|as)?\b/.test(title);
  const transpaleta = (transpaletas.has(parent) || parent === "hyster") &&
    /\b(?:transpaletas?|portador de paletas)\b/.test(title);
  if (!apilador && !transpaleta) return undefined;
  const short = fold(record.shortDescription ?? "");
  const source = `${title} ${short}`;
  const specs = record.specs ?? {};
  const drive = fold([specs["Tipo motor"], specs["Motorización"]].filter((value) => typeof value === "string").join(" "));
  if (/\b(?:semi[ -]?electric[oa]s?|hibrid[oa]s?|diesel|glp|gasolina)\b/.test(`${source} ${drive}`)) return null;
  if (transpaleta && /\btranspaleta\b.*\btijera\b/.test(title)) return "transpaleta-tijera";
  const manual = /\bmanual(?:es)?\b/.test(title) ||
    /\b(?:transpaleta|apilador(?:a)?)\s+manual\b/.test(short);
  const electric = /\belectric[oa]s?\b|\b(?:ion de litio|bateria de litio|propulsada con ion de litio)\b/.test(source) ||
    /\belectric[oa]s?\b/.test(drive);
  const specManual = /\bmanual\b/.test(drive);
  const specElectric = /\belectric[oa]s?\b/.test(drive);
  if ((manual && (electric || specElectric)) || (specManual && (electric || specElectric)) ||
    (specElectric && specManual)) return null;
  if ((manual || specManual) && transpaleta && parent === "transpaletas-yale" &&
    /\btranspaletas? motorizadas?\b/.test(fold(record.longDescription ?? "")) &&
    /\b24\s*v\b/.test(fold(typeof specs["Capacidad de la batería"] === "string" ? specs["Capacidad de la batería"] : ""))) return null;
  if (parent === "transpaletas-yale" && record.categoryKey === "marcas-nuevas" &&
    /\btranspaleta\b/.test(title) && /\bmp20\s*xv\b/.test(title)) {
    const model = specs["Modelo"];
    const battery = specs["Capacidad de la batería"];
    const long = fold(record.longDescription ?? "");
    const combined = `${title} ${short} ${long} ${drive}`;
    return /\bmp20\s*xv\b/.test(fold(typeof model === "string" ? model : "")) &&
      /\bplataforma de trabajo a bordo\b/.test(short) &&
      /\bmp20\s*xv\b/.test(long) &&
      /\b24\s*v\b/.test(fold(typeof battery === "string" ? battery : "")) &&
      !/\b(?:manual|diesel|glp|gasolina|hibrid[oa]|semi[ -]?electric[oa])\b/.test(combined) &&
      (drive === "" || /\belectric[oa]\b/.test(drive)) ? "transpaleta-electrica" : null;
  }
  if (manual || specManual) return apilador ? "apilador-manual" : "transpaleta-manual";
  if (transpaleta && parent === "transpaletas-logitrans" && record.categoryKey === "marcas-nuevas" &&
    record.condition === "Nuevo" && fold(record.brand ?? "") === "logitrans" &&
    fold(typeof specs["Marca"] === "string" ? specs["Marca"] : "") === "logitrans") {
    const model = fold(typeof specs["Modelo"] === "string" ? specs["Modelo"] : "");
    const long = fold(record.longDescription ?? "");
    const documentedManual = (model === "logiq 200/300" &&
      /\btranspaleta de cuartos de pale logitrans logiq 200\/300\b/.test(title) &&
      /\blogiq 200\/300\b/.test(short) && /\bmodelo logiq 200\b/.test(long)) ||
      (model === "wsp 2200" && /\btranspaleta con balanza 2200 kg logitrans wsp 2200\b/.test(title) &&
      /\blogitrans wsp 2200\b/.test(short) && /\bmodelo wsp 2200\b/.test(long));
    if (documentedManual) {
      return electric || specElectric || /\b(?:diesel|glp|gasolina|hibrid[oa]|propulsion electrica|traccion electrica)\b/.test(long)
        ? null : "transpaleta-manual";
    }
  }
  if (electric) return apilador ? "apilador-electrico" : "transpaleta-electrica";
  if (parent === "transpaletas-yale" && record.categoryKey === "marcas-nuevas" &&
    /\btranspaleta\b/.test(title) && !/\b(?:manual|tijera)\b/.test(title)) {
    const model = specs["Modelo"];
    const battery = specs["Capacidad de la batería"];
    const modelName = typeof model === "string" ? fold(model).trim() : "";
    const batteryText = typeof battery === "string" ? fold(battery) : "";
    const long = fold(record.longDescription ?? "");
    const combined = `${title} ${short} ${long} ${drive}`;
    if (modelName && modelName.length >= 4 &&
      title.includes(modelName) && long.includes(modelName) &&
      /\btranspaletas? motorizadas? compactas?\b/.test(long) &&
      /\b24\s*v\b/.test(batteryText) &&
      !/\b(?:manual|diesel|glp|lpg|gasolina|hibrid[oa]|semi[ -]?electric[oa])\b/.test(combined)) {
      return "transpaleta-electrica";
    }
    return null;
  }
  return null;
};

