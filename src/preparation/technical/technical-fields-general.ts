import type { Attribute } from "../classification/attribute-types.js";

export const generalTechnicalFields: readonly Attribute[] = [
  {
    name: "Marca",
    type: "TEXT",
    unit_option: "Genie"
  },
  {
    name: "Modelo",
    type: "TEXT",
    unit_option: "GS-1932"
  },
  {
    name: "Año de fabricación",
    type: "NUMBER",
    unit_option: "número"
  },
  {
    name: "Horas de uso",
    type: "NUMBER",
    unit_option: "número"
  },
  {
    name: "Motorización / Energía",
    type: "SELECT",
    unit_option: "Eléctrico"
  },
  {
    name: "Ubicación / Delegación",
    type: "TEXT",
    unit_option: "Madrid"
  },
  {
    name: "Garantía",
    type: "TEXT",
    unit_option: "6 meses"
  },
  {
    name: "Certificación / Marcado CE",
    type: "BOOLEAN",
    unit_option: "Si/No"
  }
];
