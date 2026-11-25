import type { Attribute } from "../classification/attribute-types.js";

export const liftingTechnicalFields: readonly Attribute[] = [
  {
    name: "Altura de trabajo",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Altura de plataforma",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Alcance horizontal",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Capacidad de la cesta",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Nº de personas en cesta",
    type: "NUMBER",
    unit_option: "1,2,3"
  },
  {
    name: "Dimensiones de la cesta",
    type: "TEXT",
    unit_option: "m"
  },
  {
    name: "Extensión de plataforma",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Rotación de torreta",
    type: "NUMBER",
    unit_option: "grados"
  },
  {
    name: "Tipo de tracción",
    type: "SELECT",
    unit_option: "Ruedas / Orugas / Sobre camión / Empuje manual"
  },
  {
    name: "Uso interior/exterior",
    type: "SELECT",
    unit_option: "Interior / Exterior / Ambos"
  },
  {
    name: "Pendiente superable",
    type: "NUMBER",
    unit_option: "%"
  },
  {
    name: "Neumáticos",
    type: "SELECT",
    unit_option: "Macizos / No marcantes / Todoterreno"
  }
];
