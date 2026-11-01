import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { verifyGamEditorialEvidence, type EditorialEvidence } from "./verified-condensed-general.js";

const evidence: Readonly<Record<string, EditorialEvidence>> = {
  "2243": {
    "url": "https://online.gamrentals.com/es/transpaletas-yale/2243-transpaleta-electrica-a-pie-yale-mp18",
    "title": "Transpaleta eléctrica a pie Yale MP18",
    "categoryKey": "marcas-nuevas",
    "brand": "YALE",
    "model": "MP18",
    "sourceHash": "12b250141e020bf894f7af187ce015bca9231e387d486a4b6875b07f10104148",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MP18",
      "Longitud": "1734 mm",
      "Anchura": "712 mm",
      "Altura": "85 mm",
      "Peso": "545 KG",
      "Capacidad de carga (kg)": "1800 KG",
      "Centro de carga": "130 mm",
      "Capacidad de la batería": "545",
      "Altura Plataforma": "24V / 150-375Ah | Li-ion 24V / 50-100Ah(V/Ah) metros",
      "Motorización": "Eléctrico"
    },
    "originalShort": "➨ Yale MP18 ➨ Venta de Transpaleta Eléctrica Yale nueva ⭐Capacidad de carga de 1800 kg",
    "general": "La transpaleta eléctrica a pie Yale MP18 está destinada al movimiento horizontal de palés, la carga y la descarga en almacenes y centros logísticos. Su formato de conductor acompañante facilita las maniobras cerca de muelles y pasillos de circulación. La ficha técnica recoge 1.800 kg de capacidad nominal, 1.734 mm de longitud, 712 mm de anchura y 85 mm de altura. La descripción distingue baterías de 24 V de plomo y alternativas de ion de litio con capacidades diferentes; no deben confundirse las variantes con el equipamiento de una unidad concreta.",
    "revisedShort": "Transpaleta eléctrica a pie Yale MP18 de 1.800 kg para manutención de palés."
  },
  "2245": {
    "url": "https://online.gamrentals.com/es/transpaletas-yale/2245-transpaleta-electrica-a-pie-yale-mp22",
    "title": "Transpaleta eléctrica a pie Yale MP22",
    "categoryKey": "marcas-nuevas",
    "brand": "YALE",
    "model": "MP22",
    "sourceHash": "d8b973b4412c57daf08434d91e6a962abfd4e363951a28ed35c77bdc14f5f978",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MP22",
      "Longitud": "1806 mm",
      "Anchura": "712 mm",
      "Altura": "85 mm",
      "Peso": "632 KG",
      "Capacidad de carga (kg)": "2200 KG",
      "Centro de carga": "130 mm",
      "Capacidad de la batería": "632",
      "Altura Plataforma": "24V / 150-375Ah (V/Ah) metros",
      "Motorización": "Eléctrico"
    },
    "originalShort": "➨ Yale MP22 ➨ Venta de Transpaleta Eléctrica Yale nueva ⭐Capacidad de carga de 2200 kg",
    "general": "La Yale MP22 es una transpaleta eléctrica de conductor acompañante para transportar cargas paletizadas entre áreas de recepción, almacenaje y expedición. Su diseño de baja elevación está concebido para desplazamientos horizontales, no para apilar en altura. La ficha técnica recoge 2.200 kg de capacidad nominal, 1.806 mm de longitud, 712 mm de anchura y 85 mm de altura. La ficha recoge alimentación de 24 V y distintas capacidades posibles de batería de plomo. La autonomía dependerá de la batería instalada y del ciclo de trabajo real.",
    "revisedShort": "Transpaleta a pie Yale MP22 eléctrica, con carga nominal de 2.200 kg."
  },
  "2250": {
    "url": "https://online.gamrentals.com/es/transpaletas-yale/2250-transpaleta-electrica-a-pie-yale-mp30x",
    "title": "Transpaleta eléctrica a pie Yale MP30X",
    "categoryKey": "marcas-nuevas",
    "brand": "YALE",
    "model": "MP30X",
    "sourceHash": "6269877ee14995b5ffc35de9c8368e25e8b4e194e3c06a8002ea7bcc2542441e",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MP30X",
      "Longitud": "1944 mm",
      "Anchura": "750 mm",
      "Altura": "85 mm",
      "Peso": "678 KG",
      "Capacidad de carga (kg)": "3000 KG",
      "Centro de carga": "120 mm",
      "Capacidad de la batería": "785",
      "Altura Plataforma": "24V / 315-500Ah(V/Ah) metros",
      "Motorización": "Eléctrico"
    },
    "originalShort": "➨ Yale MP30X ➨ Venta de Transpaleta Eléctrica Yale nueva ⭐Capacidad de carga de 3000 kg",
    "general": "La transpaleta eléctrica a pie Yale MP30X ofrece una capacidad nominal elevada para movimientos de palés pesados dentro de instalaciones logísticas. La dirección y tracción motorizadas ayudan en recorridos repetitivos y maniobras de aproximación a la carga. La ficha técnica recoge 3.000 kg de capacidad nominal, 1.944 mm de longitud, 750 mm de anchura y 85 mm de altura. La información comercial recoge baterías de 24 V con diferentes capacidades, por lo que no se atribuye una autonomía fija. Es necesario comprobar el estado del suelo y la carga por eje en cada recorrido.",
    "revisedShort": "Transpaleta eléctrica Yale MP30X a pie para cargas de hasta 3.000 kg."
  },
  "2246": {
    "url": "https://online.gamrentals.com/es/transpaletas-yale/2246-transpaleta-electrica-a-montado-yale-mp20t",
    "title": "Transpaleta eléctrica a montado Yale MP20T",
    "categoryKey": "marcas-nuevas",
    "brand": "YALE",
    "model": "MP20T",
    "sourceHash": "ea47e12d62efd006643db72978a95869436b730f56fc3d4c6a551cc3f0da5bc6",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MP20T",
      "Longitud": "1900 mm",
      "Anchura": "798 mm",
      "Altura": "85 mm",
      "Peso": "1010 KG",
      "Capacidad de carga (kg)": "2000 KG",
      "Centro de carga": "120 mm",
      "Capacidad de la batería": "1010",
      "Altura Plataforma": "24V / 465Ah(V/Ah) metros",
      "Motorización": "Eléctrico"
    },
    "originalShort": "➨ Yale MP20T ➨ Venta de Transpaleta Eléctrica Yale nueva ⭐Capacidad de carga de 2000 kg",
    "general": "La transpaleta eléctrica Yale MP20T incorpora un puesto de conductor montado para transportar palés en recorridos frecuentes de almacén. Su capacidad nominal es de 2.000 kg y su aplicación principal es la manutención horizontal. La ficha técnica recoge 2.000 kg de capacidad nominal, 1.900 mm de longitud, 798 mm de anchura y 85 mm de altura. La ficha indica alimentación de 24 V y batería de 465 Ah. Al planificar pasillos y muelles deben considerarse el puesto del conductor, las maniobras de giro y el peso total del equipo con la carga.",
    "revisedShort": "Transpaleta eléctrica con conductor montado Yale MP20T de 2.000 kg."
  },
  "2247": {
    "url": "https://online.gamrentals.com/es/transpaletas-yale/2247-transpaleta-electrica-a-montado-yale-mp25t",
    "title": "Transpaleta eléctrica a montado Yale MP25T",
    "categoryKey": "marcas-nuevas",
    "brand": "YALE",
    "model": "MP25T",
    "sourceHash": "bd3015b33c86524a183f4043c2c213b3822d00f0a493cf482f4d59d1576b5128",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MP25T",
      "Longitud": "1900 mm",
      "Anchura": "798 mm",
      "Altura": "85 mm",
      "Peso": "1010 KG",
      "Capacidad de carga (kg)": "2500 KG",
      "Centro de carga": "120 mm",
      "Capacidad de la batería": "1010",
      "Altura Plataforma": "24V / 465Ah(V/Ah) metros",
      "Motorización": "Eléctrico"
    },
    "originalShort": "➨ Yale MP25T ➨ Venta de Transpaleta Eléctrica Yale nueva ⭐Capacidad de carga de 2500 kg",
    "general": "La Yale MP25T es una transpaleta eléctrica con conductor a bordo, indicada para el movimiento de cargas paletizadas a lo largo de recorridos industriales. Su capacidad nominal de 2.500 kg permite dimensionar la tarea frente al peso de los palés. La ficha técnica recoge 2.500 kg de capacidad nominal, 1.900 mm de longitud, 798 mm de anchura y 85 mm de altura. La batería declarada es de 24 V y 465 Ah. Conviene revisar anchura de paso, zonas de cruce y superficie del suelo; esta configuración no sustituye a una carretilla para apilado vertical.",
    "revisedShort": "Transpaleta Yale MP25T eléctrica con conductor montado y carga de 2.500 kg."
  },
  "2227": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2227-carretilla-retractil-yale-mr10e",
    "title": "Carretilla retráctil Yale MR10E",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR10E",
    "sourceHash": "ef52e98185198ef2136b1895fb4579d4049da631512ff84266c233aec248a58b",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR10E",
      "Longitud": "2500 mm",
      "Anchura": "1125 mm",
      "Altura": "2191 mm",
      "Peso": "2845 KG",
      "Capacidad de carga (kg)": "1000 KG",
      "Capacidad de la batería": "48V / 280-620Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR10E ➨ Venta de Carretilla Retráctil nueva ⭐Capacidad de carga de 1000 kg",
    "general": "La carretilla retráctil Yale MR10E está orientada al almacenamiento de palés en estanterías y a la recuperación de cargas en pasillos de almacén. El mecanismo retráctil permite acercar el mástil a la máquina durante determinadas maniobras. La ficha técnica recoge 1.000 kg de capacidad nominal, 2.500 mm de longitud, 1.125 mm de anchura y 2.191 mm de altura. La ficha menciona baterías de 48 V en un intervalo de capacidades, según la configuración. La altura de elevación útil y la capacidad residual deben comprobarse con el mástil efectivamente instalado.",
    "revisedShort": "Carretilla retráctil Yale MR10E de 1.000 kg para almacenamiento interior."
  },
  "2228": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2228-carretilla-retractil-yale-mr12e",
    "title": "Carretilla retráctil Yale MR12E",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR12E",
    "sourceHash": "36325a3a0d050a5c442afb84b3b7c87cd07ce9f02ba94881484185a38bba6991",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR12E",
      "Longitud": "2500 mm",
      "Anchura": "1125 mm",
      "Altura": "2191 mm",
      "Peso": "2845 KG",
      "Capacidad de carga (kg)": "1200 KG",
      "Capacidad de la batería": "48V / 280-620Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR12E ➨ Venta de Carretilla Retráctil nueva ⭐Capacidad de carga de 1200 kg",
    "general": "La Yale MR12E es una carretilla retráctil eléctrica de 1.200 kg para manejo de palés en almacenes con estanterías. El desplazamiento del conjunto de elevación contribuye a organizar las maniobras de aproximación y retirada de carga. La ficha técnica recoge 1.200 kg de capacidad nominal, 2.500 mm de longitud, 1.125 mm de anchura y 2.191 mm de altura. El proveedor contempla baterías de 48 V con capacidades variables. Antes de seleccionar la unidad deben verificarse anchura de pasillo, altura del mástil y capacidad admisible a la cota de trabajo.",
    "revisedShort": "Retráctil eléctrica Yale MR12E, capacidad nominal de 1.200 kg."
  },
  "2230": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2230-carretilla-retractil-yale-mr14",
    "title": "Carretilla retráctil Yale MR14",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR14",
    "sourceHash": "2cfdde1e052d09fe4066937b64b5a721245aaf5f993222c3d5439bc2b7c7170b",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR14",
      "Longitud": "2523 mm",
      "Anchura": "1265 mm",
      "Altura": "2195 mm",
      "Peso": "6861 KG",
      "Capacidad de carga (kg)": "1400 KG",
      "Capacidad de la batería": "48V / 280-620Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR14 ➨ Venta de Carretilla Retráctil Yale nueva ⭐Capacidad de carga de 1400 kg",
    "general": "La carretilla retráctil Yale MR14 se emplea en operaciones de recepción, ubicación y reposición de mercancía paletizada en estanterías. Con una capacidad nominal de 1.400 kg, combina desplazamiento interior y maniobras de elevación. La ficha técnica recoge 1.400 kg de capacidad nominal, 2.523 mm de longitud, 1.265 mm de anchura y 2.195 mm de altura. La alimentación publicada es de 48 V y la capacidad de batería varía entre configuraciones. Las dimensiones de paso y la capacidad residual del mástil se deben contrastar antes del uso.",
    "revisedShort": "Carretilla retráctil Yale MR14 de 1.400 kg para estanterías."
  },
  "2231": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2231-carretilla-retractil-yale-mr16",
    "title": "Carretilla retráctil Yale MR16",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR16",
    "sourceHash": "0be3cdfb325d08430ef142826868ee3f8b8b0b59ef0bd33ef0ad274e4a8016b2",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR16",
      "Longitud": "2523 mm",
      "Anchura": "1265 mm",
      "Altura": "2195 mm",
      "Peso": "6971 KG",
      "Capacidad de carga (kg)": "1600 KG",
      "Capacidad de la batería": "48V / 420-775Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR16 ➨ Venta de Carretilla Retráctil Yale nueva ⭐Capacidad de carga de 1600 kg",
    "general": "La Yale MR16 es una carretilla retráctil destinada al apilado de palés y su retirada en instalaciones de almacenaje. Su capacidad nominal es de 1.600 kg y su configuración facilita situar la carga en posiciones elevadas. La ficha técnica recoge 1.600 kg de capacidad nominal, 2.523 mm de longitud, 1.265 mm de anchura y 2.195 mm de altura. La ficha anuncia batería de 48 V con varias capacidades posibles. El rendimiento en un pasillo concreto requiere verificar radio de maniobra, mástil y altura libre disponible, sin extrapolar datos de otros modelos MR.",
    "revisedShort": "Retráctil Yale MR16 eléctrica, 1.600 kg de capacidad nominal."
  },
  "2233": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2233-carretilla-retractil-yale-mr16n",
    "title": "Carretilla retráctil Yale MR16N",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR16N",
    "sourceHash": "aa76200a39f188a05fe08eda29f5e7d72164469767586fa123499ec7cbf4190d",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR16N",
      "Longitud": "2629 mm",
      "Anchura": "1125 mm",
      "Altura": "2195 mm",
      "Peso": "6859 KG",
      "Capacidad de carga (kg)": "1600 KG",
      "Capacidad de la batería": "48V / 420-775Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR16N➨ Venta de Carretilla Retráctil Yale nueva ⭐Capacidad de carga de 1600 kg",
    "general": "La Yale MR16N es una carretilla retráctil eléctrica para manipular palés en pasillos de almacén y zonas de estanterías. Su ficha la identifica con una capacidad nominal de 1.600 kg, distinta de las versiones MR16 sin sufijo. La ficha técnica recoge 1.600 kg de capacidad nominal, 2.629 mm de longitud, 1.125 mm de anchura y 2.195 mm de altura. La alimentación descrita es de 48 V y se ofrecen capacidades de batería alternativas. La selección depende de la anchura disponible, del mástil y del peso admisible a la altura necesaria.",
    "revisedShort": "Carretilla retráctil Yale MR16N de 1.600 kg para almacenes."
  },
  "2234": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2234-carretilla-retractil-yale-mr20",
    "title": "Carretilla retráctil Yale MR20",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR20",
    "sourceHash": "ddc5905930a613318748f79ccd41ffe95174f25a827019b6ca94bd2a51329bb3",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR20",
      "Longitud": "2538 mm",
      "Anchura": "1265 mm",
      "Altura": "2195 mm",
      "Peso": "7970 KG",
      "Capacidad de carga (kg)": "2000 KG",
      "Capacidad de la batería": "48V / 560-775Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR20 ➨ Venta de Carretilla Retráctil Yale nueva ⭐Capacidad de carga de 2000 kg",
    "general": "La carretilla retráctil Yale MR20 está pensada para la ubicación y extracción de cargas paletizadas en estanterías de centros logísticos. Declara 2.000 kg de capacidad nominal para movimientos de manutención interior. La ficha técnica recoge 2.000 kg de capacidad nominal, 2.538 mm de longitud, 1.265 mm de anchura y 2.195 mm de altura. El catálogo indica un sistema de batería de 48 V con capacidades alternativas. Conviene contrastar el límite de carga a la altura prevista y las dimensiones de paso del mástil elegido.",
    "revisedShort": "Retráctil Yale MR20 eléctrica con capacidad nominal de 2.000 kg."
  },
  "2235": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2235-carretilla-retractil-yale-mr20hd",
    "title": "Carretilla retráctil Yale MR20HD",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR20HD",
    "sourceHash": "0612190d6de4ccdd8bb9dd8b2bf9c4718ba9079e87344d6456d38abaa65d2b84",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR20HD",
      "Longitud": "2615 mm",
      "Anchura": "1273 mm",
      "Peso": "9755 KG",
      "Capacidad de carga (kg)": "2000 KG",
      "Capacidad de la batería": "48V / 700-930Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR20HD ➨ Venta de Carretilla Retráctil Yale nueva ⭐Capacidad de carga de 2000 kg",
    "general": "La retráctil Yale MR20HD está dirigida a operaciones de almacenaje intensivo con cargas paletizadas. Su versión HD se identifica por separado de la MR20 convencional y declara una capacidad nominal de 2.000 kg. La ficha técnica recoge 2.000 kg de capacidad nominal, 2.615 mm de longitud, 1.273 mm de anchura. La ficha ofrece alimentación de 48 V con distintas capacidades de batería; no fija la autonomía para una unidad concreta. Deben verificarse la altura del mástil, la capacidad residual y la circulación con carga.",
    "revisedShort": "Carretilla retráctil Yale MR20HD de 2.000 kg para almacenes."
  },
  "2236": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/2236-carretilla-retractil-yale-mr25",
    "title": "Carretilla retráctil Yale MR25",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR25",
    "sourceHash": "257c228ed1a5f4e64e0f98108dfbf4c61da2a3692d0429c08455ee94cc02efa2",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR25",
      "Longitud": "2615 mm",
      "Anchura": "1345 mm",
      "Altura": "2195 mm",
      "Peso": "8902 KG",
      "Capacidad de carga (kg)": "2500 KG",
      "Capacidad de la batería": "48V / 700-930Ah(V/Ah)"
    },
    "originalShort": "➨ Yale MR25 ➨ Venta de Carretilla Retráctil Yale nueva ⭐Capacidad de carga de 2500 kg",
    "general": "La Yale MR25 es una carretilla retráctil de 2.500 kg de capacidad nominal, orientada a la ubicación y recuperación de palés en estanterías industriales. Su diseño de mástil retráctil requiere maniobras específicas en la entrada a la posición de carga. La ficha técnica recoge 2.500 kg de capacidad nominal, 2.615 mm de longitud, 1.345 mm de anchura y 2.195 mm de altura. Las baterías anunciadas son de 48 V con varias capacidades disponibles. Es importante confirmar tanto el ancho de pasillo como la capacidad residual a la elevación prevista.",
    "revisedShort": "Carretilla retráctil Yale MR25 eléctrica de 2.500 kg."
  },
  "3001": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-yale/3001-carretilla-retractil-yale-mr10-",
    "title": "Carretilla retráctil Yale MR10 1000Kg",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MR10",
    "sourceHash": "6b9b4e3d606ddb0d80d0f95c3612a2dbe679789c06ad79d0240443310f4c78ae",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MR10",
      "Longitud": "2500 mm",
      "Altura": "2191 mm",
      "Peso": "2845 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "1000 KG",
      "Altura mástil replegado": "2191 mm",
      "Altura de elevación (mm)": "5000 mm"
    },
    "originalShort": "➨ Yale MR10 ➨ Venta de Carretilla Retráctil 5 metros nueva ⭐Capacidad de carga de 1000 kg",
    "general": "La carretilla retráctil eléctrica Yale MR10 está destinada a mover y elevar palés en instalaciones de almacenaje. El sistema retráctil facilita el acercamiento del conjunto de elevación a la estructura de estanterías. La ficha técnica recoge 1.000 kg de capacidad nominal, 2.500 mm de longitud y 2.191 mm de altura. La ficha especifica 5.000 mm de elevación y 2.191 mm de altura de mástil replegado. La carga máxima declarada debe revisarse junto con la curva de capacidad a la altura y el tipo de mástil.",
    "revisedShort": "Carretilla retráctil Yale MR10 de 1.000 kg y 5 m de elevación."
  },
  "2264": {
    "url": "https://online.gamrentals.com/es/carretillas-trilaterales-yale/2264-tractor-electrico-yale-mtc13-48v",
    "title": "Carretilla trilateral 1300Kg Yale MTC13-48V",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MTC13-48V",
    "sourceHash": "99d50f43b31bf8e9010b373cf218b920f55a9245d3f969957012ed9ef6fbe540",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MTC13-48V",
      "Longitud": "3698 mm",
      "Altura": "3990 mm",
      "Peso": "8014 KG",
      "Capacidad de carga (kg)": "1300 KG",
      "Motorización": "Eléctrico"
    },
    "originalShort": "➨ YALE MTC13-48V ➨ Venta de Carretilla trilateral nueva ⭐Capacidad de carga de 1300 kg",
    "general": "La carretilla trilateral eléctrica Yale MTC13-48V se utiliza para colocar y retirar palés en estanterías de almacenes de pasillo estrecho. Su sistema de manejo de carga permite trabajar lateralmente respecto al sentido de marcha, según la configuración. La ficha técnica recoge 1.300 kg de capacidad nominal, 3.698 mm de longitud y 3.990 mm de altura. La ficha declara una capacidad nominal de 1.300 kg; la capacidad residual en niveles altos y las dimensiones del pasillo deberán comprobarse con el equipo concreto.",
    "revisedShort": "Carretilla trilateral Yale MTC13-48V eléctrica de 1.300 kg."
  },
  "2265": {
    "url": "https://online.gamrentals.com/es/carretillas-trilaterales-yale/2265-tractor-electrico-yale-mtc13-80v",
    "title": "Carretilla trilateral 1300Kg Yale MTC13-80V",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MTC13-80V",
    "sourceHash": "ac41e3eff2832ca5658ee81a63d7c243aa77875d196662bb3e6645371a98605e",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MTC13-80V",
      "Peso": "6702 KG",
      "Capacidad de carga (kg)": "1300 KG",
      "Capacidad de la batería": "80V / 420Ah(V/Ah)",
      "Altura Plataforma": "9225 metros",
      "Motorización": "Eléctrico"
    },
    "originalShort": "➨ YALE MTC13-80V ➨ Venta de Carretilla trilateral nueva ⭐Capacidad de carga de 1300 kg",
    "general": "La Yale MTC13-80V es una carretilla trilateral eléctrica para almacenaje en altura y manutención de palés en pasillos estrechos. Sus funciones de posicionamiento de carga requieren un diseño de pasillos y guiado compatible. La ficha técnica recoge 1.300 kg de capacidad nominal. La ficha indica 1.300 kg de capacidad nominal y una batería declarada de 80 V y 420 Ah. La cifra de altura indicada en el origen no debe interpretarse sin comprobar sus unidades y el mástil instalado.",
    "revisedShort": "Carretilla trilateral eléctrica Yale MTC13-80V de 1.300 kg."
  },
  "2288": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-yale/2288-carretilla-frontal-electrica-yale-erp25ux",
    "title": "Carretilla elevadora eléctrica 2500Kg Yale ERP25UX",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP25UX",
    "sourceHash": "585acbc76c4dd720ea1a36f1704b93f371a161d1f6979897addb1cde9f7ba3d9",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP25UX",
      "Longitud": "3387 mm",
      "Anchura": "1285 mm",
      "Altura": "2015 mm",
      "Peso": "4226 KG",
      "Capacidad de carga (kg)": "2500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "389 / 4009",
      "Capacidad de la batería": "48V / 600Ah(V/Ah)",
      "Motorización": "Eléctrico",
      "Altura de elevación (mm)": "6000 mm"
    },
    "originalShort": "➨ YALE ERP25UX ➨ Venta de Carretilla Elevadora Eléctrica 6 metros nueva ⭐Capacidad de carga de 2500 kg",
    "general": "La Yale ERP25UX es una carretilla elevadora eléctrica frontal, indicada para carga y descarga de camiones y traslado de palés en instalaciones industriales. La capacidad nominal de 2.500 kg corresponde a las condiciones indicadas por el fabricante. La ficha técnica recoge 2.500 kg de capacidad nominal, 3.387 mm de longitud, 1.285 mm de anchura y 2.015 mm de altura. El catálogo declara elevación de 6.000 mm y una batería de 48 V y 600 Ah. Conviene confirmar el centro de carga y la capacidad residual del mástil antes de trabajar a altura máxima.",
    "revisedShort": "Carretilla frontal eléctrica Yale ERP25UX, 2.500 kg y 6 m de elevación."
  },
  "2290": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-yale/2290-carretilla-frontal-electrica-yale-erp35ux",
    "title": "Carretilla elevadora eléctrica 3500Kg Yale ERP35UX",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP35UX",
    "sourceHash": "994b3f7a9698f8116b13086e3859ca582b2d55b816ea36ed132422e137c593e2",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP35UX",
      "Longitud": "3759 mm",
      "Anchura": "1365 mm",
      "Altura": "2120 mm",
      "Peso": "5310 KG",
      "Capacidad de carga (kg)": "3500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "4101 / 4301",
      "Capacidad de la batería": "80V / 500Ah(V/Ah)",
      "Motorización": "Eléctrico",
      "Altura de elevación (mm)": "6000 mm"
    },
    "originalShort": "➨ YALE ERP35UX ➨ Venta de Carretilla Elevadora Eléctrica 6 metros nueva ⭐Capacidad de carga de 3500 kg",
    "general": "La carretilla frontal Yale ERP35UX utiliza propulsión eléctrica para tareas de manutención de mercancía paletizada en almacenes y plantas industriales. Su capacidad nominal alcanza 3.500 kg, con centro de carga declarado de 500 mm. La ficha técnica recoge 3.500 kg de capacidad nominal, 3.759 mm de longitud, 1.365 mm de anchura y 2.120 mm de altura. La ficha indica un mástil de hasta 6.000 mm y batería de 80 V y 500 Ah. El movimiento de cargas elevadas exige comprobar límites de estabilidad y capacidad residual según la configuración.",
    "revisedShort": "Carretilla eléctrica Yale ERP35UX de 3.500 kg y 6 m de elevación."
  },
  "2218": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-yale/2218-carretilla-frontal-electrica-yale-erp13vc",
    "title": "Carretilla elevadora eléctrica 1300Kg Yale ERP13VC",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP13VC",
    "sourceHash": "8cd7585753d9af51124aad528b60848a56839798597a57a5e0e34c43237954b8",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP13VC",
      "Longitud": "2724 mm",
      "Anchura": "1056 mm",
      "Altura": "2230 mm",
      "Peso": "2700 KG",
      "Capacidad de carga (kg)": "1300 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "1398",
      "Ancho promedio": "24V / 735-875Ah(V/Ah)",
      "Motorización": "Eléctrico",
      "Altura de elevación (mm)": "5500 mm"
    },
    "originalShort": "➨ YALE ERP13VC ➨ Venta de Carretilla Elevadora Eléctrica 5,5 metros nueva ⭐Capacidad de carga de 1300 kg",
    "general": "La Yale ERP13VC es una carretilla eléctrica compacta para operaciones de carga, descarga y reposición en almacenes con espacios de maniobra limitados. La ficha declara 1.300 kg de capacidad nominal con centro de carga de 500 mm. La ficha técnica recoge 1.300 kg de capacidad nominal, 2.724 mm de longitud, 1.056 mm de anchura y 2.230 mm de altura. La altura de elevación indicada es de 5.500 mm. La capacidad de batería aparece en un campo del origen con etiqueta inconsistente, por lo que no se traslada como dato energético confirmado.",
    "revisedShort": "Carretilla eléctrica Yale ERP13VC, 1.300 kg y 5,5 m de elevación."
  },
  "3142": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadora-diesel-yale/3142-carretilla-elevadora-diesel-yale-gp50ux",
    "title": "Carretilla elevadora diésel Yale GP50UX",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "GP50UX",
    "sourceHash": "9d511f9e96d922d9a5e1a2855d36be4f18a8260f8d90f4b441f46ffad88b5409",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "GP50UX",
      "Longitud": "4345 mm",
      "Anchura": "1924 mm",
      "Altura": "2250 mm",
      "Peso": "7010 KG",
      "Tipo motor": "Diésel",
      "Capacidad de carga (kg)": "5000 KG",
      "Centro de carga": "500 mm",
      "Altura de elevación (mm)": "4200 mm"
    },
    "originalShort": "➨ Yale GP50UX NUEVA ➨ Venta de Carretilla Elevadora Diésel 4,2 metros ⭐Capacidad de carga de 5000 kg",
    "general": "La carretilla elevadora diésel Yale GP50UX está destinada al movimiento de cargas paletizadas pesadas en patios y operaciones industriales. La ficha indica 5.000 kg de capacidad nominal a un centro de carga de 500 mm. La ficha técnica recoge 5.000 kg de capacidad nominal, 4.345 mm de longitud, 1.924 mm de anchura y 2.250 mm de altura. El equipo requiere condiciones de ventilación adecuadas por su motorización de combustión. Antes de apilar deben verificarse altura útil, capacidad del mástil, firme y dimensiones de circulación.",
    "revisedShort": "Carretilla diésel Yale GP50UX, 5.000 kg y elevación de 4,2 m."
  }
};

export const resolveGamWarehouseCondensedGeneral = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort === record.shortDescription ? entry.general : null;
};

export const resolveGamWarehouseCondensedShort = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort === record.shortDescription ? entry.revisedShort ?? null : null;
};
