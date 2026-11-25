import type { Attribute } from "../classification/attribute-types.js";

export const handlingTechnicalFields: readonly Attribute[] = [
  {
    name: "Capacidad de carga",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Centro de carga",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Altura de elevación",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Tipo de mástil",
    type: "SELECT",
    unit_option: "Simple / Dúplex / Tríplex / Cuádruplex"
  },
  {
    name: "Altura mástil replegado",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Elevación libre",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Longitud de horquillas",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Radio de giro",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Ancho de pasillo mínimo",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Batería (V / Ah)",
    type: "TEXT",
    unit_option: "V / Ah"
  },
  {
    name: "Potencia del motor",
    type: "NUMBER",
    unit_option: "kW"
  },
  {
    name: "Neumáticos",
    type: "SELECT",
    unit_option: "Macizos / Superelásticos / Neumáticos"
  },
  {
    name: "Posición del operario",
    type: "SELECT",
    unit_option: "Sentado / De pie / Acompañante"
  },
  {
    name: "Cabina",
    type: "SELECT",
    unit_option: "Abierta / Cerrada / Techo protector"
  },
  {
    name: "Implementos incluidos",
    type: "SELECT",
    unit_option: "Desplazador lateral / Posicionador / Pinza / Ninguno"
  },
  {
    name: "Ancho total / entre horquillas",
    type: "NUMBER",
    unit_option: "mm"
  },
  {
    name: "Autonomía",
    type: "NUMBER",
    unit_option: "h"
  },
  {
    name: "Capacidad de arrastre",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Posición del operario",
    type: "SELECT",
    unit_option: "Acompañante / Plataforma / Sentado"
  },
  {
    name: "Capacidad máxima",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Altura máxima de elevación",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Alcance máximo horizontal",
    type: "NUMBER",
    unit_option: "m"
  },
  {
    name: "Capacidad a máxima altura",
    type: "NUMBER",
    unit_option: "kg"
  },
  {
    name: "Estabilizadores",
    type: "BOOLEAN",
    unit_option: "Si/No"
  },
  {
    name: "Tipo",
    type: "SELECT",
    unit_option: "Fijo / Rotativo"
  },
  {
    name: "Implementos incluidos",
    type: "SELECT",
    unit_option: "Horquillas / Cazo / Cabrestante / Plataforma / Plumín"
  }
];
