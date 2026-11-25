import type { Attribute } from "../classification/attribute-types.js";

export const energyTechnicalFields: readonly Attribute[] = [
  {
    name: "Potencia",
    type: "NUMBER",
    unit_option: "kVA (grupos) / kW"
  },
  {
    name: "Combustible",
    type: "SELECT",
    unit_option: "Diésel / Gasolina / Eléctrico / GLP"
  },
  {
    name: "Voltaje / Fases",
    type: "SELECT",
    unit_option: "230V mono / 400V trifásico"
  },
  {
    name: "Capacidad del depósito",
    type: "NUMBER",
    unit_option: "l"
  },
  {
    name: "Autonomía a 75% carga",
    type: "NUMBER",
    unit_option: "h"
  },
  {
    name: "Nivel sonoro",
    type: "NUMBER",
    unit_option: "dB(A) a 7 m"
  },
  {
    name: "Insonorizado",
    type: "BOOLEAN",
    unit_option: "Si/No"
  },
  {
    name: "Caudal de aire",
    type: "NUMBER",
    unit_option: "l/min o m³/min"
  },
  {
    name: "Presión de trabajo",
    type: "NUMBER",
    unit_option: "bar"
  },
  {
    name: "Altura del mástil",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Nº y tipo de focos",
    type: "TEXT",
    unit_option: "uds. LED / halógenos"
  },
  {
    name: "Potencia frigorífica",
    type: "NUMBER",
    unit_option: "kW / frigorías"
  },
  {
    name: "Caudal de aire tratado",
    type: "NUMBER",
    unit_option: "m³/h"
  }
];
