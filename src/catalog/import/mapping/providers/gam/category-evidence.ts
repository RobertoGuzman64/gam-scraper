import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";
import { isGamVerifiedYaleGc55vxGlp } from "./yale-gc55vx-glp-evidence.js";
import { isGamVerifiedYaleGc45vxLpg } from "./yale-gc45vx-lpg-evidence.js";

export const specializedLogitransCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  if (record.categoryKey !== "otros-nuevos" || parent !== "volteadores-logitrans") return undefined;
  if (/\belevador\s+de\s+bobinas?\b/.test(title)) return "elevador-de-bobina";
  if (/\bvolteador\s+de\s+bidones?\b/.test(title)) return "volteador-de-bidones";
  if (/\bvolteador\b/.test(title)) return "volteador";
  return null;
};

export const gamDocumentedCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  const short = fold(record.shortDescription ?? "");
  const long = fold(record.longDescription ?? "");
  const rawMotor = record.specs?.["Tipo motor"];
  const motor = rawMotor === undefined ? "" : typeof rawMotor === "string" ? fold(rawMotor) : null;
  const combined = `${title} ${short} ${long}`;
  if (parent === "carretillas-elevadora-diesel-yale" &&
    (isGamVerifiedYaleGc55vxGlp(record) || isGamVerifiedYaleGc45vxLpg(record))) {
    return "carretilla-elevadora-glp";
  }

  if (parent === "reachstacker-hyster" && /\breach[ -]?stacker\b/.test(title)) {
    return /\bmanipulacion de contenedores\b|\bcontenedores iso\b|\bvaciado de contenedores\b/.test(long)
      ? "manipulador-de-contenedores" : null;
  }
  if (parent === "carretillas-elevadoras-diesel-hyster" &&
    /\bcarretilla elevadora glp\b/.test(title) && !/\bdiesel\b/.test(title)) {
    return /\bglp\b/.test(short) && /\bglp\b/.test(long) && motor === "glp" &&
      !/\b(?:diesel|electrica|hibrida)\b/.test(combined)
      ? "carretilla-elevadora-glp" : null;
  }
  if (record.categoryKey === "carretillas-nuevas" && record.condition === "Nuevo" &&
    parent === "carretillas-elevadoras-diesel-hyster" && title === "carretilla elevadora hyster h9xdl6") {
    const model = record.specs?.["Modelo"];
    const drive = record.specs?.["Motorización"];
    return typeof model === "string" && fold(model) === "h9xdl6" &&
      /\bh9xdl6\b/.test(short) && /\bh9xdl6\b/.test(long) &&
      /\bmotor diesel cummins qsb6[.,]7\b/.test(long) &&
      !/\b(?:glp|lpg|gasolina|hibrid[oa]|electric[oa]s?)\b/.test(combined) &&
      (motor === "" || motor === "diesel") &&
      (drive === undefined || (typeof drive === "string" && fold(drive) === "diesel"))
      ? "carretilla-elevadora-diesel" : null;
  }
  if (parent === "carretillas-elevadoras-electricas-hyster" &&
    /\bcarretilla elevadora\b/.test(title) && !/\belectrica\b/.test(title) &&
    !/\b(?:diesel|glp|hibrida)\b/.test(combined)) {
    return /\bcarretilla electrica\b/.test(short) && /\bcarretilla elevadora electrica\b/.test(long) &&
      (motor === "" || motor === "electrico") ? "carretilla-elevadora-electrica" : null;
  }
  if (parent === "tennant" && record.categoryKey === "limpieza-fregadoras" &&
    /\bmicrofregadora\b/.test(title)) {
    return /\bfregadora industrial\b/.test(short) && !/\bbarredora\b/.test(combined)
      ? "fregadora-industrial" : null;
  }
  if (parent === "plataformas-elevadoras-bravi" && record.categoryKey === "elevacion-nueva" &&
    /\bplataforma elevadora\b/.test(title) && /\bleonardo hd\b/.test(title) &&
    /\bleonardo hd\b/.test(fold(typeof record.specs?.["Modelo"] === "string" ? record.specs["Modelo"] : "")) &&
    /\bun unico operario\b/.test(long) && motor === "electrico" &&
    !/\b(?:diesel|glp|gasolina|hibrid[oa])\b/.test(combined)) return "plataforma-unipersonal-electrica";
  if (parent === "plataformas-elevadoras-neumaticos-bravi" && record.categoryKey === "elevacion-nueva" &&
    record.condition === "Nuevo" && fold(record.brand ?? "") === "bravi" &&
    fold(typeof record.specs?.["Marca"] === "string" ? record.specs["Marca"] : "") === "bravi" &&
    fold(typeof record.specs?.["Modelo"] === "string" ? record.specs["Modelo"] : "") === "sprint tl" &&
    /\bplataforma elevadora de neumaticos\b/.test(title) && /\bbravi sprint tl\b/.test(title) &&
    /\bbravi sprint tl\b/.test(long) && /\bneumaticos\b/.test(long) &&
    /\bcapacidad de la cesta 130 kg\b/.test(short) && motor === "electrico" &&
    !/\b(?:diesel|glp|gasolina|hibrid[oa]|dos ocupantes|dos operadores)\b/.test(combined)) {
    return "plataforma-unipersonal-electrica";
  }
  if (parent === "bravi" && /\bplataforma elevadora\b/.test(title) &&
    /\bplataforma unipersonal electrica\b/.test(long) && motor === "electrico" &&
    !/\b(?:diesel|glp|hibrida)\b/.test(combined)) return "plataforma-unipersonal-electrica";
  if (parent === "tractor-de-remolcado-conductor-sentado-7000-kg" &&
    /\btractor de arrastre\b/.test(title) && motor === "electrico" &&
    !/\b(?:diesel|glp|hibrido)\b/.test(combined)) return "tractor-electrico";
  if (parent === "tractor-de-remolcado-conductor-sentado-8000-kg" && record.categoryKey === "marcas-nuevas" &&
    /\btractor de arrastre\b/.test(title) && /\btractor electrico de arrastre\b/.test(short) &&
    /\btractores de arrastre\b/.test(long) && (motor === "" || motor === "electrico") &&
    !/\b(?:diesel|glp|gasolina|hibrido|semi[ -]?electrico)\b/.test(combined)) return "tractor-electrico";
  if (parent === "recogepedidos-bravi" && record.categoryKey === "carretillas-nuevas" &&
    /\bplataforma recogepedidos\b/.test(title)) {
    return /\bplataforma recoge ?pedidos\b/.test(short) &&
      /\b(?:recogida|preparacion) de pedidos\b/.test(long) &&
      !/\b(?:transpaleta|carretilla elevadora|apilador)\b/.test(combined)
      ? "preparapedido" : null;
  }
  return undefined;
};

export const gamElevationCategory = (record: ProductRecord, parent: string, title: string): string | null | undefined => {
  if (record.categoryKey !== "elevacion-nueva") return undefined;
  if (parent === "plataformas-de-tijera-electricas-xcmg" && /\btijera(?=\b|\d)/.test(title)) {
    const description = fold(record.shortDescription ?? "");
    const confirms = /\bplataforma\b[^.!?]{0,100}\btijera\b[^.!?]{0,50}\belectrica\b/.test(description);
    if (confirms && !/\b(?:diesel|hibrid[oa]|gasolina|glp)\b/.test(title + " " + description) &&
      /\b(?:bateria|electric[oa])\b/.test(title + " " + description)) return "plataforma-tijera-electrica";
  }
  return undefined;
};

