import type { Attribute } from "../classification/attribute-types.js";

export const cleaningTechnicalFields: readonly Attribute[] = [
  {
    name: "Tipo de conductor",
    type: "SELECT",
    unit_option: "Hombre a pie / Hombre a bordo"
  },
  {
    name: "Ancho de trabajo",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Rendimiento teórico",
    type: "NUMBER",
    unit_option: "m²/h"
  },
  {
    name: "Depósito de solución",
    type: "NUMBER",
    unit_option: "l"
  },
  {
    name: "Depósito de recuperación",
    type: "NUMBER",
    unit_option: "l"
  },
  {
    name: "Capacidad de la tolva",
    type: "NUMBER",
    unit_option: "l"
  },
  {
    name: "Alimentación",
    type: "SELECT",
    unit_option: "Batería / Cable / Diésel / GLP"
  },
  {
    name: "Potencia de aspiración",
    type: "NUMBER",
    unit_option: "kW"
  }
];
