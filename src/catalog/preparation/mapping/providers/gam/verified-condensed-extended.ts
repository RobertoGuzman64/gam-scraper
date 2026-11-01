import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { verifyGamEditorialEvidence, type EditorialEvidence } from "./verified-condensed-general.js";

const evidence: Readonly<Record<string, EditorialEvidence>> = {
  "2178": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2178-hyster-s16il",
    "title": "Apilador eléctrico 1600Kg Hyster S1.6IL",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "S1.6IL",
    "sourceHash": "a18b82f61a0985389652657dd7ab66e8528bcbb54ff51b17b678325c0075616d",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S1.6IL",
      "Peso": "1187 KG",
      "Altura de elevación (m)": "6,02 metros",
      "Capacidad de carga (kg)": "1600 KG",
      "Capacidad de la batería": "24V / 315-375Ah | Li-ion 24V / 300Ah(V/Ah)"
    },
    "general": "El Hyster S1.6IL es un apilador eléctrico para elevar y trasladar palés en almacenes y zonas de preparación de pedidos. La capacidad nominal indicada es de 1.600 kg y la altura de elevación alcanza 6,02 m según la configuración descrita. La ficha declara un peso de 1.187 kg y alimentación de 24 V, con baterías de 315 a 375 Ah o alternativa de ion de litio de 300 Ah. Su propulsión eléctrica está destinada al trabajo en interiores y a maniobras entre estanterías. Para seleccionar el mástil debe comprobarse la capacidad residual a la altura real de trabajo, así como la altura de paso y el ancho disponible de los pasillos.",
    "originalShort": "➨ Hyster S1.6IL ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1600 kg",
    "revisedShort": "Apilador eléctrico Hyster S1.6IL: capacidad de 1.600 kg y elevación declarada de hasta 6,02 m."
  },
  "2174": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2174-hyster-s12il",
    "title": "Apilador eléctrico 1200Kg Hyster S1.2IL",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "S1.2IL",
    "sourceHash": "0b019ee1862cb7c26ec49d4e506e87b8682834802bd6318d1ef2953d53c41aed",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S1.2IL",
      "Peso": "1111 KG",
      "Altura de elevación (m)": "4,9 metros",
      "Capacidad de carga (kg)": "1200 KG",
      "Capacidad de la batería": "24V / 200-250Ah | Li-ion 24V / 200Ah(V/Ah)"
    },
    "general": "El apilador eléctrico Hyster S1.2IL se emplea en operaciones de almacenamiento, traslado y apilado de palés. La ficha especifica una capacidad nominal de 1.200 kg y una altura de elevación de 4,9 m, además de un peso de 1.111 kg. Se describen alternativas de batería de 24 V y 200 a 250 Ah, junto con una opción de ion de litio de 200 Ah; la capacidad concreta depende de la versión suministrada. La maniobrabilidad y los controles eléctricos están orientados al movimiento frecuente de mercancía en instalaciones logísticas. Antes de utilizarlo conviene comprobar el tipo de palé, la capacidad residual del mástil y los espacios de paso.",
    "originalShort": "➨ Hyster S1.2IL ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1200 kg",
    "revisedShort": "Apilador eléctrico Hyster S1.2IL de 1.200 kg, con elevación declarada de 4,9 m."
  },
  "2149": {
    "url": "https://online.gamrentals.com/es/transpaletas-hyster/2149-transpaleta-hyster-rp25n",
    "title": "Transpaleta eléctrica 2500Kg Hyster RP2.5N",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "RP2.5N",
    "sourceHash": "39c58e0070c93fb020ea3119cbd387459346eb34f5c5859b4a71a710ddb9870c",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "RP2.5N",
      "Peso": "1010 KG",
      "Altura de elevación (m)": "0,12 metros",
      "Capacidad de carga (kg)": "2500 KG",
      "Capacidad de la batería": "24V / 465Ah(V/Ah)"
    },
    "general": "La transpaleta eléctrica Hyster RP2.5N está destinada al traslado horizontal de palés en almacenes, expediciones y zonas de carga. Su capacidad nominal declarada es de 2.500 kg y la elevación de horquillas indicada es de 120 mm, suficiente para separar el palé del suelo durante el transporte. La ficha recoge un peso de 1.010 kg y una batería de 24 V y 465 Ah. El equipo permite mover mercancías en recorridos repetitivos con propulsión eléctrica, pero no sustituye a un apilador para almacenar cargas a distintas alturas. Deben verificarse la geometría de las horquillas, las pendientes autorizadas y el espacio disponible para maniobrar.",
    "originalShort": "➨ Hyster RP2.5N ➨ Venta de Transpaleta Hyster nuevo ⭐Capacidad de carga de 2500 kg",
    "revisedShort": "Transpaleta eléctrica Hyster RP2.5N para transporte de palés de hasta 2.500 kg."
  },
  "2132": {
    "url": "https://online.gamrentals.com/es/recogepedidos-hyster/2132-recogepedidos-hyster-lo20s",
    "title": "Recogepedidos 2000Kg Hyster LO2.0S",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "LO2.0S",
    "sourceHash": "54019794be76d5bf37f6cca4ecca439b51937df11c35954206849409a3ed9fca",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "LO2.0S",
      "Peso": "1220 / 1365 KG",
      "Capacidad de carga (kg)": "2000 KG",
      "Capacidad de la batería": "24V / 465Ah(V/Ah)",
      "Altura Plataforma": "- / 980 / 1500mm metros",
      "Altura de elevación (mm)": "120 mm"
    },
    "general": "El Hyster LO2.0S es un recogepedidos eléctrico para operaciones de preparación y movimiento de mercancía en instalaciones logísticas. La capacidad nominal indicada es de 2.000 kg y la elevación de horquillas declarada es de 120 mm. La ficha menciona diferentes configuraciones de plataforma de operario, con alturas de 980 o 1.500 mm, por lo que la altura y el peso del equipo deben corroborarse para la versión escogida. Se declara una batería de 24 V y 465 Ah y un intervalo de peso de 1.220 a 1.365 kg. Antes de incorporarlo al almacén conviene comprobar recorridos, radios de giro, altura de las ubicaciones de picking y carga máxima permitida.",
    "originalShort": "➨ Hyster LO2.0S ➨ Venta de Recogepedidos Hyster nuevo ⭐Capacidad de carga de 2000 kg",
    "revisedShort": "Recogepedidos eléctrico Hyster LO2.0S, de 2.000 kg, con diferentes configuraciones de plataforma."
  },
  "2130": {
    "url": "https://online.gamrentals.com/es/recogepedidos-hyster/2130-recogepedidos-hyster-lo10f",
    "title": "Recogepedidos 1000Kg Hyster LO1.0F",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "LO1.0F",
    "sourceHash": "ab4101b29430ce562fd71dfc012a89cbc3a0afab70d62117b70108cf05f669de",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "LO1.0F",
      "Peso": "1045 / 1190 KG",
      "Capacidad de carga (kg)": "1000 KG",
      "Capacidad de la batería": "24V / 465Ah(V/Ah)",
      "Altura Plataforma": "- / 980mm metros",
      "Altura de elevación (mm)": "#VALUE! mm"
    },
    "general": "El recogepedidos eléctrico Hyster LO1.0F se utiliza para preparar pedidos y desplazar palés en almacenes de distribución. Su capacidad nominal publicada es de 1.000 kg, con batería indicada de 24 V y 465 Ah. El proveedor recoge versiones de plataforma de operario, incluida una configuración elevada a 980 mm, y un peso comprendido entre 1.045 y 1.190 kg dependiendo de la versión. El valor estructurado de elevación de horquillas no es utilizable y, por tanto, no se presenta como una prestación acreditada. Antes de elegir esta máquina deben verificarse la altura de preparación de pedidos, la carga admisible, la geometría del palé y los espacios de maniobra.",
    "originalShort": "➨ Hyster LO1.0F ➨ Venta de Recogepedidos Hyster nuevo ⭐Capacidad de carga de 1000 kg",
    "revisedShort": "Recogepedidos eléctrico Hyster LO1.0F de 1.000 kg para preparación de pedidos en almacén."
  },
  "2097": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2097-apilador-de-pales-hyster-rs16",
    "title": "Carretilla elevadora apiladora HYSTER RS1.6",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "RS1.6",
    "sourceHash": "196e14bba07e730c37c39b4836be1677199c951e6d604d33b978ff76b310e248",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "RS1.6",
      "Longitud": "2159 mm",
      "Anchura": "798 mm",
      "Altura": "2300 mm",
      "Peso": "1643 KG",
      "Altura de elevación (m)": "6,02 metros",
      "Capacidad de carga (kg)": "1600 KG",
      "Capacidad de la batería": "24V / 465Ah(V/Ah)"
    },
    "general": "El Hyster RS1.6 es un apilador eléctrico con operario a bordo para apilar palés y realizar traslados en instalaciones logísticas. La ficha declara 1.600 kg de capacidad nominal y 6,02 m de elevación, cifras que deben evaluarse junto con la capacidad residual del mástil. Sus dimensiones publicadas son 2.159 mm de longitud, 798 mm de anchura y 2.300 mm de altura, con un peso de 1.643 kg. La batería indicada es de 24 V y 465 Ah. La configuración compacta favorece el uso en pasillos de almacenamiento, aunque el ancho real de trabajo también depende de la carga y las horquillas. Deben comprobarse las condiciones de pavimento, la altura libre y el espacio de giro.",
    "originalShort": "➨ HYSTER RS1.6 ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1600 kg",
    "revisedShort": "Apilador eléctrico Hyster RS1.6 de 1.600 kg y elevación declarada de 6,02 m."
  },
  "2131": {
    "url": "https://online.gamrentals.com/es/recogepedidos-hyster/2131-recogepedidos-hyster-lo20",
    "title": "Recogepedidos 2000Kg Hyster LO2.0",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "LO2.0",
    "sourceHash": "c744e8ef21b4776b54dab2a7551d92d6f346e084f24beee8625b5ed4678e0ab3",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "LO2.0",
      "Longitud": "3764 mm",
      "Anchura": "796 mm",
      "Altura": "1878 mm",
      "Peso": "1050 / 1195 / 1225 KG",
      "Capacidad de carga (kg)": "2000 KG",
      "Capacidad de la batería": "24V / 465Ah(V/Ah)",
      "Altura Plataforma": "- / 980 / 1500mm metros",
      "Altura de elevación (mm)": "120 mm"
    },
    "general": "El Hyster LO2.0 es un recogepedidos eléctrico orientado a desplazamientos internos y preparación de pedidos. Ofrece una capacidad nominal de 2.000 kg y una elevación de horquillas indicada de 120 mm. La ficha declara 3.764 mm de longitud, 796 mm de anchura y 1.878 mm de altura, mientras que el peso varía según configuración entre 1.050 y 1.225 kg. Se especifica una batería de 24 V y 465 Ah y distintas opciones de altura de plataforma para el operario, incluidas versiones de 980 y 1.500 mm. Para determinar si encaja en una instalación hay que comprobar la altura real de picking, las distancias de maniobra y las restricciones de carga.",
    "originalShort": "➨ Hyster LO2.0 ➨ Venta de Recogepedidos Hyster nuevo ⭐Capacidad de carga de 2000 kg",
    "revisedShort": "Recogepedidos eléctrico Hyster LO2.0 de 2.000 kg para trabajos de preparación y traslado."
  },
  "6419": {
    "url": "https://online.gamrentals.com/es/hyster/6419-carretilla-elevadora-electrica-hyster-j15utl",
    "title": "CARRETILLA ELEVADORA ELÉCTRICA 1500KG HYSTER J1.5UTL",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J1.5UTL",
    "sourceHash": "31a50e5898f5179c292848d23ded7de2852581142a15e1321ba388c438c8d416",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J1.5UTL",
      "Longitud": "3026 mm",
      "Anchura": "1120 mm",
      "Altura": "2160 mm",
      "Peso": "3030 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "1500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1970mm",
      "Altura mástil replegado": "2000 mm",
      "Altura de elevación (mm)": "3000 mm"
    },
    "general": "La carretilla elevadora eléctrica Hyster J1.5UTL está destinada a operaciones de carga, descarga y manutención de palés en almacenes. La ficha declara 1.500 kg de capacidad nominal a un centro de carga de 500 mm y una altura de elevación de 3.000 mm. Con motor eléctrico y batería de litio integrada según la descripción, ofrece manejo sin emisiones directas de escape durante la operación. Mide 3.026 mm de longitud, 1.120 mm de anchura y 2.160 mm de altura; su peso publicado es de 3.030 kg y el radio de giro, de 1.970 mm. El proveedor anuncia diversas capacidades de batería, por lo que deben verificarse la autonomía y la configuración del mástil de la unidad concreta.",
    "originalShort": "➨ HYSTER J1.5UTL nueva ➨ Venta de Carretilla Elevadora Eléctrica 3 metros nueva ⭐Capacidad de carga de 1.500 kg",
    "revisedShort": "Carretilla eléctrica Hyster J1.5UTL de 1.500 kg y elevación indicada de 3.000 mm."
  },
  "6420": {
    "url": "https://online.gamrentals.com/es/hyster/6420-carretilla-elevadora-electrica-hyster-j18utl",
    "title": "CARRETILLA ELEVADORA ELÉCTRICA 1800KG HYSTER J1.8UTL",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J1.8UTL",
    "sourceHash": "bb51b263e34c5c002f7601e0b655ced20686019fe43a2b8eccc1a3f8cc372e35",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J1.8UTL",
      "Longitud": "3026 mm",
      "Anchura": "1120 mm",
      "Altura": "2160 mm",
      "Peso": "3310 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "1800 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1970mm",
      "Altura mástil replegado": "2000 mm",
      "Altura de elevación (mm)": "3000 mm"
    },
    "general": "La Hyster J1.8UTL es una carretilla elevadora eléctrica con batería de litio integrada, descrita para manipulación de palés en operaciones de almacén y logística. Su capacidad nominal es de 1.800 kg con centro de carga de 500 mm, y la altura de elevación publicada es de 3.000 mm. La ficha recoge 3.026 mm de longitud, 1.120 mm de anchura, 2.160 mm de altura y 3.310 kg de peso, junto con un radio de giro de 1.970 mm. La descripción anuncia alternativas de capacidad de batería para adaptar la energía disponible a distintos turnos, sin atribuir una de ellas a todas las unidades. Antes de seleccionar la máquina es necesario comprobar el mástil y las condiciones de paso y carga.",
    "originalShort": "➨ HYSTER J1.8UTL nueva ➨ Venta de Carretilla Elevadora Eléctrica 3 metros nueva ⭐Capacidad de carga de 1.800 kg",
    "revisedShort": "Carretilla eléctrica Hyster J1.8UTL, con 1.800 kg de capacidad y elevación de 3.000 mm."
  },
  "6327": {
    "url": "https://online.gamrentals.com/es/yale/6327-carretilla-elevadora-electrica-yale-erp35ux-l-",
    "title": "Carretilla elevadora eléctrica 3500kg Yale ERP35UX L",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP35UX L",
    "sourceHash": "f542389512927f3ff6753836c08cc61d7d54933ff095d4c8c267a1af001ee917",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP35UX L",
      "Longitud": "3759 mm",
      "Anchura": "1365 mm",
      "Altura": "2120 mm",
      "Peso": "5310 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "3500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "2405mm",
      "Altura mástil replegado": "2120 mm",
      "Altura de elevación (mm)": "3990 mm"
    },
    "general": "La Yale ERP35UX L es una carretilla elevadora eléctrica con batería de ion de litio, destinada a manipular mercancías pesadas en almacenes e instalaciones industriales. La ficha indica 3.500 kg de capacidad nominal con centro de carga de 500 mm y 3.990 mm de elevación; esta última cifra prevalece frente a la altura genérica del resumen comercial. Sus dimensiones publicadas son 3.759 mm de longitud, 1.365 mm de anchura y 2.120 mm de altura, con 5.310 kg de peso y radio de giro de 2.405 mm. El texto de origen cita un sistema eléctrico de la clase 80 V y opciones de batería según configuración. Deben comprobarse el mástil instalado y la capacidad residual antes de utilizarla.",
    "originalShort": "➨ YALE ERP35UX L ➨ Venta de Carretilla Elevadora Eléctrica 5,5 metros nueva ⭐Capacidad de carga de 3500 kg",
    "revisedShort": "Carretilla eléctrica Yale ERP35UX L de 3.500 kg con elevación publicada de 3.990 mm."
  },
  "6322": {
    "url": "https://online.gamrentals.com/es/yale/6322-carretilla-elevadora-electrica-yale-erp15ux-l-",
    "title": "Carretilla elevadora eléctrica 1500Kg Yale ERP15UX L",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP15UX L",
    "sourceHash": "b6d901d29c0b525bd83e4720b8020122cfc888232ec7057512260cc6bd4aed00",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP15UX L",
      "Longitud": "3026 mm",
      "Anchura": "1120 mm",
      "Altura": "2000 mm",
      "Peso": "3030 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "1500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1970mm",
      "Altura mástil replegado": "2000 mm",
      "Altura de elevación (mm)": "3990 mm"
    },
    "general": "La carretilla eléctrica Yale ERP15UX L se emplea en carga, descarga y almacenamiento de mercancía paletizada. Su capacidad nominal es de 1.500 kg con centro de carga de 500 mm y una altura de elevación publicada de 3.990 mm, distinta de las alturas genéricas que aparecen en el texto comercial. La ficha recoge 3.026 mm de longitud, 1.120 mm de anchura y 2.000 mm de altura, con 3.030 kg de peso y radio de giro de 1.970 mm. Se describe propulsión eléctrica de corriente alterna y batería de litio integrada, con capacidades variables según la versión. Para planificar su uso hay que contrastar la geometría real del mástil, los pasillos y las cargas elevadas.",
    "originalShort": "➨ YALE ERP15UX L ➨ Venta de Carretilla Elevadora Eléctrica 5,5 metros nueva ⭐Capacidad de carga de 1500 kg",
    "revisedShort": "Carretilla eléctrica Yale ERP15UX L de 1.500 kg y elevación declarada de 3.990 mm."
  },
  "4790": {
    "url": "https://online.gamrentals.com/es/plataforma-telescopica-diesel-xcmg/4790-plataforma-telescopica-diesel-xcmg-xgs40k",
    "title": "Plataforma telescópica diésel 40M XCMG XGS40K",
    "categoryKey": "elevacion-nueva",
    "brand": "XCMG",
    "model": "XGS40K",
    "sourceHash": "d342378da642ddd1be290559175e2b0b7a675274529876945af0b0a4da6c0fef",
    "sourceSpecs": {
      "Marca": "XCMG",
      "Modelo": "XGS40K",
      "Longitud": "14990 mm",
      "Anchura": "4170 mm",
      "Altura": "2810 mm",
      "Peso": "20800 KG",
      "Tipo motor": "Diésel",
      "Altura de elevación (m)": "40 metros",
      "Capacidad de carga (kg)": "460 KG",
      "Pendiente superable": "40 %",
      "Dimensiones Cesta": "2,44X0,90 metros"
    },
    "general": "La XCMG XGS40K es una plataforma telescópica diésel para mantenimiento industrial, construcción y montajes en altura en espacios exteriores. La ficha declara 40 m de altura de elevación y una capacidad máxima de cesta de 460 kg; el texto comercial cita una altura de trabajo de 40,2 m, distinción que debe verificarse con la configuración de la máquina. El equipo dispone de tracción en las cuatro ruedas según la descripción y se anuncia una pendiente superable de hasta el 40 % bajo las condiciones especificadas. Mide 14.990 mm de longitud, 4.170 mm de anchura y 2.810 mm de altura, con 20.800 kg de peso. La cesta descrita es de 2,44 × 0,90 m. Antes de operar deben revisarse terreno, estabilización y diagrama de alcance.",
    "originalShort": "➨ XCMG XGS40K Nueva ➨ Venta de plataforma telescópica diésel de 40 metros de altura ⭐Capacidad de la cesta 460 kg",
    "revisedShort": "Plataforma telescópica diésel XCMG XGS40K de 40 m, con cesta de hasta 460 kg."
  },
  "6364": {
    "url": "https://online.gamrentals.com/es/yale/6364-mo70t",
    "title": "Tractor eléctrico de arrastre Yale MO70TR",
    "categoryKey": "otros-nuevos",
    "brand": "YALE",
    "model": "MO70TR",
    "sourceHash": "880d0f5633af32fea32fe0730b69b67fcaeffb5f775729c0dc4f0ec7ce20450e",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MO70TR",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "7000 KG"
    },
    "general": "El Yale MO70TR es un tractor eléctrico de arrastre para desplazar remolques y trenes logísticos entre áreas de recepción, producción y expedición. Su capacidad nominal publicada es de 7.000 kg de carga remolcada, una prestación de arrastre que no debe confundirse con la elevación de una carretilla. El texto técnico indica fuerza nominal de tiro de 1.336 N, velocidad de 8,4 km/h con carga y 13 km/h sin carga, y radio de giro de 1.434 mm. Se describe alimentación de 24 V con batería de 620 Ah y alternativa de 465 Ah según la versión. La selección del equipo debe considerar pendientes, masa total remolcada, resistencia a la rodadura y compatibilidad de los enganches.",
    "originalShort": "➨ Yale MO70TR➨ Venta de Tractor eléctrico de arrastre Yale nuevo ⭐Capacidad de carga de 7000 kg",
    "revisedShort": "Tractor eléctrico de arrastre Yale MO70TR para trenes logísticos de hasta 7.000 kg."
  },
  "3994": {
    "url": "https://online.gamrentals.com/es/tennant/3994-fca-i-mop-xl",
    "title": "Fregadora TENNANT FCA I-MOP XL",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA I-MOP XL",
    "sourceHash": "027d4513f2a491ed57405a73968e683fccd42d1d8e77caa27fe1271694c1129f",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA I-MOP XL",
      "Peso": "26 KG",
      "Anchura trabajo": "0,46 metros",
      "RPM cepillo": "350"
    },
    "general": "La Tennant FCA I-MOP XL es una fregadora compacta para limpieza de suelos en zonas con mobiliario, pasillos y obstáculos frecuentes. La ficha recoge 460 mm de anchura de trabajo, cepillos a 350 rpm y un peso de 26 kg. Su estructura articulada y el diseño de conductor acompañante permiten maniobrar cerca de elementos fijos y bajo determinados muebles, según el espacio disponible. El proveedor describe un sistema de fregado con aspiración para recuperar agua sucia durante el recorrido y cita una productividad teórica de hasta 1.800 m²/h, dependiente de la superficie y del ritmo real de trabajo. Antes de emplearla conviene verificar el tipo de pavimento, el producto de limpieza autorizado y el acceso a los puntos de mantenimiento.",
    "originalShort": "➨ TENNANT FCA I-MOP XL Nueva ➨ Venta de fregadora industrial",
    "revisedShort": "Fregadora compacta Tennant FCA I-MOP XL, 460 mm de trabajo y cepillos a 350 rpm."
  },
  "4007": {
    "url": "https://online.gamrentals.com/es/tennant/4007-fcs-t7-d80",
    "title": "Fregadora TENNANT FCS T7+ D80",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T7+ D80",
    "sourceHash": "0239270a660d36a00a645cf63b34c6e0125a863c27b9ccff106916dc34ef6c07",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T7+ D80",
      "Peso": "471 KG",
      "RPM cepillo": "260"
    },
    "general": "La Tennant FCS T7+ D80 es una fregadora de operador sentado para limpieza mecanizada de suelos en instalaciones comerciales e industriales. El texto de origen indica una anchura de fregado de 800 mm y una productividad teórica de hasta 5.120 m²/h, condicionada por el recorrido y el tipo de superficie. La ficha estructurada declara un peso de 471 kg y 260 rpm de giro de cepillo. La descripción presenta opciones de gestión de agua y detergente como ec-H2O NanoClean y FaST, cuya disponibilidad debe comprobarse en cada máquina. Su configuración de conductor sentado facilita recorridos frecuentes; antes de usarla deben verificarse pendientes admisibles, accesos, anchura de pasillos y características del pavimento.",
    "originalShort": "➨ TENNANT FCS T7+ D80 Nueva ➨ Venta de fregadora industrial",
    "revisedShort": "Fregadora de operador sentado Tennant FCS T7+ D80 para limpieza industrial; 471 kg."
  },
  "4006": {
    "url": "https://online.gamrentals.com/es/tennant/4006-fcs-t7-d65",
    "title": "Fregadora TENNANT FCS T7+ D65",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCS T7+ D65",
    "sourceHash": "0da1a865b6344e4d60bfc69633ca82a0e104cc6c3e170cd5bcc3e52b78bde939",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCS T7+ D65",
      "Peso": "471 KG",
      "RPM cepillo": "260"
    },
    "general": "La Tennant FCS T7+ D65 es una fregadora compacta de operador sentado para mantenimiento de suelos en almacenes y espacios comerciales. La ficha técnica publicada indica un peso de 471 kg y una velocidad de giro de cepillo de 260 rpm. El texto comercial común a la serie T7+ describe soluciones de dosificación de agua y detergente y maniobrabilidad para pasillos y recorridos con obstáculos; no se atribuye a esta variante una anchura de 800 mm únicamente porque figure en la descripción común de la D80. La capacidad de limpieza y el sistema de fregado concretos deben corroborarse para la configuración D65. Antes de su selección conviene comprobar dimensiones de acceso, características del suelo y necesidades de mantenimiento.",
    "originalShort": "➨ TENNANT FCS T7+ D65 Nueva ➨ Venta de fregadora industrial",
    "revisedShort": "Fregadora de conductor sentado Tennant FCS T7+ D65, con cepillo a 260 rpm."
  },
  "2253": {
    "url": "https://online.gamrentals.com/es/transpaletas-yale/2253-transpaleta-electrica-a-pie-yale-mp30hd",
    "title": "Transpaleta eléctrica a pie Yale MP30HD",
    "categoryKey": "marcas-nuevas",
    "brand": "YALE",
    "model": "MP30HD",
    "sourceHash": "9b1f44905176722da5f92a08c9d063622bad058a0a91f62c556ac2b04bea16e9",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MP30HD",
      "Longitud": "1913 mm",
      "Anchura": "736 mm",
      "Altura": "85 mm",
      "Peso": "633 KG",
      "Capacidad de carga (kg)": "3000 KG",
      "Capacidad de la batería": "24V / 210-300Ah(V/Ah)",
      "Motorización": "Eléctrico"
    },
    "general": "La Yale MP30HD es una transpaleta eléctrica de conductor acompañante para desplazar palés pesados entre almacenes, muelles y expediciones. Su capacidad nominal es de 3.000 kg. La ficha declara 1.913 mm de longitud, 736 mm de anchura y 633 kg de peso, con alimentación de 24 V y opciones de batería entre 210 y 300 Ah. El accionamiento eléctrico está orientado a recorridos repetitivos de transporte horizontal y maniobras con mercancía. La altura estructurada de 85 mm corresponde a una dimensión del equipo y no se presenta como elevación útil de carga. Para comprobar su idoneidad hay que revisar longitud de horquillas, tipo de palé, pendientes y radio de giro según la carga.",
    "originalShort": "➨ Yale MP30HD ➨ Venta de Transpaleta Eléctrica Yale nueva ⭐Capacidad de carga de 3000 kg",
    "revisedShort": "Transpaleta eléctrica a pie Yale MP30HD para transporte horizontal de hasta 3.000 kg."
  },
  "2252": {
    "url": "https://online.gamrentals.com/es/transpaletas-yale/2252-transpaleta-electrica-a-pie-yale-mp25hd",
    "title": "Transpaleta eléctrica MP25HD",
    "categoryKey": "marcas-nuevas",
    "brand": "YALE",
    "model": "MP25HD",
    "sourceHash": "628b87acc43cbd34324981c8a78168730295c6aca33b39991d07133bbb347da4",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MP25HD",
      "Longitud": "1913 mm",
      "Anchura": "736 mm",
      "Altura": "85 mm",
      "Peso": "633 KG",
      "Capacidad de carga (kg)": "2500 KG",
      "Capacidad de la batería": "24V / 210-300Ah(V/Ah)",
      "Motorización": "Eléctrico"
    },
    "general": "La Yale MP25HD es una transpaleta eléctrica a pie destinada al transporte horizontal de palés en instalaciones logísticas e industriales. Su capacidad de carga declarada es de 2.500 kg. El proveedor recoge 1.913 mm de longitud, 736 mm de anchura y 633 kg de peso, junto con una batería de 24 V cuyas capacidades disponibles van de 210 a 300 Ah. El equipo se utiliza para mover y posicionar palés durante la recepción, reposición y expedición, sin confundir la función de traslado con la elevación de un apilador. La altura de 85 mm consignada en la ficha se trata como una medida geométrica, no como altura de almacenamiento. Deben revisarse anchura de paso, pendientes y compatibilidad de horquillas.",
    "originalShort": "➨ Yale MP25HD➨ Venta de Transpaleta Eléctrica Yale nueva ⭐Capacidad de carga de 2500 kg",
    "revisedShort": "Transpaleta eléctrica Yale MP25HD de 2.500 kg para movimiento de palés en almacén."
  },
  "2206": {
    "url": "https://online.gamrentals.com/es/apiladores-yale/2206-aplicador-electrico-a-pie-yale-ms16xsl",
    "title": "Apilador eléctrico 1600Kg Yale MS16XSL",
    "categoryKey": "apiladores-nuevos",
    "brand": "YALE",
    "model": "MS16XSL",
    "sourceHash": "c9241a26f0a3d6dacce2cb772fd98f5e63451d4f01e97044b0c3ca9ff9f0e748",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MS16XSL",
      "Longitud": "2161 mm",
      "Anchura": "794 mm",
      "Altura": "2100 mm",
      "Capacidad de carga (kg)": "1600 KG",
      "Motorización": "Eléctrico"
    },
    "general": "El Yale MS16XSL es un apilador eléctrico de conductor acompañante orientado a la elevación y el traslado de palés en almacenes. Su capacidad nominal publicada es de 1.600 kg y el texto de origen cita una altura máxima de elevación de hasta 5,4 m, dependiente del mástil. La ficha estructurada declara 2.161 mm de longitud, 794 mm de anchura y 2.100 mm de altura, dimensiones relevantes para el diseño de recorridos y pasillos. El accionamiento eléctrico y la conducción a pie favorecen maniobras en áreas de almacenamiento, pero la capacidad admisible a máxima altura debe verificarse con la configuración concreta. También es necesario comprobar el tipo de palé, la altura libre y el estado del pavimento.",
    "originalShort": "➨ YALE MS16XSL ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1600 kg",
    "revisedShort": "Apilador eléctrico a pie Yale MS16XSL de 1.600 kg, con elevación anunciada hasta 5,4 m."
  },
  "6326": {
    "url": "https://online.gamrentals.com/es/yale/6326-carretilla-elevadora-electrica-yale-erp30ux-l-",
    "title": "Carretilla elevadora eléctrica 3000kg Yale ERP30UX L",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP30UX L",
    "sourceHash": "839d1d847ffa3d6d67aa9cc8999d2b992bc399334f40e7212790661231ba6b20",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP30UX L",
      "Longitud": "3614 mm",
      "Anchura": "1285 mm",
      "Altura": "2045 mm",
      "Peso": "4910 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "3000 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "2349mm",
      "Altura mástil replegado": "2050 mm",
      "Altura de elevación (mm)": "3990 mm"
    },
    "general": "La Yale ERP30UX L es una carretilla elevadora eléctrica con batería de ion de litio integrada para movimiento de palés y mercancías en almacenes e industria. Su capacidad nominal es de 3.000 kg con centro de carga de 500 mm y su altura de elevación publicada es de 3.990 mm. La ficha indica 3.614 mm de longitud, 1.285 mm de anchura, 2.045 mm de altura y 4.910 kg de peso; el radio de giro declarado es de 2.349 mm. El texto comercial describe alternativas de mástil y sistema eléctrico de la clase 80 V, de modo que la autonomía y las dimensiones finales dependen de la configuración. Es necesario confirmar la capacidad residual de la carretilla y las condiciones de paso y suelo.",
    "originalShort": "➨ YALE ERP30UX L ➨ Venta de Carretilla Elevadora Eléctrica 5,5 metros nueva ⭐Capacidad de carga de 3000 kg",
    "revisedShort": "Carretilla eléctrica Yale ERP30UX L de 3.000 kg con elevación publicada de 3.990 mm."
  },
};

export const resolveGamExtendedCondensedGeneral = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort === record.shortDescription ? entry.general : null;
};

export const resolveGamExtendedCondensedShort = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort && record.shortDescription === entry.originalShort ? entry.revisedShort ?? null : null;
};
