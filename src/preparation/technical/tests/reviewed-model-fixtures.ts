import type { ProductRecord } from "../../../contracts/catalog.js";
import { controlledGomarizPlatform } from "../../editorial/core/editorial-contract-records.js";
import { recoverReviewedModelTechnicalSpecs } from "../documented-technical-evidence.js";

export const documentedPlatform = (): ProductRecord => ({
  ...controlledGomarizPlatform(), brand: "LGMG", model: "SR1018D",
  title: "Plataforma de tijera diésel LGMG SR1018D",
  url: "https://www.gomarizrent.com/producto/lgmg-sr1018d/",
  specs: { "Altura de trabajo": "11,7 m", Capacidad: "454 kg", Motor: "Diésel",
    Longitud: "3,76 m", Anchura: "1,79 m", "Altura de plataforma": "9,7 m" }
});

export const recoverDocumented = (record: ProductRecord) => recoverReviewedModelTechnicalSpecs(record, record.specs ?? {});

export const documentedManainJlgPlatform = (brand: string, model: string, height: string, capacity: string,
  length: string, width: string, platformWidth: string, platformLength?: string): ProductRecord => ({
  ...documentedPlatform(), providerId: "manain", reference: "CONTROL-02", brand, model,
  title: model, categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: `https://manain.com/producto/venda-elevacio-tisores-jlg-${model.toLowerCase()}/`,
  specs: { Marca: brand, Modelo: model, Motor: "Eléctrico", "Altura trabajo": height,
    "Capacidad carga": capacity, "Longitud total": length, "Ancho total": width,
    "Ancho plataforma": platformWidth, "Nueva o usada": "usada",
    ...(platformLength === undefined ? {} : { "Longitud plataforma": platformLength }) }
});
