import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { verifyGamEditorialEvidence, type EditorialEvidence } from "./verified-condensed-general.js";

const evidence: Readonly<Record<string, EditorialEvidence>> = {
  "4011": {
    "url": "https://online.gamrentals.com/es/tennant/4011-fcs-t12-c80",
    "title": "Fregadora TENNANT FCS T12 C80",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T12 C80",
    "sourceHash": "cbfb594661ac77922f466ddb4023f320e4a240d4de43971e7bdc697da0debf9a",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T12 C80",
      "Peso": "470 KG",
      "Anchura trabajo": "0,8 metros",
      "RPM cepillo": "300"
    },
    "originalShort": "➨ TENNANT FCS T12 C80 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCS T12 C80 es una fregadora industrial de conductor sentado alimentada por baterías, destinada a limpiar pavimentos en almacenes y recintos de grandes dimensiones. La ficha estructurada indica 0,8 m de anchura de trabajo y 470 kg de peso. El texto de origen describe cepillos cilíndricos o de disco como alternativas de fregado, depósitos de 132 litros de solución y 166 litros de recuperación y un radio de giro de 1.854 mm. Debe comprobarse el cabezal instalado antes de atribuirle una velocidad específica.",
    "revisedShort": "Fregadora Tennant FCS T12 C80 de conductor sentado y 0,8 m de anchura de trabajo."
  },
  "4010": {
    "url": "https://online.gamrentals.com/es/tennant/4010-fcs-t12-d80",
    "title": "Fregadora TENNANT FCS T12 D80| Fregadora industrial | GAM Online",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T12 D80",
    "sourceHash": "d300dffedfd391f17aa8db5bee897fba020ebe6773031e326d1995bcd93f1f6b",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T12 D80",
      "Peso": "700 KG",
      "Anchura trabajo": "0,8 metros",
      "RPM cepillo": "200"
    },
    "originalShort": "➨ TENNANT FCS T12 D80 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCS T12 D80 es una fregadora industrial de conductor sentado y alimentación por batería, preparada para la limpieza de suelos en grandes instalaciones. Su ficha recoge 0,8 m de anchura de trabajo y 700 kg de peso. La descripción de origen anuncia depósitos de 132 litros para solución y 166 litros para recuperación, además de una alternativa entre cepillos cilíndricos y de disco. Las velocidades de cepillo citadas en el texto comercial corresponden a configuraciones y no se asignan a esta unidad sin identificar el cabezal.",
    "revisedShort": "Fregadora Tennant FCS T12 D80 de conductor sentado y 0,8 m de anchura de trabajo."
  },
  "4024": {
    "url": "https://online.gamrentals.com/es/tennant/4024-bca-s10",
    "title": "Barredora industrial BCA S10",
    "categoryKey": "limpieza-barredoras",
    "brand": "Tennant",
    "model": "BCA S10",
    "sourceHash": "a8f8e7efc2e331ca9d52bdf4c4d6793a4bd9bf8992f879889a3df5b7bcd52421",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "BCA S10",
      "Anchura trabajo": "0,85 metros"
    },
    "originalShort": "La Barredora industrial TENNANT BCA S10 es una opción potente y eficiente para la limpieza de espacios industriales y comerciales. Con un ancho de barrido de 86 cm y una capacidad de tolva de 80 litros que puede contener hasta 70 kg de desechos, esta barredora permite una limpieza prolongada sin interrupciones. Su sistema de control de polvo avanzado captura partículas hasta de 3 micrones, protegiendo tanto a los operarios como a las instalaciones de polvo potencialmente peligroso. Además, el diseño ergonóm",
    "general": "El modelo Tennant BCA S10 es una barredora industrial de conductor acompañante para la recogida de polvo y residuos en espacios de trabajo y áreas de circulación. El catálogo indica 0,85 m de anchura de trabajo. La descripción detalla una tolva de hasta 80 litros o 70 kg de residuos, un filtro de 4,9 m² con sacudidor y control de polvo. También menciona alimentación por baterías de 24 V y autonomía de hasta tres horas, condicionada al estado y uso del equipo. Conviene comprobar la superficie y el tipo de residuo.",
    "revisedShort": "Barredora Tennant BCA S10 con tolva de 80 litros y anchura de trabajo de 0,85 m."
  },
  "4002": {
    "url": "https://online.gamrentals.com/es/tennant/4002-fca-t500e-d80",
    "title": "Fregadora TENNANT FCA T500e D80",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA T500e D80",
    "sourceHash": "c64c3f4d87e4724f7ffaeea93c4df36808c1b734bd44c16ae640fdbdb646ddd6",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA T500e D80",
      "Peso": "300 KG",
      "Anchura trabajo": "1,23 metros",
      "RPM cepillo": "220"
    },
    "originalShort": "➨ TENNANT FCA T500e D80 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCA T500e D80 es una fregadora industrial de conductor acompañante para limpieza de pavimentos en almacenes y espacios interiores de gran superficie. El texto original distingue cabezales de disco, cilíndrico y orbital, y recoge una franja de fregado de 650 a 800 mm según configuración. Los depósitos tienen 85 litros de solución y 102 litros de recuperación. La ficha registra 300 kg de peso y 220 rpm de cepillo. Sus 1,23 m de anchura de trabajo tabulada no deben confundirse automáticamente con la franja de fregado descrita.",
    "revisedShort": "Fregadora Tennant FCA T500e D80 de conductor acompañante, 300 kg y depósitos de 85/102 litros."
  },
  "4001": {
    "url": "https://online.gamrentals.com/es/tennant/4001-fca-t500e-d70",
    "title": "Fregadora TENNANT FCA T500e D70",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA T500e D70",
    "sourceHash": "9e0e002f830a6f1e1096dcd5368058ae34309d215c7caac6c549e87d5ec71154",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA T500e D70",
      "Peso": "281 KG",
      "Anchura trabajo": "1,1 metros",
      "RPM cepillo": "220"
    },
    "originalShort": "➨ TENNANT FCA T500e D70 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCA T500e D70 es una fregadora industrial de conductor acompañante para la limpieza periódica de suelos de almacenes, centros comerciales y áreas de producción. El proveedor describe cabezales alternativos de disco, cilíndrico y orbital. Indica 85 litros de solución y 102 litros de recuperación, así como alimentación por batería y hasta 4,3 horas de funcionamiento según condiciones. Su ficha recoge 281 kg de peso y 220 rpm. Es necesario comprobar el cabezal realmente instalado antes de utilizar cifras correspondientes a otra configuración.",
    "revisedShort": "Fregadora Tennant FCA T500e D70 con depósitos de 85/102 litros y peso de 281 kg."
  },
  "4003": {
    "url": "https://online.gamrentals.com/es/fregadoras-industriales-nuevas/4003-fca-t600e-d70",
    "title": "Fregadora TENNANT FCA T600e D70",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA T600e D70",
    "sourceHash": "fb596ec2f20c1b9a97cc8a13e7621de00c2b63dae6a20f5dc968dcb8b3b1ed92",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA T600e D70",
      "Peso": "487 KG",
      "Anchura trabajo": "0,9 metros",
      "RPM cepillo": "300"
    },
    "originalShort": "➨ TENNANT FCA T600e D70 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCA T600e D70 es una fregadora industrial eléctrica de conductor acompañante para el mantenimiento de grandes superficies interiores. El texto de origen describe cabezales de disco con tres niveles de presión, productividad teórica de hasta 4.415 m²/h y depósito de solución de 121 litros y recuperación de 140 litros. La tecnología ec-H2O NanoClean se ofrece como opción, no como equipamiento garantizado. La ficha indica 487 kg de peso y 300 rpm de cepillo; conviene contrastar la configuración de fregado escogida.",
    "revisedShort": "Fregadora Tennant FCA T600e D70 de conductor acompañante y depósitos de 121/140 litros."
  },
  "4004": {
    "url": "https://online.gamrentals.com/es/fregadoras-industriales-nuevas/4004-fca-t600e-d80",
    "title": "Fregadora TENNANT FCA T600e D80",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA T600e D80",
    "sourceHash": "4d3465dbd3e2c895195e11dac2cbb3efbcc83ab8066711ba6d5470ab61b57bfe",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA T600e D80",
      "Peso": "490 KG",
      "Anchura trabajo": "1,1 metros",
      "RPM cepillo": "300"
    },
    "originalShort": "➨ TENNANT FCA T600e D80 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCA T600e D80 es una fregadora industrial eléctrica de conductor acompañante destinada a recorridos de limpieza en naves y centros comerciales. La descripción comercial menciona fregado con disco a 300 rpm, distintos niveles de presión descendente y depósitos de 121 litros para solución y 140 litros para recuperación. La tecnología ec-H2O NanoClean es opcional y debe verificarse su presencia en la unidad. La ficha indica 490 kg de peso; los valores de anchura anunciados deben distinguir la bayeta del ancho real del cabezal.",
    "revisedShort": "Fregadora Tennant FCA T600e D80 de 490 kg y depósitos de 121/140 litros."
  },
  "4022": {
    "url": "https://online.gamrentals.com/es/tennant/4022-bf-m30",
    "title": "Barredora fregadora TENNANT BF M30",
    "categoryKey": "limpieza-barredoras",
    "brand": "Tennant",
    "model": "BF M30",
    "sourceHash": "9487ede63a8c89d0d7f1209f7d93596315cd7ed3f3da15e7ed9731b9aef27863",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "BF M30"
    },
    "originalShort": "La barredora fregadora TENNANT BF M30 es una máquina de conductor sentado diseñada para la limpieza eficiente de grandes superficies en entornos industriales y comerciales, tanto en interiores como en exteriores. Con una cobertura de hasta 20.160 m² por hora en modo de barrido y hasta 9.490 m² por hora en modo de fregado, esta máquina es ideal para fábricas, almacenes y estacionamientos. Equipado con un cepillo principal de 1.220 mm y cepillos laterales de 410 mm (fregado) y 533 mm (barrido), la M30 asegura",
    "general": "El modelo Tennant BF M30 es un equipo combinado de barrido y fregado de conductor sentado para la limpieza de superficies industriales extensas. La ficha de origen anuncia un depósito de solución de 410 litros, recuperación de 360 litros y tolva de 198 litros. Describe una capacidad teórica de hasta 20.160 m²/h para barrido y 9.490 m²/h para fregado, cifras sujetas a condiciones de uso. El barrido utiliza un cepillo principal de 1.220 mm y cepillos laterales de 410 mm para fregado y 533 mm para barrido. El texto contempla alternativas de motorización diésel, gasolina y GLP, sin confirmar una concreta para esta referencia.",
    "revisedShort": "Barredora fregadora Tennant BF M30 de conductor sentado, con tolva de 198 litros."
  },
  "4012": {
    "url": "https://online.gamrentals.com/es/tennant/4012-fcs-t1581-d",
    "title": "Fregadora TENNANT FCS T1581 D",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T1581 D",
    "sourceHash": "a8151e1074e10595baaac402c0b1fd182619e7bada76dbfcaa52b439984e40b2",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T1581 D"
    },
    "originalShort": "La fregadora TENNANT FCS T1581 D es una potente máquina de conductor sentado diseñada para la limpieza de grandes superficies industriales y comerciales. Con una cobertura de hasta 7.085 m² por hora y opciones de cabezales de disco o cilíndrico, esta fregadora garantiza una limpieza eficiente y profunda. Su depósito de solución tiene una capacidad de 218 litros, y el depósito de recuperación, 237 litros, permitiendo largas jornadas de trabajo sin interrupciones. Equipado con un cabezal de disco que opera a",
    "general": "El modelo Tennant FCS T1581 D es una fregadora industrial de conductor sentado para el mantenimiento de pavimentos de almacenes, fábricas y otras superficies extensas. El proveedor ofrece cabezal de disco o cilíndrico como configuraciones diferentes, con trayectorias de 1.049 mm y 984 mm respectivamente. La productividad teórica anunciada es de hasta 7.085 m²/h. Indica depósitos de solución de 218 litros y recuperación de 237 litros, con autonomía variable según el tipo de batería. Las velocidades y presiones del cepillo deben leerse para el cabezal escogido, sin combinar prestaciones de alternativas distintas.",
    "revisedShort": "Fregadora Tennant FCS T1581 D de conductor sentado y depósitos de 218/237 litros."
  },
  "3996": {
    "url": "https://online.gamrentals.com/es/tennant/3996-fca-cs16",
    "title": "Microfregadora TENNANT FCA CS16",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA CS16",
    "sourceHash": "8c3afe93f8fc108e89fe82d5a63ccf3965a3c7967791eed502b01e3720a722bd",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA CS16",
      "Peso": "36 KG",
      "Anchura trabajo": "0,35 metros",
      "RPM cepillo": "140"
    },
    "originalShort": "➨ TENNANT FCA CS16 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCA CS16 es una microfregadora eléctrica de conductor acompañante para suelos duros de oficinas, pequeños comercios y pasillos interiores. La ficha declara 36 kg de peso, 0,35 m de anchura de trabajo y cepillo a 140 rpm. La descripción de origen añade depósitos de 15 litros de solución y 16,5 litros de recuperación, manillar plegable y autonomía de hasta 60 minutos con batería estándar, o 70 minutos en modo Eco. Es un equipo para zonas reducidas, no para trasladar residuos voluminosos.",
    "revisedShort": "Microfregadora Tennant FCA CS16 de 0,35 m de trabajo y depósitos de 15/16,5 litros."
  },
  "4005": {
    "url": "https://online.gamrentals.com/es/fregadoras-industriales-nuevas/4005-fcs-t581-70",
    "title": "Fregadora TENNANT FCS T581 70",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T581 70",
    "sourceHash": "ed8eecd47bc1ae7f2edac9d187d790752105b58c1e89ce4e8fa7dd2a343021a9",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T581 70",
      "Peso": "212 KG",
      "Anchura trabajo": "0,55 metros",
      "RPM cepillo": "150"
    },
    "originalShort": "➨ TENNANT FCS T581 70 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCS T581 70 es una fregadora industrial de conductor sentado alimentada por batería para limpiar recorridos amplios con maniobras frecuentes. La descripción comercial recoge depósitos de solución de 78,5 litros y recuperación de 80 litros, además de una autonomía orientativa de hasta 4,5 horas. La ficha estructurada declara 212 kg y una anchura de trabajo de 0,55 m. El texto menciona diferentes cabezales y cifras de rpm no coincidentes con la ficha; se evita adjudicar una velocidad hasta comprobar la configuración.",
    "revisedShort": "Fregadora Tennant FCS T581 70 de conductor sentado y depósitos de 78,5/80 litros."
  },
  "4039": {
    "url": "https://online.gamrentals.com/es/tennant/4039-apl-v-wd-62",
    "title": "Aspiradora TENNANT APL V-WD-62",
    "categoryKey": "marcas-nuevas",
    "brand": "Tennant",
    "model": "APL V-WD-62",
    "sourceHash": "1e0ffa593e35a104b7fb4bc2b45af93d828e83c54a251cd4add47c275c50b777",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "APL V-WD-62"
    },
    "originalShort": "La aspiradora TENNANT APL V-WD-62 es una potente máquina diseñada para la recolección de polvo y líquidos en entornos industriales y comerciales. Con un peso de 18,5 kg y un nivel acústico de solo 74 dBA, esta aspiradora es ideal para espacios grandes que requieren una limpieza rápida y eficiente, como almacenes, fábricas y centros comerciales. Su capacidad para gestionar tanto polvo como líquidos la convierte en una opción versátil para una amplia variedad de aplicaciones. Con un cable de alimentación de 8",
    "general": "El modelo Tennant APL V-WD-62 es una aspiradora industrial para recogida de polvo y líquidos durante tareas de limpieza de talleres y almacenes. El proveedor indica 18,5 kg de peso y 74 dBA de nivel sonoro, así como un cable de alimentación de 8,5 m. Las medidas citadas son 565 mm de anchura, 690 mm de longitud y 920 mm de altura. Su uso para residuos secos o húmedos exige preparar el equipo según las instrucciones de aspiración correspondientes. La ficha técnica no aporta otros valores estructurados además de marca y modelo.",
    "revisedShort": "Aspiradora Tennant APL V-WD-62 para polvo y líquidos, con cable de 8,5 m."
  },
  "3993": {
    "url": "https://online.gamrentals.com/es/tennant/3993-fca-i-mop-lite",
    "title": "Fregadora TENNANT FCA I-MOP LITE",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA I-MOP LITE",
    "sourceHash": "10ffeb985d1392d16df562be91187fe26e4defd35959a56d94d18d5dbe619843",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA I-MOP LITE",
      "Peso": "17 KG",
      "Anchura trabajo": "0,368 metros",
      "RPM cepillo": "500"
    },
    "originalShort": "➨ TENNANT FCA I-MOP LITE Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCA I-MOP LITE es una fregadora compacta con cabezal articulado para limpieza de suelos en zonas interiores con obstáculos y mobiliario. La ficha indica 17 kg de peso, 0,368 m de anchura de trabajo y cepillos a 500 rpm. La descripción original menciona baterías de ion de litio intercambiables, con unos 45 minutos de funcionamiento por carga, depósitos extraíbles y apagado de aspiración al inclinar el mango por debajo de un ángulo determinado. La autonomía depende del estado de la batería y el patrón de trabajo.",
    "revisedShort": "Fregadora Tennant FCA I-MOP LITE de 17 kg y 0,368 m de anchura de trabajo."
  },
  "4028": {
    "url": "https://online.gamrentals.com/es/fregadoras-industriales-nuevas/4028-bcs-6100",
    "title": "Fregadora TENNANT BCS 6100",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "BCS 6100",
    "sourceHash": "1cbf8fda4a7f2bc3e253e3aa0853ea75199fc0e155499226e860b90cdcf09f76",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "BCS 6100"
    },
    "originalShort": "➨ TENNANT BCS 6100 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant BCS 6100 es una máquina de limpieza industrial Tennant BCS 6100 con sistema de barrido y recogida de residuos mediante tolva. El texto de origen describe cepillos laterales con trayectorias de 760 mm o 970 mm según configuración, filtro multietapa y tolva con capacidad de hasta 90 kg. La alimentación declarada es por baterías de 36 V. La ficha comercial la denomina fregadora, pero las prestaciones detalladas corresponden al barrido; esta síntesis no presupone una función de fregado con agua que no está acreditada en el texto.",
    "revisedShort": "Equipo Tennant BCS 6100 de barrido a batería y tolva de hasta 90 kg."
  },
  "4036": {
    "url": "https://online.gamrentals.com/es/aspiradoras-industriales-nuevas/4036-ap-v-can-12",
    "title": "Aspiradora TENNANT AP V-CAN-12",
    "categoryKey": "marcas-nuevas",
    "brand": "Tennant",
    "model": "AP V-CAN-12",
    "sourceHash": "d9c6cf3e7647e78569fd22f9024d4d22a8b6f4dd55ad9934bdb19ec643f73eab",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "AP V-CAN-12"
    },
    "originalShort": "La aspiradora TENNANT AP V-CAN-12 es una solución eficiente y silenciosa para la limpieza de polvo en espacios comerciales e industriales. Con un peso de solo 6,1 kg y un nivel acústico de tan solo 63 dBA, es ideal para entornos sensibles al ruido, como oficinas, hoteles y hospitales. Equipada con un filtro HEPA, la AP V-CAN-12 garantiza la captura de partículas finas de polvo, mejorando la calidad del aire en interiores. Su cable de alimentación de 12 metros permite una gran movilidad, reduciendo la necesi",
    "general": "El modelo Tennant AP V-CAN-12 es una aspiradora profesional para recogida de polvo en oficinas y espacios comerciales que requieren limpieza periódica. La descripción de origen declara 6,1 kg de peso, 63 dBA de nivel sonoro, filtro HEPA y cable de alimentación de 12 m. También indica dimensiones aproximadas de 390 por 385 por 325 mm. Estas medidas ayudan a valorar el transporte y almacenamiento del equipo. Conviene mantener el filtro apropiado y comprobar el suministro eléctrico según la instalación.",
    "revisedShort": "Aspiradora Tennant AP V-CAN-12 de 6,1 kg, filtro HEPA y cable de 12 m."
  },
  "4038": {
    "url": "https://online.gamrentals.com/es/tennant/4038-apl-v-wd-27",
    "title": "Aspiradora TENNANT APL V-WD-27",
    "categoryKey": "marcas-nuevas",
    "brand": "Tennant",
    "model": "APL V-WD-27",
    "sourceHash": "fa3b683486cd20d6bc1fc4d4b6f23727cf3835965812340cc215d21f1c83b7dc",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "APL V-WD-27"
    },
    "originalShort": "La aspiradora TENNANT APL V-WD-27 es una máquina versátil diseñada para la limpieza eficiente de polvo y líquidos en entornos comerciales e industriales. Con un peso de 7,8 kg y un nivel acústico de solo 70 dBA, esta aspiradora es ideal para lugares donde se necesita un funcionamiento silencioso, como oficinas, hoteles y centros educativos. Su capacidad para manejar tanto polvo como líquidos la convierte en una opción excelente para la limpieza en situaciones diversas. Equipada con un cable de alimentación",
    "general": "El modelo Tennant APL V-WD-27 es una aspiradora profesional destinada a la limpieza de residuos secos y líquidos en instalaciones comerciales y talleres. El fabricante describe 7,8 kg de peso, un nivel acústico de 70 dBA y cable de alimentación de 8,5 m. Cita 392 mm de anchura y 630 mm de altura, útiles para valorar transporte y almacenaje. La capacidad para recoger líquido requiere la configuración de aspiración adecuada; no se atribuyen automáticamente accesorios que la ficha no identifica.",
    "revisedShort": "Aspiradora Tennant APL V-WD-27 para polvo y líquidos, con cable de 8,5 m."
  },
  "4035": {
    "url": "https://online.gamrentals.com/es/aspiradoras-industriales-nuevas/4035-ap-v-can-10",
    "title": "Aspiradora TENNANT AP V-CAN-10",
    "categoryKey": "marcas-nuevas",
    "brand": "Tennant",
    "model": "AP V-CAN-10",
    "sourceHash": "e2e81d64b869674297bfdc18761f3b868fe2a76125dd2789dd17e74bf29601ef",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "AP V-CAN-10"
    },
    "originalShort": "La aspiradora TENNANT AP V-CAN-10 es una solución ligera y eficiente para la limpieza de polvo en una variedad de entornos comerciales e industriales. Con un peso de solo 4,1 kg, esta aspiradora es fácil de transportar y maniobrar, ideal para tareas de limpieza rápidas y eficientes. Su nivel de ruido es de tan solo 68 dBA, lo que la hace adecuada para su uso en entornos sensibles al sonido, como oficinas, hoteles o centros educativos. Está equipada con un filtro HEPA opcional, que garantiza la captura efica",
    "general": "El modelo Tennant AP V-CAN-10 es una aspiradora profesional compacta para retirada de polvo en comercios, oficinas y otras instalaciones interiores. La descripción original declara 4,1 kg de peso, 68 dBA de nivel sonoro y un cable de alimentación de 8 m. Sus dimensiones citadas son 335 mm de longitud y 330 mm de altura. El filtro HEPA figura como opción, de modo que no debe considerarse instalado sin verificar la variante. El tamaño compacto facilita guardarla entre operaciones de limpieza.",
    "revisedShort": "Aspiradora Tennant AP V-CAN-10 de 4,1 kg y cable de 8 m; HEPA opcional."
  },
  "4037": {
    "url": "https://online.gamrentals.com/es/aspiradoras-industriales-nuevas/4037-ap-v-can-16",
    "title": "Aspiradora TENNANT AP V-CAN-16",
    "categoryKey": "marcas-nuevas",
    "brand": "Tennant",
    "model": "AP V-CAN-16",
    "sourceHash": "1b357fec8cbe386f3b664fb493b236cff5ad941c6e1713f178f402fa2d7deb0d",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "AP V-CAN-16"
    },
    "originalShort": "La aspiradora TENNANT AP V-CAN-16 es una herramienta eficiente y silenciosa diseñada para la limpieza de polvo en entornos comerciales e industriales. Con un peso de solo 6,1 kg y un nivel de ruido de tan solo 63 dBA, esta aspiradora es perfecta para lugares sensibles al ruido, como oficinas, hoteles y hospitales. Su filtro HEPA garantiza una captura eficaz de partículas finas de polvo, mejorando la calidad del aire y proporcionando un ambiente más saludable. Con un cable de alimentación de 12 metros, la AP",
    "general": "El modelo Tennant AP V-CAN-16 es una aspiradora de polvo compacta para limpieza de suelos y superficies de espacios interiores comerciales. El texto técnico indica 6,1 kg de peso, 63 dBA de nivel sonoro, filtro HEPA y cable de alimentación de 12 m. La anchura y longitud publicadas son 390 y 385 mm. Es una alternativa para tareas regulares en oficinas y zonas con tránsito, donde deben comprobarse el filtro, los accesorios y la compatibilidad eléctrica del equipo antes de utilizarlo.",
    "revisedShort": "Aspiradora Tennant AP V-CAN-16 de 6,1 kg, filtro HEPA y cable de 12 m."
  },
  "5771": {
    "url": "https://online.gamrentals.com/es/tennant/5771-fregadora-conductor-montado-tennant-fcs-t1581-c",
    "title": "Fregadora conductor sentado Tennant FCS T1581 C",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T1581 C",
    "sourceHash": "fb6d119df8a513da345b5fcc3b69642bccadfa33d724ad2e2dd94cab3e5398d4",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T1581 C",
      "Longitud": "2000 mm",
      "Anchura": "1180 mm",
      "Altura": "1500 mm",
      "Peso": "1175 KG",
      "RPM cepillo": "200"
    },
    "originalShort": "➨ Tennant FCS T1581 C Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCS T1581 C es una fregadora industrial de conductor sentado orientada a grandes superficies logísticas y comerciales. El origen indica hasta 1.049 mm de ancho de fregado, 218 litros de depósito de solución y 237 litros de recuperación. Describe batería de 36 V y autonomía de hasta cinco horas, dependiente del uso. La ficha recoge 2.000 mm de longitud, 1.180 mm de anchura, 1.500 mm de altura, 1.175 kg de peso y 200 rpm de cepillo. La tecnología ec-H2O NanoClean citada debe comprobarse en el equipamiento contratado.",
    "revisedShort": "Fregadora Tennant FCS T1581 C de conductor sentado, depósitos de 218/237 litros."
  },
  "5773": {
    "url": "https://online.gamrentals.com/es/tennant/5773-fregadora-conductor-sentado-tennant-fcs-t681-d70",
    "title": "Fregadora conductor sentado Tennant FCS T681 D70",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T681 D70",
    "sourceHash": "0c62c0c0ddc0f014b61f5d8daee52d5442d8d38f7ce8454b1cca48d17ad299f6",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T681 D70",
      "Longitud": "1500 mm",
      "Anchura": "760 mm",
      "Altura": "1200 mm",
      "Peso": "340 KG",
      "RPM cepillo": "200"
    },
    "originalShort": "➨ Tennant FCS T681 D70 Nueva ➨ Venta de fregadora industrial",
    "general": "El modelo Tennant FCS T681 D70 es una fregadora de conductor sentado para limpieza de superficies comerciales e industriales con necesidades de maniobra. La descripción de origen indica 700 mm de anchura de fregado, presión de cepillo regulable hasta 50 kg, depósitos de 100 litros de solución y 110 litros de recuperación y baterías de 24 V. La autonomía publicada alcanza hasta 3,5 horas según condiciones. Su ficha recoge 1.500 mm de longitud, 760 mm de anchura, 1.200 mm de altura, peso de 340 kg y 200 rpm de cepillo.",
    "revisedShort": "Fregadora Tennant FCS T681 D70 de conductor sentado y depósitos de 100/110 litros."
  }
};

export const resolveGamTennantCondensedGeneral = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort === record.shortDescription ? entry.general : null;
};

export const resolveGamTennantCondensedShort = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort === record.shortDescription ? entry.revisedShort ?? null : null;
};
