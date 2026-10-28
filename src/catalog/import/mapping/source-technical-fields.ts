import type { Attribute } from "./attribute-types.js";

export const SOURCE_TECHNICAL_FIELDS: readonly Attribute[] = [
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
