import type { Attribute } from "../classification/attribute-types.js";

export const mobilityTechnicalFields: readonly Attribute[] = [
  {
    name: "Autonomía",
    type: "NUMBER",
    unit_option: "km"
  },
  {
    name: "Velocidad máxima",
    type: "NUMBER",
    unit_option: "km/h"
  },
  {
    name: "Batería",
    type: "TEXT",
    unit_option: "kWh / V-Ah"
  },
  {
    name: "Tiempo de carga",
    type: "TEXT",
    unit_option: "h (tipo de cargador)"
  },
  {
    name: "Capacidad de carga útil",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Volumen de carga",
    type: "NUMBER",
    unit_option: "m³"
  },
  {
    name: "Kilometraje",
    type: "NUMBER",
    unit_option: "km"
  },
  {
    name: "Nº de plazas",
    type: "NUMBER",
    unit_option: "uds."
  },
  {
    name: "Homologación / Permiso",
    type: "SELECT",
    unit_option: "AM / A1 / B / Sin permiso (bicis)"
  },
  {
    name: "ITV en vigor",
    type: "BOOLEAN",
    unit_option: "Si/No"
  }
];
