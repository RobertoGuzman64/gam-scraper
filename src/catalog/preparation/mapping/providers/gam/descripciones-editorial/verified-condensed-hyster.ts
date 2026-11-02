import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { verifyGamEditorialEvidence, type EditorialEvidence } from "./verified-condensed-general.js";

const evidence: Readonly<Record<string, EditorialEvidence>> = {
  "4622": {
    "url": "https://online.gamrentals.com/es/transpaleta-electrica-conductor-acompanante-1600-kg/4622-transpaleta-electrica-a-pie-hyster-p16ut-",
    "title": "Transpaleta elevadora eléctrica Hyster P1.6UT",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "P1.6UT",
    "sourceHash": "ce25925a7b409b4d4819b28c2d08f7135d80759ae4ad293d28d3ace5170b20df",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "P1.6UT",
      "Longitud": "1666 mm",
      "Anchura": "710 mm",
      "Altura": "1250 mm",
      "Peso": "424 KG",
      "Tipo motor": "Eléctrico"
    },
    "originalShort": "➨ Hyster P1.6UT ➨ Venta de Transpaleta eléctrica a pie Hyster nuevo ⭐Capacidad de carga de 1600 kg",
    "general": "La transpaleta de conductor acompañante Hyster P1.6UT está destinada a mover palés en almacenes, zonas de expedición y muelles. Su timón y tracción eléctrica permiten realizar trayectos horizontales y aproximaciones a la carga sin recurrir a una carretilla contrapesada. La capacidad nominal indicada es de 1.600 kg, con 1.666 mm de longitud y 710 mm de anchura. La información de origen cita alimentación de 24 V y 150 Ah; se debe comprobar el tipo de batería y el estado del pavimento antes de planificar jornadas continuas.",
    "revisedShort": "Transpaleta eléctrica a pie Hyster P1.6UT para cargas de hasta 1.600 kg."
  },
  "4626": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/4626-carretilla-elevadora-electrica-hyster-j20uttl",
    "title": "Carretilla elevadora eléctrica Hyster J2.0UTTL",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J2.0UTTL",
    "sourceHash": "97a91291ec6949a6835037af5ec1d98e12bd04b256b6bebd7786a59d91a93606",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J2.0UTTL",
      "Longitud": "3153 mm",
      "Anchura": "1140 mm",
      "Altura": "1990 mm",
      "Peso": "3380 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "2000 KG",
      "Radio de giro": "1716"
    },
    "originalShort": "➨ Hyster J2.0UTTL ➨ Venta de Carretilla elevadora eléctrica Hyster nuevo ⭐Capacidad de carga de 2000 kg",
    "general": "La Hyster J2.0UTTL es una carretilla elevadora eléctrica para carga, descarga y traslado de palés en espacios logísticos con pasillos de maniobra ajustados. El chasis de dimensiones contenidas y la tracción eléctrica permiten trabajar sin gases de escape directos. La capacidad nominal indicada es de 2.000 kg, con 3.153 mm de longitud y 1.140 mm de anchura. El origen contempla configuraciones alternativas de batería de plomo o ion de litio y distintos mástiles; ninguna de esas opciones se atribuye por defecto a una unidad concreta. Hay que comprobar la capacidad residual a la altura requerida.",
    "revisedShort": "Carretilla elevadora eléctrica Hyster J2.0UTTL de 2.000 kg."
  },
  "6480": {
    "url": "https://online.gamrentals.com/es/hyster/6480-apilador-electrico-a-pie-hyster-sc12-sl",
    "title": "APILADOR ELÉCTRICO A PIE 1200KG HYSTER SC1.2 SL",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "SC1.2 SL",
    "sourceHash": "c986baccc412cb1e21d1beb155fd7f274030bdf2efc8d9c6cd359ca323efa08b",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "SC1.2 SL",
      "Longitud": "1670 mm",
      "Anchura": "820 mm",
      "Altura": "2020 mm",
      "Peso": "660 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "1200 KG"
    },
    "originalShort": "➨ Hyster SC1.2 SL ➨ Venta de apilador eléctrico a pie compacto ⭐ Capacidad de carga de 1200 kg",
    "general": "El apilador eléctrico peatonal Hyster SC1.2 SL está orientado a la elevación y colocación de palés en almacenes y áreas de preparación de pedidos. Su anchura contenida ayuda a plantear el trabajo en pasillos interiores. La capacidad nominal indicada es de 1.200 kg, con 1.670 mm de longitud y 820 mm de anchura. El proveedor menciona varias alturas de mástil disponibles; la altura alcanzable por cada equipo depende de la configuración instalada. Conviene confirmar la sección de paso, la carga residual y la superficie de trabajo.",
    "revisedShort": "Apilador eléctrico a pie Hyster SC1.2 SL de 1.200 kg."
  },
  "2100": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2100-apilador-de-pales-hyster-s10c",
    "title": "Carretilla elevadora apiladora HYSTER S1.0C",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "S1.0C",
    "sourceHash": "b826961f0939a69a7c69a238e6e4902d3b59b7a8f9d50440981f3d9f5a4d58c9",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S1.0C",
      "Longitud": "2742 mm",
      "Anchura": "939 mm",
      "Altura": "2325 mm",
      "Peso": "2180 KG",
      "Altura de elevación (m)": "4,176 metros",
      "Capacidad de carga (kg)": "1000 KG",
      "Capacidad de la batería": "24V / 400Ah(V/Ah)"
    },
    "originalShort": "➨ HYSTER S1.0C ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1000 kg",
    "general": "La Hyster S1.0C es una apiladora eléctrica para recoger, transportar y situar palés en estanterías de instalaciones logísticas. La posición de operario a pie y el diseño del equipo permiten tareas de manutención en zonas de circulación interior. La capacidad nominal indicada es de 1.000 kg, con 2.742 mm de longitud y 939 mm de anchura. La elevación publicada es de 4,176 metros. La ficha declara alimentación de 24 V y 400 Ah. El trabajo a la altura máxima exige contrastar la capacidad residual con el mástil, el centro de carga y las condiciones de apoyo.",
    "revisedShort": "Apilador eléctrico Hyster S1.0C de 1.000 kg para estanterías."
  },
  "2099": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2099-apilador-de-pales-hyster-s12e",
    "title": "Carretilla elevadora apiladora HYSTER S1.2E",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "S1.2E",
    "sourceHash": "c5cf61f75bbab9e18610f96a9710197f919d1d57e2ffd85baaaeec809ea095fe",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S1.2E",
      "Longitud": "1815 mm",
      "Anchura": "790 mm",
      "Altura": "1750 mm",
      "Peso": "810 KG",
      "Altura de elevación (m)": "4,18 metros",
      "Capacidad de carga (kg)": "1200 KG"
    },
    "originalShort": "➨ HYSTER S1.2E ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1200 kg",
    "general": "El apilador a pie Hyster S1.2E está diseñado para desplazamientos cortos de palés y apilado en almacenes con tránsito frecuente. Su sistema de elevación motorizado permite situar la carga en diferentes niveles de estantería. La capacidad nominal indicada es de 1.200 kg, con 1.815 mm de longitud y 790 mm de anchura. La elevación publicada es de 4,18 metros. La disponibilidad de configuraciones para bajas temperaturas mencionada por el proveedor no implica que todas las unidades estén preparadas para cámaras frigoríficas. Debe verificarse el mástil, el suelo y el espacio de maniobra.",
    "revisedShort": "Apilador eléctrico Hyster S1.2E de 1.200 kg y elevación de 4,18 m."
  },
  "4623": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/4623-apilador-electrico-a-pie-hyster-sc12",
    "title": "Apilador eléctrico a pie Hyster SC1.2",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "SC1.2",
    "sourceHash": "94aadedd4af578bdba419d315cdf48bfd56d8099750b4bcb08e607572cf2fa8b",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "SC1.2",
      "Longitud": "1730 mm",
      "Anchura": "820 mm",
      "Altura": "1730 mm",
      "Peso": "590 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "1200 KG"
    },
    "originalShort": "➨ Hyster SC1.2 ➨ Venta de Apilador eléctrico a pie Hyster nuevo ⭐Capacidad de carga de 1200 kg",
    "general": "El Hyster SC1.2 es un apilador eléctrico de conductor acompañante para trasladar y apilar palés dentro de almacenes. Su formato compacto resulta adecuado para recorridos cortos y operaciones repetidas de ubicación de cargas. La capacidad nominal indicada es de 1.200 kg, con 1.730 mm de longitud y 820 mm de anchura. El origen describe una batería de litio de 24 V. Antes de utilizarlo deben revisarse la altura útil del mástil, el tipo de palé y el límite de carga a la cota de apilado, sin confundirlo con la variante SC1.2 SL.",
    "revisedShort": "Apilador eléctrico a pie Hyster SC1.2 con 1.200 kg de capacidad."
  },
  "2098": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2098-apilador-de-pales-hyster-s10e",
    "title": "Carretilla elevadora apiladora HYSTER S1.0E",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "S1.0E",
    "sourceHash": "81c393055680679e5ce3e33836ee8755ec4ee8914561c1a727301c2d2a548213",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S1.0E",
      "Longitud": "1815 mm",
      "Anchura": "790 mm",
      "Altura": "1750 mm",
      "Peso": "790 KG",
      "Altura de elevación (m)": "3,58 metros",
      "Capacidad de carga (kg)": "1000 KG"
    },
    "originalShort": "➨ HYSTER S1.0E ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1000 kg",
    "general": "La apiladora eléctrica Hyster S1.0E facilita la elevación de palés y su traslado en recorridos interiores de almacén. Su conducción a pie permite realizar maniobras de acercamiento a estanterías con el operario fuera de la estructura de la máquina. La capacidad nominal indicada es de 1.000 kg, con 1.815 mm de longitud y 790 mm de anchura. La elevación publicada es de 3,58 metros. El proveedor contempla versiones preparadas para frío, una condición opcional que requiere confirmación antes de operar en cámaras refrigeradas. La altura del mástil y la capacidad residual determinan los niveles de trabajo admisibles.",
    "revisedShort": "Apilador eléctrico a pie Hyster S1.0E de 1.000 kg y 3,58 m."
  },
  "2101": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2101-apilador-de-pales-hyster-s12c",
    "title": "Carretilla elevadora apiladora HYSTER S1.2C",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "S1.2C",
    "sourceHash": "26dda84defe38760bc9f1f69608738f025e7441c505727c9599e194be3229fe0",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S1.2C",
      "Longitud": "2892 mm",
      "Anchura": "939 mm",
      "Altura": "2325 mm",
      "Peso": "2280 KG",
      "Altura de elevación (m)": "5,076 metros",
      "Capacidad de carga (kg)": "1200 KG",
      "Capacidad de la batería": "24V / 400Ah(V/Ah)"
    },
    "originalShort": "➨ HYSTER S1.2C ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1200 kg",
    "general": "La Hyster S1.2C es una apiladora eléctrica de operario a pie destinada a ubicar y retirar palés en almacenes con estanterías. Su diseño favorece los recorridos de manutención y las maniobras de entrada y salida de carga. La capacidad nominal indicada es de 1.200 kg, con 2.892 mm de longitud y 939 mm de anchura. La elevación publicada es de 5,076 metros. El origen menciona posibles configuraciones para instalaciones refrigeradas; deben comprobarse los componentes de la unidad antes de dar por válida esa aplicación. También es necesario verificar el mástil y la capacidad de carga a la altura prevista.",
    "revisedShort": "Apiladora eléctrica Hyster S1.2C, 1.200 kg y elevación de 5,076 m."
  },
  "2151": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/2151-apilador-de-pales-hyster-s12s",
    "title": "Carretilla elevadora apiladora HYSTER S1.2S",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "S1.2S",
    "sourceHash": "575887a897b072d9abb2c9fef740dca4ab21c2f106f27c016f1b8ac4bcdbeb8c",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S1.2S",
      "Longitud": "2009 mm",
      "Anchura": "790 mm",
      "Altura": "2100 mm",
      "Peso": "1100 KG",
      "Altura de elevación (m)": "3,2 metros",
      "Capacidad de carga (kg)": "1200 KG",
      "Capacidad de la batería": "24V / 210-250Ah | Li-ion 24V / 200Ah(V/Ah)"
    },
    "originalShort": "➨ HYSTER S1.2S ➨ Venta de apilador eléctrico nuevo ⭐Capacidad de carga de 1200 kg",
    "general": "El apilador Hyster S1.2S está destinado al movimiento y almacenamiento vertical de palés en instalaciones de logística y distribución. La conducción eléctrica facilita ciclos de desplazamiento y elevación en zonas interiores. La capacidad nominal indicada es de 1.200 kg, con 2.009 mm de longitud y 790 mm de anchura. La elevación publicada es de 3,2 metros. El proveedor presenta baterías de plomo de diferentes capacidades y una alternativa de ion de litio; no se consideran instaladas simultáneamente. Antes de apilar deben revisarse las condiciones de rampas, la carga residual y la altura del mástil.",
    "revisedShort": "Apilador eléctrico Hyster S1.2S de 1.200 kg y 3,2 m."
  },
  "2140": {
    "url": "https://online.gamrentals.com/es/transpaletas-hyster/2140-transpaleta-hyster-p20s",
    "title": "Transpaleta eléctrica Hyster P2.0S",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "P2.0S",
    "sourceHash": "09f48b1f3083f0274404ae27ba78779222de24bf9ff29983714300a3fb2ca6b9",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "P2.0S",
      "Peso": "678 KG",
      "Altura de elevación (m)": "0,12 metros",
      "Capacidad de carga (kg)": "2000 KG",
      "Capacidad de la batería": "24V / 210 - 500Ah(V/Ah)"
    },
    "originalShort": "➨ Hyster P2.0S ➨ Venta de Transpaleta Hyster nuevo ⭐Capacidad de carga de 2000 kg",
    "general": "La transpaleta eléctrica Hyster P2.0S incorpora plataforma para el conductor y está orientada al transporte horizontal de palés en recorridos de almacén de media distancia. La configuración motorizada facilita el movimiento de mercancías entre áreas de recepción y expedición. La capacidad nominal indicada es de 2.000 kg. La elevación publicada es de 0,12 metros. La ficha ofrece baterías de 24 V dentro de un intervalo de capacidades, por lo que no se atribuye una autonomía única. La elevación reducida sirve para despegar el palé del suelo, no para colocarlo en estanterías.",
    "revisedShort": "Transpaleta eléctrica con plataforma Hyster P2.0S de 2.000 kg."
  },
  "2144": {
    "url": "https://online.gamrentals.com/es/transpaletas-hyster/2144-transpaleta-hyster-p20uts",
    "title": "Transpaleta elevadora eléctrica Hyster P2.0UTS",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "P2.0UTS",
    "sourceHash": "4b91851ceadce7df5ffa79d3ba91207035eb46bfbe515ecdfc126000e0361dcc",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "P2.0UTS",
      "Peso": "710 KG",
      "Altura de elevación (m)": "0,202 metros",
      "Capacidad de carga (kg)": "2000 KG",
      "Capacidad de la batería": "24V / 210Ah(V/Ah)"
    },
    "originalShort": "➨ Hyster P2.0UTS ➨ Venta de Transpaleta Hyster nuevo ⭐Capacidad de carga de 2000 kg",
    "general": "La transpaleta eléctrica Hyster P2.0UTS está orientada al transporte horizontal de palés en almacenes y centros logísticos. Su funcionamiento con operario acompañante está pensado para operaciones repetidas de carga y descarga. La capacidad nominal indicada es de 2.000 kg. La elevación publicada es de 0,202 metros. La batería indicada es de 24 V y 210 Ah. La elevación limitada de las horquillas sirve para despegar el palé del suelo y trasladarlo; no equivale a un apilador para estanterías.",
    "revisedShort": "Transpaleta eléctrica a pie Hyster P2.0UTS de 2.000 kg."
  },
  "4625": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/4625-carretilla-elevadora-electrica-hyster-j18uttl",
    "title": "Carretilla elevadora eléctrica Hyster J1.8UTTL",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J1.8UTTL",
    "sourceHash": "96885b4506a1dff6f7c2d954727545636b9321f7d708447c6acda478792dad34",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J1.8UTTL",
      "Longitud": "2894 mm",
      "Anchura": "1084 mm",
      "Altura": "1992 mm",
      "Peso": "3190 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "1800 KG",
      "Radio de giro": "1601"
    },
    "originalShort": "➨ Hyster J1.8UTTL ➨ Venta de Carretilla elevadora eléctrica Hyster nuevo ⭐Capacidad de carga de 1800 kg",
    "general": "La Hyster J1.8UTTL es una carretilla elevadora eléctrica de tres ruedas para transportar palés y realizar carga y descarga en instalaciones industriales. Su formato compacto resulta útil cuando el espacio de giro condiciona la circulación. La capacidad nominal indicada es de 1.800 kg, con 2.894 mm de longitud y 1.084 mm de anchura. El origen recoge propulsión eléctrica y características de elevación que dependen del mástil seleccionado. La capacidad residual y las dimensiones de paso deben comprobarse con el equipo concreto, sin extrapolar datos de la J2.0UTTL.",
    "revisedShort": "Carretilla eléctrica de tres ruedas Hyster J1.8UTTL de 1.800 kg."
  },
  "6481": {
    "url": "https://online.gamrentals.com/es/hyster/6481-apilador-electrico-a-pie-hyster-sc15-sl",
    "title": "APILADOR ELÉCTRICO A PIE 1500KG HYSTER SC1.5 SL",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "SC1.5 SL",
    "sourceHash": "9f657b7a8c6bff6d4feb242e4a00fd88b2b7861526e6fc2559a834f8f2d31dac",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "SC1.5 SL",
      "Longitud": "1670 mm",
      "Anchura": "820 mm",
      "Altura": "2020 mm",
      "Peso": "660 KG",
      "Capacidad de carga (kg)": "1500 KG"
    },
    "originalShort": "➨ Hyster SC1.5 SL ➨ Venta de apilador eléctrico a pie compacto ⭐ Capacidad de carga de 1500 kg",
    "general": "El apilador a pie Hyster SC1.5 SL está orientado al traslado y apilado de palés en almacenes de tamaño reducido y zonas de expedición. Su estructura compacta favorece la circulación en pasillos donde debe verificarse el margen de maniobra. La capacidad nominal indicada es de 1.500 kg, con 1.670 mm de longitud y 820 mm de anchura. El proveedor ofrece distintas opciones de altura de elevación, sujetas al mástil instalado. La capacidad nominal no sustituye a la comprobación de la carga admisible en el nivel superior de estantería.",
    "revisedShort": "Apilador eléctrico Hyster SC1.5 SL de 1.500 kg para almacenes."
  },
  "1713": {
    "url": "https://online.gamrentals.com/es/apiladores-hyster/1713-apilador-doble-con-plataforma-hyster-s20sd",
    "title": "Apilador doble con plataforma Hyster S2.0SD",
    "categoryKey": "apiladores-nuevos",
    "brand": "HYSTER",
    "model": "S2.0SD",
    "sourceHash": "3ee80d2a2c849d3b3ba46f30277ba2f42deed4ca6ecea8a931d60832936bff61",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "S2.0SD",
      "Longitud": "2030 mm",
      "Anchura": "750 mm",
      "Altura": "1346 mm",
      "Capacidad de carga (kg)": "2000 KG"
    },
    "originalShort": "➨ Hyster S2.0SD ➨ Venta de apilador eléctrico de 2000 kg ⭐ Capacidad de carga de 2000 kg",
    "general": "El Hyster S2.0SD es un apilador eléctrico con plataforma de conducción y elevación inicial destinado a manipular dos palés durante operaciones logísticas. La descripción del fabricante distribuye su capacidad total entre dos cargas de hasta 1.000 kg cada una. La capacidad nominal indicada es de 2.000 kg, con 2.030 mm de longitud y 750 mm de anchura. Esta distribución de cargas no permite asumir 2.000 kg sobre una sola horquilla elevada. La pendiente admisible, la altura de elevación y la estabilidad deben verificarse en la configuración utilizada.",
    "revisedShort": "Apilador doble eléctrico Hyster S2.0SD con capacidad total de 2.000 kg."
  },
  "2012": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/2012-carretilla-elevadora-contrapesada-hyster-j16xnt",
    "title": "Carretilla elevadora eléctrica Hyster J1.6XNT",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J1.6XNT",
    "sourceHash": "b4255762e01aeb6e3373b0fbfca3d182bda5a7e193e357db2418bf47cd9a4622",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J1.6XNT",
      "Longitud": "2903 mm",
      "Anchura": "1050 mm",
      "Altura": "2230 mm",
      "Peso": "1494 KG",
      "Capacidad de carga (kg)": "1600 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1676mm",
      "Altura de elevación (mm)": "5500 mm"
    },
    "originalShort": "➨ Hyster J1.6XNT Nueva ➨ Venta de carretilla eléctrica Hyster J1.6XNT de 1600 kg",
    "general": "La carretilla elevadora eléctrica de tres ruedas Hyster J1.6XNT permite mover palés y realizar apilado en almacenes donde la maniobrabilidad es relevante. El proveedor describe diferentes configuraciones de batalla, por lo que las medidas de circulación requieren contrastarse con la versión concreta. La capacidad nominal indicada es de 1.600 kg, con 2.903 mm de longitud y 1.050 mm de anchura. La elevación publicada es de 5500 mm. La carga nominal debe verificarse a la altura de elevación y al centro de carga previstos. Su propulsión eléctrica permite utilizarla en interiores sin emisiones directas de combustión.",
    "revisedShort": "Carretilla elevadora eléctrica Hyster J1.6XNT de 1.600 kg."
  },
  "2013": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/2013-carretilla-elevadora-contrapesada-hyster-j18xnt",
    "title": "Carretilla elevadora eléctrica Hyster J1.8XNT",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J1.8XNT",
    "sourceHash": "3b604b572c0073abc36c6218a59390b3b4f3b41bb1b38f3fca9f51e2c5f9b40f",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J1.8XNT",
      "Longitud": "3006 mm",
      "Anchura": "1116 mm",
      "Altura": "2180 mm",
      "Peso": "1494 KG",
      "Capacidad de carga (kg)": "1800 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1676mm",
      "Capacidad de la batería": "48V / 750Ah(V/Ah)",
      "Altura de elevación (mm)": "5500 mm"
    },
    "originalShort": "➨ HYSTER J1.8XNT ➨ Venta de Carretilla Elevadora Contrapesada 5,5 metros ⭐Capacidad de carga de 1800 kg",
    "general": "La Hyster J1.8XNT es una carretilla eléctrica de tres ruedas para mover y elevar palés en almacenes y centros logísticos. Su configuración está orientada a maniobras de carga, descarga y colocación en estanterías. La capacidad nominal indicada es de 1.800 kg, con 3.006 mm de longitud y 1.116 mm de anchura. La elevación publicada es de 5500 mm. La ficha indica batería de 48 V y 750 Ah. El ancho de pasillo necesario, el centro de carga y la capacidad residual deben revisarse con el mástil instalado antes de operar a la altura nominal.",
    "revisedShort": "Carretilla eléctrica Hyster J1.8XNT de 1.800 kg y elevación de 5,5 m."
  },
  "2036": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/2036-carretilla-elevadora-electrica-hyster-j22xn",
    "title": "Carretilla elevadora eléctrica Hyster J2.2XN",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J2.2XN",
    "sourceHash": "9da98e5fc8fea0eb47ba508d3e7da995baf419d98f40a6361b22d320acde9eb9",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J2.2XN",
      "Longitud": "3336 mm",
      "Anchura": "1289 mm",
      "Altura": "2192 mm",
      "Capacidad de carga (kg)": "2200 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1981mm",
      "Motorización": "Eléctrico",
      "Altura de elevación (mm)": "6000 mm"
    },
    "originalShort": "➨ HYSTER J2.2XN ➨ Venta de Carretilla Elevadora Eléctrica 6 metros ⭐Capacidad de carga de 2200 kg",
    "general": "La carretilla elevadora eléctrica Hyster J2.2XN está concebida para manipular palés en almacenes, naves y operaciones de distribución. Su tracción de corriente alterna y la dirección permiten trabajar en recorridos con giros y reposiciones frecuentes. La capacidad nominal indicada es de 2.200 kg, con 3.336 mm de longitud y 1.289 mm de anchura. La elevación publicada es de 6000 mm. La altura de elevación publicada requiere comprobar la capacidad residual y la altura libre disponible. La autonomía depende de la batería montada y del ciclo de trabajo, por lo que no se fija una duración por turno.",
    "revisedShort": "Carretilla eléctrica Hyster J2.2XN de 2.200 kg y elevación de 6 m."
  },
  "2030": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/2030-carretilla-elevadora-electrica-hyster-j15ut",
    "title": "Carretilla elevadora eléctrica Hyster J1.5UT",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J1.5UT",
    "sourceHash": "92506e8b01044a8295ad7b4543b50535ea1d5316b76c291ce2712997e49693b3",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J1.5UT",
      "Longitud": "3026 mm",
      "Anchura": "1120 mm",
      "Altura": "2000 mm",
      "Peso": "3030 KG",
      "Capacidad de carga (kg)": "1500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1970mm",
      "Capacidad de la batería": "48V / 420Ah(V/Ah)",
      "Motorización": "Eléctrico",
      "Altura de elevación (mm)": "6000 mm"
    },
    "originalShort": "➨ HYSTER J1.5UT ➨ Venta de Carretilla Elevadora Eléctrica 6 metros ⭐Capacidad de carga de 1500 kg",
    "general": "La Hyster J1.5UT es una carretilla frontal eléctrica para el movimiento de palés en almacenes y muelles de carga. Su tamaño permite organizar maniobras de aproximación a estanterías y zonas de expedición. La capacidad nominal indicada es de 1.500 kg, con 3.026 mm de longitud y 1.120 mm de anchura. La elevación publicada es de 6000 mm. La ficha indica batería de 48 V y 420 Ah. El fabricante describe tracción y elevación eléctricas, pero la autonomía concreta dependerá del ciclo de trabajo y del estado de la batería. Deben revisarse pasillos, mástil y capacidad residual.",
    "revisedShort": "Carretilla elevadora Hyster J1.5UT eléctrica de 1.500 kg y 6 m."
  },
  "2011": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-hyster/2011-carretilla-elevadora-contrapesada-hyster-j15xnt",
    "title": "Carretilla elevadora eléctrica Hyster J1.5XNT",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J1.5XNT",
    "sourceHash": "9c6fd0f19da1df9e247cd973fde256e8e8656306172454fd3cbc87f0c15d0ba1",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J1.5XNT",
      "Longitud": "2807 mm",
      "Anchura": "1050 mm",
      "Altura": "2230 mm",
      "Peso": "2971 KG",
      "Capacidad de carga (kg)": "1500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1476mm",
      "Altura de elevación (mm)": "5500 mm"
    },
    "originalShort": "➨ Hyster J1.5XNT Nueva ➨ Venta de carretilla eléctrica Hyster J1.5XNT de 1500 kg",
    "general": "La carretilla eléctrica Hyster J1.5XNT de tres ruedas está destinada al manejo de palés en almacenes y plataformas logísticas con recorridos de maniobra frecuentes. Su configuración permite ubicar cargas en estanterías y desplazarlas entre zonas de recepción y expedición. La capacidad nominal indicada es de 1.500 kg, con 2.807 mm de longitud y 1.050 mm de anchura. La elevación publicada es de 5500 mm. El origen menciona batería de 48 V y 500 Ah, mientras que el apartado técnico no la fija; por ello debe verificarse la batería equipada antes de presupuestar la autonomía. También deben comprobarse los límites de carga con el mástil instalado.",
    "revisedShort": "Carretilla eléctrica Hyster J1.5XNT de 1.500 kg y elevación de 5,5 m."
  },
  "6990": {
    "url": "https://online.gamrentals.com/es/hyster/6990-transpaleta-electrica-hyster-pc20",
    "title": "Transpaleta eléctrica a pie 2000kg Hyster PC2.0",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "PC2.0",
    "sourceHash": "53f69e25f7a2f51c587b1d07e3cc11fadd93bd6a04d168d6eb6f9e5a6b3dc275",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "PC2.0",
      "Longitud": "1622 mm",
      "Anchura": "685 mm",
      "Altura": "1160 mm",
      "Peso": "120 KG",
      "Capacidad de carga (kg)": "2000 KG",
      "Radio de giro": "1426"
    },
    "originalShort": "➨ Hyster PC2.0 ➨ Venta de Transpaleta Hyster nuevo ⭐Capacidad de carga de 2000 kg",
    "general": "La transpaleta eléctrica Hyster PC2.0 permite levantar ligeramente los palés y trasladarlos entre áreas de almacén, recepción y expedición. Su timón y dimensiones reducidas están diseñados para desplazamientos horizontales con operario a pie. La capacidad nominal indicada es de 2.000 kg, con 1.622 mm de longitud y 685 mm de anchura. El proveedor ofrece distintas longitudes y anchuras de horquilla y baterías de 48 V de 10 o 15 Ah; estas opciones no se presentan como una configuración única. El equipo no sustituye a un apilador para almacenamiento en altura.",
    "revisedShort": "Transpaleta eléctrica a pie Hyster PC2.0 de 2.000 kg."
  }
};

export const resolveGamHysterCondensedGeneral = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort === record.shortDescription ? entry.general : null;
};

export const resolveGamHysterCondensedShort = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort === record.shortDescription ? entry.revisedShort ?? null : null;
};
