import type { Attribute } from "../classification/attribute-types.js";

export const modularTechnicalFields: readonly Attribute[] = [
  {
    name: "Dimensiones exteriores (L x An x Al)",
    type: "TEXT",
    unit_option: "m"
  },
  {
    name: "Superficie útil",
    type: "NUMBER",
    unit_option: "m²"
  },
  {
    name: "Peso",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Acoplable / Modular",
    type: "TEXT",
    unit_option: "Unión lateral y/o apilable"
  },
  {
    name: "Apilable",
    type: "TEXT",
    unit_option: "Nº de alturas"
  },
  {
    name: "Estructura / Material",
    type: "SELECT",
    unit_option: "Panel sándwich / Acero galvanizado / Madera"
  },
  {
    name: "Aislamiento",
    type: "TEXT",
    unit_option: "Tipo y espesor"
  },
  {
    name: "Nº de puertas",
    type: "NUMBER",
    unit_option: "uds."
  },
  {
    name: "Nº de ventanas",
    type: "TEXT",
    unit_option: "uds. (con reja/persiana)"
  },
  {
    name: "Instalación eléctrica",
    type: "TEXT",
    unit_option: "Cuadro, enchufes, iluminación"
  },
  {
    name: "Preinstalación de fontanería",
    type: "TEXT",
    unit_option: "Entrada/salida de agua"
  },
  {
    name: "Equipamiento sanitario",
    type: "TEXT",
    unit_option: "Nº WC / duchas / lavabos / urinarios"
  },
  {
    name: "Termo de agua caliente",
    type: "TEXT",
    unit_option: "Si/No + Litros"
  },
  {
    name: "Climatización",
    type: "SELECT",
    unit_option: "Sin / Split A/A / Bomba de calor"
  },
  {
    name: "Mobiliario incluido",
    type: "SELECT",
    unit_option: "Mesas / Sillas / Taquillas / Bancos / Literas / Ninguno"
  },
  {
    name: "Transporte y montaje",
    type: "SELECT",
    unit_option: "Incluido / No incluido / Opcional"
  },
  {
    name: "Requisitos de instalación",
    type: "TEXT",
    unit_option: "Base nivelada, acometidas…"
  }
];
