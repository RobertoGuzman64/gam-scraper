import type { ProductRecord } from "../../contracts/catalog.js";

type ReviewedUnitDescriptionFact = {
  readonly field: string;
  readonly value: string;
  readonly excerpt: string;
};

type ReviewedUnitDescriptionClaim = {
  readonly providerId: ProductRecord["providerId"];
  readonly reference: string;
  readonly sourceUrl: string;
  readonly brand: ProductRecord["brand"];
  readonly model: ProductRecord["model"];
  readonly facts: readonly ReviewedUnitDescriptionFact[];
};

const reviewed: readonly ReviewedUnitDescriptionClaim[] = [
  {
    providerId: "gam", reference: "243", brand: "LOGITRANS", model: "HLI",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-logitrans/243-transpaleta-de-tijera-inoxidable-1500-kg-logitrans-hli",
    facts: [
      { field: "Ruedas de carga", value: "Tándem", excerpt: "ruedas de carga tándem" },
      { field: "Timón y bomba de pistones", value: "Acero inoxidable",
        excerpt: "La transpaleta tiene el timón, la bomba de pistones, los ejes y el anclaje inoxidables." }
    ]
  },
  {
    providerId: "gam", reference: "244", brand: "LOGITRANS", model: "HLI Plus",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-logitrans/244-transpaleta-de-tijera-inoxidable-1500-kg-logitrans-hli-plus",
    facts: [
      { field: "Timón y bomba de pistones", value: "Acero inoxidable",
        excerpt: "La transpaleta tiene el timón, la bomba de pistones, los ejes y el anclaje inoxidables." },
      { field: "Restantes componentes exteriores", value: "Recubrimiento cromado",
        excerpt: "El resto de piezas cuentan con recubrimiento cromado." }
    ]
  },
  {
    providerId: "gam", reference: "6806", brand: null, model: "P1.6",
    sourceUrl: "https://online.gamrentals.com/es/furgonetas-electricas-de-ocasion/6806-musoshi-pop-up-mini",
    facts: [
      { field: "Batería anunciada", value: "Litio extraíble", excerpt: "su batería de litio es extraíble" }
    ]
  },
  {
    providerId: "gam", reference: "4814", brand: "XCMG", model: "XT3207KH",
    sourceUrl: "https://online.gamrentals.com/es/xcmg-manipulacion/4814-manipulador-telescopico-xcmg-xt3207k",
    facts: [
      { field: "Tracción", value: "4×4", excerpt: "su sistema de tracción en las cuatro ruedas" },
      { field: "Capacidad a máxima altura de elevación", value: "3000 kg", excerpt: "A la altura máxima, el XT3207KH puede levantar hasta 3.000 kg" },
      { field: "Potencia nominal del motor", value: "90 kW", excerpt: "Está equipado con un motor de 90 kW" }
    ]
  },
  {
    providerId: "gam", reference: "4817", brand: "XCMG", model: "XT4014KH",
    sourceUrl: "https://online.gamrentals.com/es/xcmg-manipulacion/4817-manipulador-telescopico-xcmg-xt4014k",
    facts: [
      { field: "Potencia nominal del motor", value: "74 kW", excerpt: "Equipado con un motor diésel de 74 kW (99 HP), el XT4014KH" }
    ]
  },
  {
    providerId: "gam", reference: "6702", brand: "HYSTER", model: "H3.5FT",
    sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6702-2019-hyster-h35ft",
    facts: [
      { field: "Motorización", value: "GLP", excerpt: "Equipo propulsado por GLP (Gas Licuado del Petroleo)" }
    ]
  },
  {
    providerId: "gam", reference: "6723", brand: "TOYOTA", model: "LWE180",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6723-2019-toyota-lwe180-",
    facts: [
      { field: "Año", value: "2019", excerpt: "Fabricada en el año 2019" }
    ]
  },
  {
    providerId: "gam", reference: "4778", brand: "XCMG", model: "XGA16H",
    sourceUrl: "https://online.gamrentals.com/es/plataforma-articulada-hibrida-xcmg/4778-plataforma-articulada-hibrida-xcmg-xga16h",
    facts: [
      { field: "Alcance horizontal (m)", value: "8,22 m", excerpt: "alcance horizontal de 8,22 metros" },
      { field: "Altura de trabajo (m)", value: "16,3 m", excerpt: "altura máxima de trabajo de 16,3 metros" },
      { field: "Tracción 4x4", value: "true", excerpt: "sistema de tracción en las cuatro ruedas" }
    ]
  },
  {
    providerId: "gam", reference: "4792", brand: "XCMG", model: "XGS58E1",
    sourceUrl: "https://online.gamrentals.com/es/plataforma-telescopica-diesel-xcmg/4792-plataforma-telescopica-diesel-xcmg-xgs58e1",
    facts: [
      { field: "Alcance horizontal (m)", value: "24,8 m", excerpt: "alcance horizontal de 24,8 metros" },
      { field: "Potencia (kW)", value: "75 kW", excerpt: "motor Cummins F3.8 de 75 kW" }
    ]
  },
  {
    providerId: "gam", reference: "2159", brand: "BRAVI", model: "Lui 460",
    sourceUrl: "https://online.gamrentals.com/es/plataformas-elevadoras-bravi/2159-plataforma-elevadora-bravi-lui-460",
    facts: [
      { field: "Sensor de inclinación", value: "true", excerpt: "sensor de inclinación incorporado" }
    ]
  },
  {
    providerId: "gam", reference: "2237", brand: "YALE", model: "MO10L",
    sourceUrl: "https://online.gamrentals.com/es/recogepedidos-yale/2237-preparapedidos-2000-k-yale-mo10l",
    facts: [
      { field: "Dirección asistida", value: "true", excerpt: "sistema de dirección asistida" }
    ]
  },
  {
    providerId: "gam", reference: "2240", brand: "YALE", model: "MO25",
    sourceUrl: "https://online.gamrentals.com/es/recogepedidos-yale/2240-preparapedidos-2000-k-yale-mo25",
    facts: [
      { field: "Dirección asistida", value: "true", excerpt: "sistema de dirección asistida" }
    ]
  },
  {
    providerId: "gam", reference: "6186", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/cte/6186-plataforma-sobre-camion-articulado-cte-dz-24-auto-fib",
    facts: [
      { field: "Rotación de cesta", value: "90° a cada lado", excerpt: "la cesta de fibra cuenta con rotación hidráulica de 90° + 90°" },
      { field: "Número de estabilizadores hidráulicos", value: "4", excerpt: "sus 4 estabilizadores hidráulicos" },
      { field: "Masa máxima autorizada del vehículo", value: "3500 kg", excerpt: "montado sobre camión con PMA de 3.500 kg" }
    ]
  },
  {
    providerId: "gam", reference: "6187", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/cte/6187-plataforma-sobre-camion-telescopico-cte-b-lift-18-auto-fib",
    facts: [
      { field: "Rotación de cesta", value: "90° a cada lado", excerpt: "la cesta de fibra cuenta con rotación hidráulica de 90° + 90°" },
      { field: "Masa máxima autorizada del vehículo", value: "3500 kg", excerpt: "Montada sobre camión con PMA de 3.500 kg" }
    ]
  },
  {
    providerId: "gam", reference: "6190", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/cte/6190-plataforma-sobre-camion-telescopico-cte-b-lift-272-fib",
    facts: [
      { field: "Rotación de torreta", value: "640°", excerpt: "La rotación de la torreta de 640°" },
      { field: "Rotación de cesta", value: "90° a cada lado", excerpt: "Cuenta con rotación hidráulica de 90° + 90° y nivelación electrónica automática" },
      { field: "Número de estabilizadores", value: "4", excerpt: "4 estabilizadores extensibles o en posición fija" },
      { field: "Dimensiones de cesta", value: "1400 x 700 x 1100 mm", excerpt: "La cesta de trabajo de fibra, con dimensiones de 1,40 x 0,70 x 1,10 m" }
    ]
  },
  {
    providerId: "gam", reference: "6191", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/cte/6191-plataforma-sobre-camion-articulado-cte-zed-213-jhv-fib",
    facts: [
      { field: "Rotación de torreta", value: "±320°", excerpt: "La rotación de la torreta de ±320°" },
      { field: "Rotación de cesta", value: "90° a cada lado", excerpt: "Cuenta con rotación hidráulica de 90° + 90° y nivelación hidráulica" },
      { field: "Número de estabilizadores hidráulicos", value: "4", excerpt: "4 estabilizadores hidráulicos equipados con sensores de detección del suelo" }
    ]
  },
  {
    providerId: "gam", reference: "6192", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/cte/6192-plataforma-sobre-camion-articulado-cte-zed-233-jhv-fib",
    facts: [
      { field: "Rotación de torreta", value: "±320°", excerpt: "La rotación de la torreta de ±320°" },
      { field: "Rotación de cesta", value: "90° a cada lado", excerpt: "Cuenta con rotación hidráulica de 90° + 90° y nivelación automática" },
      { field: "Número de estabilizadores hidráulicos", value: "4", excerpt: "4 estabilizadores hidráulicos con sensores de presión al suelo" }
    ]
  },
  {
    providerId: "gam", reference: "4035", brand: "Tennant", model: "AP V-CAN-10",
    sourceUrl: "https://online.gamrentals.com/es/aspiradoras-industriales-nuevas/4035-ap-v-can-10",
    facts: [
      { field: "Longitud de cable de alimentación", value: "8 m", excerpt: "longitud de cable de alimentación de 8 metros" }
    ]
  },
  {
    providerId: "gam", reference: "4037", brand: "Tennant", model: "AP V-CAN-16",
    sourceUrl: "https://online.gamrentals.com/es/aspiradoras-industriales-nuevas/4037-ap-v-can-16",
    facts: [
      { field: "Longitud de cable de alimentación", value: "12 m", excerpt: "cable de alimentación de 12 metros" }
    ]
  },
  {
    providerId: "gam", reference: "4038", brand: "Tennant", model: "APL V-WD-27",
    sourceUrl: "https://online.gamrentals.com/es/tennant/4038-apl-v-wd-27",
    facts: [
      { field: "Longitud de cable de alimentación", value: "8,5 m", excerpt: "cable de alimentación de 8,5 metros" }
    ]
  },
  {
    providerId: "gam", reference: "4021", brand: null, model: "BF M20",
    sourceUrl: "https://online.gamrentals.com/es/fregadoras-industriales-nuevas/4021-bf-m20",
    facts: [
      { field: "Medida del cepillo principal", value: "1020 mm", excerpt: "cepillo principal de 1.020 mm" },
      { field: "Medida del cepillo lateral de fregado", value: "410 mm", excerpt: "cepillos laterales de 410 mm (fregado) y 530 mm (barrido)" },
      { field: "Medida del cepillo lateral de barrido", value: "530 mm", excerpt: "cepillos laterales de 410 mm (fregado) y 530 mm (barrido)" }
    ]
  },
  {
    providerId: "gam", reference: "4024", brand: "Tennant", model: "BCA S10",
    sourceUrl: "https://online.gamrentals.com/es/tennant/4024-bca-s10",
    facts: [
      { field: "Capacidad máxima de carga de la tolva", value: "70 kg", excerpt: "tolva de acero de gran capacidad, que puede contener hasta 80 litros o 70 kg de desechos" }
    ]
  },
  {
    providerId: "gam", reference: "4030", brand: "Tennant", model: "BCS S16L Descarga baja",
    sourceUrl: "https://online.gamrentals.com/es/barredoras-industriales-nuevas/4030-bcs-s16l-descarga-baja",
    facts: [
      { field: "Capacidad de la tolva", value: "150 l", excerpt: "Su tolva de 150 litros" }
    ]
  },
  {
    providerId: "gam", reference: "4015", brand: "Tennant", model: "FCS T17 D",
    sourceUrl: "https://online.gamrentals.com/es/tennant/4015-fcs-t17-d",
    facts: [
      { field: "Anchura máxima de fregado con cepillo lateral", value: "1320 mm", excerpt: "ancho de restregado de 1320 mm cuando se utiliza el cepillo lateral" },
      { field: "Presión máxima de fregado (kg)", value: "250", excerpt: "presión descendente de hasta 250 kg" }
    ]
  },
  {
    providerId: "gam", reference: "6953", brand: "CTE", model: "VJ12",
    sourceUrl: "https://online.gamrentals.com/es/cte/6953-plataforma-sobre-furgon-cte-vj12",
    facts: [
      { field: "Bomba eléctrica de emergencia", value: "12 V", excerpt: "bomba eléctrica de emergencia de 12 V" },
      { field: "Bomba manual de emergencia", value: "true", excerpt: "bomba manual de emergencia" }
    ]
  },
  {
    providerId: "gam", reference: "2139", brand: "HYSTER", model: "P2.2",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-hyster/2139-transpaleta-hyster-p22",
    facts: [
      { field: "Posición de conducción", value: "Operador a pie", excerpt: "configuración como equipo de operario a pie" },
      { field: "Tecnología del motor de tracción", value: "Corriente alterna", excerpt: "motor de tracción AC" }
    ]
  },
  {
    providerId: "gam", reference: "2141", brand: "HYSTER", model: "P2.5S",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-hyster/2141-transpaleta-hyster-p25s",
    facts: [
      { field: "Plataforma de operador", value: "Sí", excerpt: "esta carretilla transpaleta con plataforma" }
    ]
  },
  {
    providerId: "gam", reference: "2142", brand: "HYSTER", model: "P3.0S",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-hyster/2142-transpaleta-hyster-p30s",
    facts: [
      { field: "Plataforma de operador", value: "Abatible", excerpt: "Equipada con plataforma abatible y motor de tracción AC" },
      { field: "Tecnología del motor de tracción", value: "Corriente alterna", excerpt: "motor de tracción AC" }
    ]
  },
  {
    providerId: "gam", reference: "2179", brand: "HYSTER", model: "S1.6SIL",
    sourceUrl: "https://online.gamrentals.com/es/apiladores-hyster/2179-hyster-s16sil",
    facts: [
      { field: "Elevación inicial", value: "Sí", excerpt: "modelo más robusto con elevación inicial" },
      { field: "Tecnología del motor", value: "Corriente alterna", excerpt: "Su motor AC" }
    ]
  },
  {
    providerId: "gam", reference: "2332", brand: "YALE", model: "MO50T",
    sourceUrl: "https://online.gamrentals.com/es/tractores-arrastre-yale/2332-tracto-electrico-de-arrastre-yale-mo50t",
    facts: [
      { field: "Sistema de dirección", value: "Eléctrica", excerpt: "su sistema de dirección eléctrica" }
    ]
  },
  {
    providerId: "gam", reference: "2572", brand: null, model: "15K 36V",
    sourceUrl: "https://online.gamrentals.com/es/bts/2572-trailercaddy-15k-36v-br",
    facts: [
      { field: "Tipos de enganche compatibles", value: "Pasador, gancho o bola de quinta rueda", excerpt: "Funciona con pasador, gancho o bola de quinta rueda." }
    ]
  },
  {
    providerId: "gam", reference: "2573", brand: null, model: "15k 48v BR",
    sourceUrl: "https://online.gamrentals.com/es/bts/2573-trailercaddy-15k-48v-br",
    facts: [
      { field: "Tipos de enganche compatibles", value: "Pasador, gancho o bola de quinta rueda", excerpt: "Funciona con pasador, gancho o bola de quinta rueda." }
    ]
  },
  {
    providerId: "gam", reference: "4016", brand: "Tennant", model: "FCS T17 C",
    sourceUrl: "https://online.gamrentals.com/es/tennant/4016-fcs-t17-c",
    facts: [
      { field: "Alimentación", value: "Batería", excerpt: "un funcionamiento a batería" }
    ]
  },
  {
    providerId: "gam", reference: "4031", brand: "Tennant", model: "BCS S20 Batería",
    sourceUrl: "https://online.gamrentals.com/es/barredoras-industriales-nuevas/4031-bcs-s20-bateria",
    facts: [
      { field: "Sistema de filtración de polvo", value: "SweepMax, 3 etapas", excerpt: "sistema de control de polvo SweepMax, que utiliza una tecnología de filtración de tres etapas" }
    ]
  },
  {
    providerId: "gam", reference: "4032", brand: "Tennant", model: "BCS S20 Diesel/LPG",
    sourceUrl: "https://online.gamrentals.com/es/barredoras-industriales-nuevas/4032-bcs-s20-diesellpg",
    facts: [
      { field: "Sistema de filtración de polvo", value: "SweepMax, 3 etapas", excerpt: "El sistema de control de polvo SweepMax de tres etapas" },
      { field: "Potencia según motorización disponible", value: "Diésel: 26 hp; GLP: 32,5 hp", excerpt: "El motor diésel de 26 hp y el LPG de 32,5 hp" }
    ]
  },
  {
    providerId: "gam", reference: "4661", brand: "CTE", model: "ZED 21.3 JHV",
    sourceUrl: "https://online.gamrentals.com/es/cte/4661-plataforma-sobre-camion-zed-213-jhv",
    facts: [
      { field: "Masa máxima autorizada del vehículo", value: "3500 kg", excerpt: "camión de MMA 3.500 kg" },
      { field: "Sistema de estabilización", value: "S3 EVO", excerpt: "sistema S3 Smart Stability System EVO" }
    ]
  },
  {
    providerId: "gam", reference: "4662", brand: "CTE", model: "ZED 25 HV",
    sourceUrl: "https://online.gamrentals.com/es/cte/4662-plataforma-sobre-camion-zed-25-hv",
    facts: [
      { field: "Número de extensiones telescópicas", value: "2", excerpt: "brazo telescópico de dos extensiones" },
      { field: "Sistema de estabilización", value: "S3 EVO, variable", excerpt: "La estabilización variable mediante el sistema S3 EVO" }
    ]
  },
  {
    providerId: "gam", reference: "6364", brand: "YALE", model: "MO70TR",
    sourceUrl: "https://online.gamrentals.com/es/yale/6364-mo70t",
    facts: [
      { field: "Esfuerzo nominal en barra de tracción", value: "1336 N", excerpt: "esfuerzo nominal en la barra de tracción de 1.336 N" },
      { field: "Altura de acoplamiento", value: "365 mm", excerpt: "altura de acoplamiento de 365 mm" },
      { field: "Potencia del motor de tracción (S2 60 min)", value: "3 kW", excerpt: "motor de tracción de 3 kW (S2 60 min)" },
      { field: "Freno de servicio", value: "Electromagnético", excerpt: "freno de servicio electromagnético" },
      { field: "Anchura (mm)", value: "796 mm", excerpt: "anchura total de 796 mm" },
      { field: "Pendiente máxima con/sin carga", value: "3 % / 20 %", excerpt: "trepabilidad máxima se indica en 3% con carga y 20% sin carga" }
    ]
  },
  {
    providerId: "gam", reference: "6423", brand: null, model: "J3.0UTL",
    sourceUrl: "https://online.gamrentals.com/es/marcas/6423-carretilla-elevadora-electrica-hyster-j30utl",
    facts: [
      { field: "Centro de carga (mm)", value: "500 mm", excerpt: "capacidad nominal de 3.000 kg con centro de carga de 500 mm" },
      { field: "Potencia del motor de tracción", value: "11,5 kW", excerpt: "motor de tracción de 11,5 kW" },
      { field: "Potencia del motor de elevación", value: "15 kW", excerpt: "motor de elevación de 15,0 kW" },
      { field: "Peso de servicio", value: "4910 kg", excerpt: "Su peso de servicio es 4.910 kg" },
      { field: "Velocidad de desplazamiento con/sin carga (km/h)", value: "15 / 16 km/h", excerpt: "15,0 km/h con carga y 16,0 km/h sin carga" },
      { field: "Tensión nominal de batería", value: "77,6 V", excerpt: "La batería de litio integrada trabaja en 77,6 V" }
    ]
  },
  {
    providerId: "gam", reference: "6746", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/yale/6746-preparapedidos-yale-mo10e",
    facts: [
      { field: "Potencia del motor de tracción anunciada", value: "4 kW", excerpt: "motor de tracción de 4 kW y un motor de elevación de 3 kW en las configuraciones recogidas en la ficha técnica de Yale" },
      { field: "Potencia del motor de elevación anunciada", value: "3 kW", excerpt: "motor de tracción de 4 kW y un motor de elevación de 3 kW en las configuraciones recogidas en la ficha técnica de Yale" },
      { field: "Capacidades de batería disponibles", value: "24 V / 620 Ah o 560 Ah", excerpt: "La batería de la gama es de 24 V / 620 Ah, con una opción disponible de 24 V / 560 Ah, según la configuración elegida" },
      { field: "Freno de servicio", value: "Electromagnético", excerpt: "El freno de servicio electromagnético" }
    ]
  },
  {
    providerId: "gam", reference: "73", brand: "HYSTER", model: "T8.0HS4",
    sourceUrl: "https://online.gamrentals.com/es/tractor-de-remolcado-conductor-sentado-8000-kg/73-tractor-de-arrastre-de-conductor-a-bordo-hyster-t80hs4",
    facts: [
      { field: "Posición de conducción", value: "Conductor a bordo", excerpt: "Tractores de Arrastre de conductor a bordo de Hyster" }
    ]
  },
  {
    providerId: "gam", reference: "1136", brand: "YALE", model: "MSC10",
    sourceUrl: "https://online.gamrentals.com/es/apiladores-yale/1136-apilador-de-operario-a-pie-de-elevacion-a-gran-altura-compacto-y-agil-yale-msc10",
    facts: [
      { field: "Posición de conducción", value: "Operador a pie", excerpt: "apiladores de operario a pie" }
    ]
  },
  {
    providerId: "gam", reference: "2110", brand: "HYSTER", model: "C1.0",
    sourceUrl: "https://online.gamrentals.com/es/carretillas-trilaterales-hyster/2110-carretilla-para-pasillos-estrechos-hyster-c10",
    facts: [
      { field: "Tipo Mástil", value: "Cuadriforme", excerpt: "El mástil cuadriforme exclusivo de la carretilla trilateral C1.0 de Hyster" }
    ]
  },
  {
    providerId: "gam", reference: "2738", brand: null, model: "TT30K",
    sourceUrl: "https://online.gamrentals.com/es/bts/2738-trailercaddy-terminal-tractor",
    facts: [
      { field: "Tipos de enganche compatibles", value: "Pasador, gancho o bola de quinta rueda", excerpt: "Funciona con pasador, gancho o bola de quinta rueda." }
    ]
  },
  {
    providerId: "gam", reference: "3034", brand: "YALE", model: "PLHP25",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-yale/3034-transpaleta-manual-yale-plhp25",
    facts: [
      { field: "Accionamiento", value: "Manual", excerpt: "La Transpaleta manual Yale PLHP25" }
    ]
  },
  {
    providerId: "gam", reference: "4018", brand: "Tennant", model: "T20",
    sourceUrl: "https://online.gamrentals.com/es/tennant/4018-fcs-t20-c",
    facts: [
      { field: "Capacidad de bandeja de residuos", value: "31 L", excerpt: "una bandeja de residuos de 31 litros" },
      { field: "Anchura máxima de fregado con escobilla lateral", value: "1370 mm", excerpt: "un ancho de fregado que puede llegar hasta los 1370 mm con la escobilla lateral" }
    ]
  },
  {
    providerId: "gam", reference: "4717", brand: "CTE", model: "ZED 20.4 HN",
    sourceUrl: "https://online.gamrentals.com/es/cte/4717-plataforma-sobre-camion-articulada-cte-zed-204-hn",
    facts: [
      { field: "Sistema de estabilización", value: "HN (High Narrow)", excerpt: "La estabilización HN (High Narrow)" },
      { field: "Número de extensiones telescópicas", value: "1", excerpt: "brazo telescópico de una extensión" }
    ]
  },
  {
    providerId: "gam", reference: "4819", brand: "XCMG", model: "XT4018KH",
    sourceUrl: "https://online.gamrentals.com/es/xcmg-manipulacion/4819-manipulador-telescopico-xcmg",
    facts: [
      { field: "Modelo de motor", value: "Cummins QSF3.8", excerpt: "Está equipado con un motor Cummins QSF3.8 de 74 kW (99 HP)" },
      { field: "Potencia nominal del motor", value: "74 kW", excerpt: "Está equipado con un motor Cummins QSF3.8 de 74 kW (99 HP)" }
    ]
  },
  {
    providerId: "gam", reference: "6189", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/cte/6189-plataforma-sobre-camion-telescopico-cte-mp-24-c-fib",
    facts: [
      { field: "Rotación de torreta", value: "±300°", excerpt: "La rotación de la torreta de ±300°" },
      { field: "Rotación de cesta", value: "90° a cada lado", excerpt: "rotación hidráulica de 90° a derecha e izquierda" },
      { field: "Material de cesta", value: "Fibra", excerpt: "cesta de trabajo de fibra" },
      { field: "Número de estabilizadores", value: "4", excerpt: "4 estabilizadores hidráulicos" },
      { field: "Sistema de estabilización", value: "S3 EVO, variable", excerpt: "control de estabilización variable" }
    ]
  },
  {
    providerId: "gam", reference: "6308", brand: "CTE", model: "AZ16 PICKUP",
    sourceUrl: "https://online.gamrentals.com/es/cte/6308-plataforma-sobre-camion-articulada-cte-az16-pickup",
    facts: [
      { field: "Alcance horizontal (m)", value: "7,30 m", excerpt: "un alcance lateral máximo de 7,30 m" },
      { field: "Altura de plataforma", value: "13,50 m", excerpt: "una altura de cesta de 13,50 m" },
      { field: "Rotación de torreta", value: "700°", excerpt: "la rotación de torre de 700°" },
      { field: "Rotación de cesta", value: "90° a cada lado", excerpt: "la rotación de cesta de 90° + 90°" }
    ]
  },
  {
    providerId: "gam", reference: "6805", brand: null, model: null,
    sourceUrl: "https://online.gamrentals.com/es/ciclomotores-electricos-segunda-mano/6805-lvneng-lx05",
    facts: [
      { field: "Batería extraíble", value: "Sí", excerpt: "las baterías son de litio y extraíbles." },
      { field: "Marca del motor", value: "Bosch", excerpt: "Con un motor Bosch de alta eficiencia" },
      { field: "Modos de conducción", value: "Eco y Sport", excerpt: "modos de conducción Eco y Sport" }
    ]
  }
];

export const reviewedUnitDescriptionEvidence = (
  original: ProductRecord, field: string, value: string
): { readonly scope: "unit"; readonly sourceField: "longDescription"; readonly sourceValue: string } | null => {
  const description = original.longDescription;
  if (!description) return null;
  const matching = reviewed.filter((claim) => claim.providerId === original.providerId &&
    claim.reference === original.reference && claim.sourceUrl === original.url &&
    claim.brand === original.brand && claim.model === original.model).flatMap((claim) =>
    claim.facts.filter((fact) => fact.field === field && fact.value === value &&
      description.includes(fact.excerpt)));
  if (matching.length > 1) throw new Error("Evidencia original duplicada");
  return matching.length === 1 ? { scope: "unit", sourceField: "longDescription", sourceValue: description } : null;
};
