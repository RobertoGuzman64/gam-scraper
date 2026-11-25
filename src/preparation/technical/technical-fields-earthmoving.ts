import type { Attribute } from "../classification/attribute-types.js";

export const earthmovingTechnicalFields: readonly Attribute[] = [
  {
    name: "Peso operativo",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Potencia del motor",
    type: "NUMBER",
    unit_option: "kW / CV"
  },
  {
    name: "Profundidad de excavación",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Alcance máximo",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Capacidad del cazo",
    type: "NUMBER",
    unit_option: "m³ / l"
  },
  {
    name: "Capacidad de la tolva",
    type: "NUMBER",
    unit_option: "kg / l"
  },
  {
    name: "Ancho del tambor",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Fuerza centrífuga",
    type: "NUMBER",
    unit_option: "kN"
  },
  {
    name: "Momento de carga",
    type: "NUMBER",
    unit_option: "t·m"
  },
  {
    name: "Tipo de tracción",
    type: "SELECT",
    unit_option: "Orugas / Ruedas"
  },
  {
    name: "Ancho de la máquina",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Cabina",
    type: "SELECT",
    unit_option: "Abierta / Cerrada / ROPS"
  },
  {
    name: "Enganche / compatibilidad",
    type: "TEXT",
    unit_option: "Tipo de acople"
  }
];
