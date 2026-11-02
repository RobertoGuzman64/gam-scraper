import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";

type Evidence = Readonly<{
  source: Readonly<Pick<ProductRecord,
    "url" | "title" | "brand" | "model" | "year" | "condition" | "shortDescription" | "longDescription">> &
    { readonly specs: SpecsMap };
  general: string;
}>;

const evidence = {
  "OR1537": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/oruga/socage-15s/",
      "title": "SOCAGE 15S",
      "brand": "Socage",
      "model": "15S",
      "year": "2023",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "La Oruga Socage 15S es una plataforma elevadora todoterreno de 15 metros de altura, ideal para trabajos en terrenos difíciles gracias a sus orugas y diseño compacto.",
      "specs": {
        "Altura plataforma": "13 m",
        "Altura de trabajo": "15 m",
        "Alcance lateral": "7 m",
        "Altura almacenaje": "1.99 m",
        "Longitud": "4.54 m",
        "Anchura": "1.39 m",
        "Peso": "2300 kg",
        "Motor": "Eléctrico, Gasolina",
        "Capacidad": "225 kg"
      }
    },
    "general": "La plataforma sobre orugas Socage 15S figura como equipo de ocasión del año 2023. El proveedor declara 15 m de altura de trabajo, 7 m de alcance lateral y 225 kg de capacidad. Sus dimensiones de 4,54 m de longitud y 1,39 m de anchura, junto con los 2.300 kg de peso, permiten valorar el acceso y el transporte de esta unidad. La ficha identifica una motorización combinada eléctrica y de gasolina; no se atribuye una configuración distinta."
  },
  "FR1077": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/limpieza/fregadora/nilfisk-br850-s-fregadora/",
      "title": "Nilfisk BR850-S",
      "brand": "Nilfisk",
      "model": "BR850-S",
      "year": null,
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las fregadoras son máquinas que limpian suelos con agua, detergente y cepillos, aspirando el agua sucia para dejar la superficie seca. Se usan en grandes espacios y pueden ser manuales o motorizadas.",
      "specs": {
        "Altura": "1.35 m",
        "Longitud": "1.55 m",
        "Anchura": "0.88 m",
        "Peso": "705 kg",
        "Motor": "Eléctrico",
        "Anchura limpieza": "0.81 m"
      }
    },
    "general": "La Nilfisk BR850-S es una fregadora industrial de segunda mano destinada a la limpieza de suelos. La ficha técnica del proveedor recoge 0,81 m de anchura de limpieza y motorización eléctrica. El equipo mide 1,55 m de longitud y 0,88 m de anchura, con un peso declarado de 705 kg. Estas medidas describen la unidad anunciada y resultan útiles para evaluar el paso por accesos y el espacio de operación; el anuncio no especifica el año."
  },
  "DU473": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/dumper/ausa-d201rs/",
      "title": "Ausa D201RS",
      "brand": "Ausa",
      "model": "D201RS",
      "year": "2007",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Un vehículo dúmper es un tipo de cargadora pequeña autovolquete que se utiliza para el transporte de materiales. Se llama así al camión volquete de grandes ruedas y caja de carga basculante que puede depositar la carga en el lugar deseado.",
      "specs": {
        "Longitud": "3.98 m",
        "Anchura": "1.75 m, 1.59 m",
        "Peso": "1600 kg",
        "Motor": "Diésel",
        "Capacidad": "2000 kg"
      }
    },
    "general": "El dúmper Ausa D201RS se ofrece como unidad de ocasión con año indicado 2007. La ficha del proveedor le asigna un motor diésel y una capacidad de 2.000 kg; además, declara 3,98 m de longitud y 1.600 kg de peso. Se trata de datos de la máquina anunciada, más precisos que la descripción genérica del tipo de vehículo. Conviene comprobar las condiciones de trabajo y el espacio disponible a partir de las medidas publicadas, sin atribuirle otras configuraciones."
  },
  "GR1113": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/generador/himoinsa-hfw-605t-generador-generator/",
      "title": "Himoinsa HFW-605T",
      "brand": "Himoinsa",
      "model": "HFW-605T",
      "year": "2006",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las torres de iluminación son remolcables y regulables en altura para optimizar el área de iluminación. Tenemos con generador integrado que son energéticamente autosuficientes. Tenemos que funcionan con gasoil y otras que son mixtas baterías y gasoil. Dependiendo de donde vayas a trabajar, solución a medida.",
      "specs": {
        "Altura almacenaje": "1.76 m",
        "Longitud": "2.75m",
        "Anchura": "1.10 m",
        "Peso": "1786kg",
        "Potencia": "60kVA"
      }
    },
    "general": "El Himoinsa HFW-605T está identificado como generador de ocasión y lleva indicado el año 2006. Su ficha consigna 60 kVA de potencia y un peso de 1.786 kg. Las dimensiones facilitadas son 2,75 m de longitud y 1,10 m de anchura, con 1,76 m en el campo de altura de almacenaje. Estos son los datos publicados para el generador concreto; la descripción general de torres de iluminación del anuncio no acredita que esta unidad sea una torre de luz."
  },
  "BA1358": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/jlg-340aj/",
      "title": "JLG 340AJ",
      "brand": "JLG",
      "model": "340AJ",
      "year": "2012",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.",
      "specs": {
        "Altura": "12 metros",
        "Altura de trabajo": "12.33 m",
        "Alcance lateral": "6.71 m",
        "Altura almacenaje": "2 m",
        "Longitud": "5.52 m",
        "Anchura": "1.93 m",
        "Peso": "4450 kg",
        "Capacidad": "230 kg"
      }
    },
    "general": "La plataforma articulada JLG 340AJ, anunciada con año 2012, registra en la ficha 12,33 m de altura de trabajo y 6,71 m de alcance lateral. La capacidad indicada es de 230 kg. Sus dimensiones publicadas son 5,52 m de longitud, 1,93 m de anchura y 2 m de altura de almacenaje, con un peso de 4.450 kg. La descripción del proveedor menciona la familia de articuladas diésel, pero la motorización individual no consta en el campo técnico de esta unidad."
  },
  "BA1522": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/jlg-340aj-brazo-articulado-articulated-boom-lift-4wd-5/",
      "title": "JLG 340AJ",
      "brand": "JLG",
      "model": "340AJ",
      "year": "2012",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.",
      "specs": {
        "Altura": "12 metros",
        "Altura de trabajo": "12.33 m",
        "Alcance lateral": "6.71 m",
        "Altura almacenaje": "2 m",
        "Longitud": "5.52 m",
        "Anchura": "1.93 m",
        "Peso": "4450 kg",
        "Capacidad": "230 kg"
      }
    },
    "general": "La unidad JLG 340AJ con referencia BA1522 es una plataforma articulada de ocasión y año indicado 2012. Según la ficha del proveedor, alcanza 12,33 m de altura de trabajo, con 6,71 m de alcance lateral y 230 kg de capacidad. Tiene 5,52 m de longitud, 1,93 m de anchura y 4.450 kg de peso declarados. La descripción de origen habla de articuladas diésel como familia; el dato de motor no está individualizado en las especificaciones de esta referencia."
  },
  "RO1197": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/rodillo/rodillo-bombag-bw80ad-movimiento-de-tierras-demolicion-compactacion/",
      "title": "Bombag BW80AD-2",
      "brand": "Bombag",
      "model": "BW80AD-2",
      "year": "2007",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "El rodillo compactador en tándem tiene doble tambor vibratorio y no lleva neumático de tracción, como sí ocurre con los rodillos lisos de un solo tambor. Este tipo se utiliza generalmente para compactar capas de asfalto sin dejar marcas.",
      "specs": {
        "Altura almacenaje": "2.30 m",
        "Longitud": "1.86 m",
        "Anchura": "0.86 m",
        "Peso": "1335 kg",
        "Motor": "Diésel"
      }
    },
    "general": "El rodillo Bombag BW80AD-2 aparece como máquina de compactación de ocasión del año 2007. La descripción de origen se refiere al funcionamiento de los rodillos tándem; para esta unidad, la ficha técnica indica motorización diésel, 1,86 m de longitud y 0,86 m de anchura. También recoge 2,30 m de altura de almacenaje y un peso de 1.335 kg. Estas medidas permiten valorar su transporte y maniobrabilidad, sin inferir características no especificadas para el equipo anunciado."
  },
  "TO1241": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/energia-electrica-e-iluminacion/torre-de-luz/generac-vb9-torre-de-luz-light-tower-1/",
      "title": "GENERAC VB9",
      "brand": "Generac",
      "model": "VB9",
      "year": "2015",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las torres de iluminación son remolcables y regulables en altura para optimizar el área de iluminación. Tenemos con generador integrado que son energéticamente autosuficientes. Tenemos que funcionan con gasoil y otras que son mixtas baterías y gasoil. Dependiendo de donde vayas a trabajar, solución a medida.",
      "specs": {
        "Altura de trabajo": "8.50 m",
        "Alcance lateral": "0 m",
        "Longitud": "2.40 m",
        "Anchura": "1.43 m",
        "Peso": "945 kg",
        "Motor": "Diésel",
        "Potencia": "4 x 120W"
      }
    },
    "general": "La torre de iluminación Generac VB9 se anuncia como unidad de ocasión con año indicado 2015. Su ficha técnica declara 8,50 m de altura de trabajo, un motor diésel y una potencia indicada como 4 × 120 W. El conjunto mide 2,40 m de longitud y 1,43 m de anchura, con un peso de 945 kg. La descripción original habla de distintas torres y alimentaciones posibles; los datos aquí recogidos corresponden exclusivamente a esta referencia."
  },
  "CC1665": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/camion-plataforma/socage-iveco-forste-18t-speed/",
      "title": "SOCAGE IVECO FORSTE 18T SPEED",
      "brand": null,
      "model": null,
      "year": "2024",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Los Camiones Cesta es la solución perfecta para realizar trabajos de exterior ya que agilizan las tareas en cuestiones de altura, ofreciendo un rango de elevación de 13m a 20m. La ventaja es que para conducirlas, únicamente es necesario el carnet de vehículos B.",
      "specs": {
        "Altura plataforma": "15.7 m",
        "Altura de trabajo": "17.7 m",
        "Alcance lateral": "10.50 m",
        "Altura almacenaje": "2.94 m",
        "Longitud": "7.18 m",
        "Anchura": "2.20 m",
        "Peso": "3500 kg",
        "Motor": "Diésel",
        "Capacidad": "300 kg"
      }
    },
    "general": "El camión plataforma Socage Iveco Forste 18T Speed se anuncia con año 2024. La ficha del proveedor declara 17,7 m de altura de trabajo y 10,50 m de alcance lateral, con una capacidad de 300 kg. Se indican 7,18 m de longitud, 2,20 m de anchura, 2,94 m de altura de almacenaje y 3.500 kg de peso. La motorización consignada es diésel. Estas especificaciones permiten valorar el espacio necesario y el alcance declarado de la unidad anunciada."
  },
  "CAE1207": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-industrial/nissan-q02l25cu-carretilla-industrial/",
      "title": "Nissan Q02L25CU",
      "brand": "Nissan",
      "model": "Q02L25CU",
      "year": "2007",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Indicadas especialmente para el almacenaje y trabajos realizados en el interior de los edificios. Gracias a propulsión eléctrica no contaminan el aire con gases de escape y trabajan muy silencioso.",
      "specs": {
        "Altura almacenaje": "2.23 m",
        "Longitud": "2.37 m",
        "Anchura": "1.18 m",
        "Peso": "7205 kg",
        "Motor": "Eléctrico",
        "Capacidad": "2500 kg"
      }
    },
    "general": "La carretilla industrial Nissan Q02L25CU de ocasión figura con año indicado 2007. La ficha técnica consigna una capacidad de 2.500 kg y motorización eléctrica. Sus dimensiones publicadas son 2,37 m de longitud, 1,18 m de anchura y 2,23 m de altura de almacenaje. Son medidas concretas para verificar accesos y condiciones de uso, en lugar de atribuir a este modelo todas las características de una descripción genérica de carretillas para interiores. El peso declarado debe interpretarse según la ficha de origen."
  },
  "CA1041": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-industrial/toyota-8fd20-2/",
      "title": "TOYOTA 8FD20",
      "brand": "Toyota",
      "model": "8FD20",
      "year": "2013",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Máquinas destinadas al trabajo en cualquier condición, existen modelos con propulsión 4×4. El motor diésel les proporciona suficientemente potencia para manejar cargas más grandes, disponemos con unidades con hasta 7.000kg de capacidad. Máquinas muy versátiles y útil para cualquier empresa.",
      "specs": {
        "Altura de trabajo": "3.50 m",
        "Altura almacenaje": "2.11 m",
        "Longitud": "2.56 m",
        "Anchura": "1.15 m",
        "Peso": "3310 kg",
        "Motor": "Diésel",
        "Capacidad": "2000 kg"
      }
    },
    "general": "La carretilla industrial Toyota 8FD20, anunciada como equipo de ocasión del año 2013, dispone de un motor diésel según la ficha. La capacidad declarada es de 2.000 kg y la altura consignada en el campo de trabajo es de 3,50 m. El proveedor también indica 2,56 m de longitud, 1,15 m de anchura, 2,11 m de altura de almacenaje y 3.310 kg de peso. Estos datos describen esta unidad, sin extrapolar capacidades de otras carretillas de la gama."
  },
  "CA1436": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-industrial/maximal-fd40t/",
      "title": "MAXIMAL FD40T",
      "brand": "Maximal",
      "model": "FD40T",
      "year": "2015",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Máquinas destinadas al trabajo en cualquier condición, existen modelos con propulsión 4×4. El motor diésel les proporciona suficientemente potencia para manejar cargas más grandes, disponemos con unidades con hasta 7.000kg de capacidad. Máquinas muy versátiles y útil para cualquier empresa.",
      "specs": {
        "Altura": "4.30 metros",
        "Altura de trabajo": "4.30 m",
        "Altura almacenaje": "2.18 m",
        "Longitud": "2.91 m",
        "Anchura": "1.41 m",
        "Peso": "5100 kg",
        "Motor": "Diésel",
        "Capacidad": "4000 kg"
      }
    },
    "general": "La carretilla industrial Maximal FD40T figura como unidad de ocasión con año indicado 2015 y motorización diésel. La ficha técnica recoge 4.000 kg de capacidad y 4,30 m en el campo de altura de trabajo. También publica 2,91 m de longitud, 1,41 m de anchura y 2,18 m de altura de almacenaje. El peso consignado es de 5.100 kg. Los valores permiten evaluar dimensiones y carga declarada de este equipo, sin asumir prestaciones de otras versiones."
  },
  "CAE1054": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-retractil/toyota-8fbre16-carretilla-retractil-sistema-de-elevacion-gomariz/",
      "title": "Toyota 8FBRE16",
      "brand": "Toyota",
      "model": "8FBRE16",
      "year": "2010",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Indicadas especialmente para el almacenaje y trabajos realizados en el interior de los edificios. Gracias a propulsión eléctrica no contaminan el aire con gases de escape y trabajan muy silencioso.",
      "specs": {
        "Altura de trabajo": "12 m",
        "Alcance lateral": "0 m",
        "Altura almacenaje": "6.75 m",
        "Longitud": "2.36 m",
        "Anchura": "1.27 m",
        "Peso": "3370 kg",
        "Motor": "Eléctrico",
        "Capacidad": "1600 kg"
      }
    },
    "general": "La carretilla retráctil Toyota 8FBRE16 se anuncia como unidad de ocasión del año 2010. El proveedor declara motorización eléctrica, 1.600 kg de capacidad y 12 m en el campo de altura de trabajo. La altura de almacenaje es de 6,75 m, con 2,36 m de longitud, 1,27 m de anchura y 3.370 kg de peso en su ficha. Estos datos individualizan el equipo para valorar las exigencias de altura y espacio antes de su utilización."
  },
  "CAE1525": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/carretilla-industrial/heli-cpd-35-carretilla-elevadora/",
      "title": "HELI CPD 35",
      "brand": "HELI",
      "model": "CPD 35",
      "year": "2024",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Indicadas especialmente para el almacenaje y trabajos realizados en el interior de los edificios. Gracias a propulsión eléctrica no contaminan el aire con gases de escape y trabajan muy silencioso.",
      "specs": {
        "Altura de trabajo": "4.80 m",
        "Altura almacenaje": "2.18 m",
        "Longitud": "3.64 m",
        "Anchura": "1.26 m",
        "Peso": "4860 kg",
        "Motor": "Eléctrico",
        "Capacidad": "3500 kg"
      }
    },
    "general": "La carretilla industrial Heli CPD 35 figura como máquina de ocasión con año indicado 2024. Su ficha consigna motorización eléctrica, 3.500 kg de capacidad y 4,80 m de altura de trabajo. Las dimensiones publicadas son 3,64 m de longitud, 1,26 m de anchura y 2,18 m de altura de almacenaje, junto a 4.860 kg de peso. Se trata de magnitudes de la unidad anunciada que permiten contrastar necesidades de carga y espacio, sin recurrir a datos de otras variantes."
  },
  "MT1314": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/manipulador-telescopico/jcb-535-140/",
      "title": "JCB 535-140",
      "brand": "Jcb",
      "model": "535-140",
      "year": "2016",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Manipuladores. Unifica las características de una carretilla elevadora con las de un brazo telescópico, aumentando las posibilidades para mover y elevar materiales pesados. Contamos con maquinaria capaz de levantar de 2.500kg hasta 4.000kg y con una altura de elevación de 6m a 17m.",
      "specs": {
        "Altura": "14 metros",
        "Altura de trabajo": "13.78 m",
        "Alcance lateral": "9.60 m",
        "Altura almacenaje": "2.59 m",
        "Anchura": "2.35 m",
        "Peso": "10880 kg",
        "Motor": "Diésel",
        "Capacidad": "3500 kg"
      }
    },
    "general": "El manipulador telescópico JCB 535-140 se ofrece de ocasión con año indicado 2016. La ficha recoge un motor diésel, una capacidad de 3.500 kg y 13,78 m de altura de trabajo. El alcance lateral publicado es de 9,60 m, con 2,35 m de anchura, 2,59 m de altura de almacenaje y 10.880 kg de peso. Estos valores corresponden a la unidad identificada y permiten evaluar su capacidad y dimensiones sin extrapolar los rangos genéricos anunciados para la familia."
  },
  "TE1746": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-s0607e-13/",
      "title": "LGMG S0607E-2",
      "brand": "LGMG",
      "model": "S0607E-2",
      "year": "2025",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 5m a los 26,5m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
      "specs": {
        "Altura de trabajo": "7.8 m",
        "Alcance lateral": "0 m",
        "Altura almacenaje": "2 m",
        "Longitud": "1.64 m",
        "Anchura": "0.73 m",
        "Peso": "1550 kg",
        "Motor": "Eléctrico",
        "Capacidad": "230 kg"
      }
    },
    "general": "La plataforma de tijera LGMG S0607E-2, anunciada como unidad de ocasión del año 2025, presenta motorización eléctrica según la ficha. El proveedor indica 7,8 m de altura de trabajo y 230 kg de capacidad. Se declaran 1,64 m de longitud, 0,73 m de anchura, 2 m de altura de almacenaje y 1.550 kg de peso. Estas medidas concretan el equipo y permiten evaluar accesos y condiciones de despliegue sin suponer que el rango de altura de toda la familia se aplica a esta unidad."
  },
  "TE1772": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-as0607we-tijera-electrica-scissor-lift/",
      "title": "LGMG AS0607WE",
      "brand": "LGMG",
      "model": "AS0607WE",
      "year": "2023",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 5m a los 26,5m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
      "specs": {
        "Altura plataforma": "5.8 m",
        "Altura de trabajo": "7.8 m",
        "Alcance lateral": "0 m",
        "Altura almacenaje": "2.14 m",
        "Longitud": "1.86 m",
        "Anchura": "0.81 m",
        "Peso": "1620 kg",
        "Capacidad": "230 kg"
      }
    },
    "general": "La plataforma de tijera LGMG AS0607WE de ocasión lleva indicado el año 2023. Su ficha registra 7,8 m de altura de trabajo, 5,8 m de altura de plataforma y 230 kg de capacidad. Las dimensiones facilitadas son 1,86 m de longitud, 0,81 m de anchura y 2,14 m de altura de almacenaje, con 1.620 kg de peso. La descripción general del vendedor alude a tijeras eléctricas, pero el tipo de motor no aparece individualizado en las especificaciones de esta referencia."
  },
  "TE1814": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-as0607we-tijera-electrica-electric-scissor-2/",
      "title": "LGMG AS0607WE",
      "brand": "LGMG",
      "model": "AS0607WE",
      "year": "2021",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 5m a los 26,5m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
      "specs": {
        "Altura plataforma": "5.8 m",
        "Altura de trabajo": "7.8 m",
        "Alcance lateral": "0 m",
        "Altura almacenaje": "2.14 m",
        "Longitud": "1.86 m",
        "Anchura": "0.81 m",
        "Peso": "1620 kg",
        "Capacidad": "230 kg"
      }
    },
    "general": "La unidad LGMG AS0607WE con referencia TE1814 figura como plataforma de tijera de ocasión del año 2021. La ficha técnica indica 7,8 m de altura de trabajo, 5,8 m de altura de plataforma y 230 kg de capacidad. También declara 1,86 m de longitud, 0,81 m de anchura, 2,14 m de altura de almacenaje y 1.620 kg de peso. El texto de familia menciona equipos eléctricos, pero no consta motorización individual en los campos técnicos de esta máquina."
  },
  "MT1659": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/manipulador-telescopico/jcb-540-140-manipulador-telescopico-telescopic-manlift/",
      "title": "JCB 540-140",
      "brand": "Jcb",
      "model": "540-140",
      "year": "2018",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Manipuladores. Unifica las características de una carretilla elevadora con las de un brazo telescópico, aumentando las posibilidades para mover y elevar materiales pesados. Contamos con maquinaria capaz de levantar de 2.500kg hasta 4.000kg y con una altura de elevación de 6m a 17m.",
      "specs": {
        "Altura de trabajo": "13.8 m",
        "Alcance lateral": "9.25 M",
        "Altura almacenaje": "2.59 m",
        "Longitud": "6.25 m",
        "Anchura": "2.35 m",
        "Peso": "11090 kg",
        "Motor": "Diésel",
        "Capacidad": "4000 kg"
      }
    },
    "general": "El manipulador telescópico JCB 540-140 figura como unidad de ocasión con año indicado 2018 y motor diésel. Según la ficha, su capacidad es de 4.000 kg y la altura de trabajo es de 13,8 m, con 9,25 m de alcance lateral. Las dimensiones publicadas son 6,25 m de longitud, 2,35 m de anchura y 2,59 m de altura de almacenaje; el peso declarado es 11.090 kg. Estos datos individualizan la referencia frente al texto genérico de manipuladores telescópicos."
  },
  "MT1661": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/manipulacion-de-materiales/manipulador-telescopico/jcb-540-140-2-manipulador-telescopico-telescopic-manlift/",
      "title": "JCB 540-140",
      "brand": "Jcb",
      "model": "540-140",
      "year": "2018",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Manipuladores. Unifica las características de una carretilla elevadora con las de un brazo telescópico, aumentando las posibilidades para mover y elevar materiales pesados. Contamos con maquinaria capaz de levantar de 2.500kg hasta 4.000kg y con una altura de elevación de 6m a 17m.",
      "specs": {
        "Altura de trabajo": "13.8 m",
        "Alcance lateral": "9.25 M",
        "Altura almacenaje": "2.59 m",
        "Longitud": "6.25 m",
        "Anchura": "2.35 m",
        "Peso": "11090 kg",
        "Motor": "Diésel",
        "Capacidad": "4000 kg"
      }
    },
    "general": "La unidad JCB 540-140 de referencia MT1661 aparece como manipulador telescópico de ocasión, con año indicado 2018. El proveedor consigna motor diésel, 4.000 kg de capacidad, 13,8 m de altura de trabajo y 9,25 m de alcance lateral. La ficha también recoge 6,25 m de longitud, 2,35 m de anchura, 2,59 m de altura de almacenaje y 11.090 kg de peso. Son especificaciones de esta referencia, no de todo el intervalo de máquinas que menciona la descripción de familia."
  },
  "BA1575": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/brazo-articulado/jlg-340aj-brazo-articulado-articulated-boom-lift/",
      "title": "JLG 340AJ",
      "brand": "JLG",
      "model": "340AJ",
      "year": "2011",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Articuladas Diésel son muy útil para trabajos en exterior ya que son capaces de moverse en casi cualquier terreno y superar pendientes con un desnivel notable. Capaces de alcanzar alturas de 12m a 43m.",
      "specs": {
        "Altura de trabajo": "12.33 m",
        "Alcance lateral": "6.71 m",
        "Altura almacenaje": "2 m",
        "Longitud": "5.52 m",
        "Anchura": "1.93 m",
        "Peso": "4450 kg",
        "Motor": "Diésel",
        "Capacidad": "230 kg"
      }
    },
    "general": "La plataforma articulada JLG 340AJ de referencia BA1575 figura como unidad de ocasión con año indicado 2011. La ficha técnica consigna motorización diésel, 12,33 m de altura de trabajo y 6,71 m de alcance lateral, además de 230 kg de capacidad. Se publican 5,52 m de longitud, 1,93 m de anchura, 2 m de altura de almacenaje y 4.450 kg de peso. Estos valores permiten valorar el espacio y alcance de esta máquina concreta, frente a los rangos genéricos de la familia."
  },
  "5051BDX": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/camion/camion-porta-maquinaria/scania-p220-camion-truck-porta-maquinaria/",
      "title": "Scania P220",
      "brand": "Scania",
      "model": "P220",
      "year": "2001",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "El Scania P220 94L es un camión de la serie P de Scania, diseñado para aplicaciones de distribución y transporte urbano. Está equipado con un motor diésel de 9 litros y 6 cilindros en línea que produce aproximadamente 220 caballos de fuerza, adecuado para cargas medianas y operaciones de corta y media distancia.",
      "specs": {
        "Longitud": "7.53 M",
        "Anchura": "2.50 m",
        "Peso": "9050 kg"
      }
    },
    "general": "El camión portamaquinaria Scania P220 aparece como unidad de ocasión con año indicado 2001. En su ficha el proveedor publica 7,53 m de longitud, 2,50 m de anchura y 9.050 kg de peso. La descripción de origen habla del Scania P220 94L y de un motor diésel; esos datos descriptivos no sustituyen una ficha técnica de carga útil. Para esta unidad no consta en el registro una capacidad de transporte individualizada, por lo que no se le atribuye una cifra no acreditada."
  },
  "TE1621": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507e-tijera-electrica-scissor-lift/",
      "title": "LGMG SS0507E",
      "brand": "LGMG",
      "model": "SS0507E",
      "year": "2022",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 6m a los 20m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
      "specs": {
        "Altura plataforma": "14.30 m",
        "Altura de trabajo": "6.3 m",
        "Altura almacenaje": "2.15 m",
        "Longitud": "1.53 m",
        "Anchura": "0.81 m",
        "Peso": "985 kg",
        "Motor": "Eléctrico",
        "Capacidad": "230 kg"
      }
    },
    "general": "La plataforma de tijera eléctrica LGMG SS0507E de ocasión está identificada en su ficha con 6,3 m de altura de trabajo y 230 kg de capacidad. Sus dimensiones publicadas son 1,53 m de longitud y 0,81 m de anchura, con un peso de 985 kg y 2,15 m de altura de almacenaje. El campo de altura de plataforma del anuncio indica 14,30 m, un valor incompatible con la altura de trabajo publicada; por prudencia no se utiliza para describir la elevación real."
  },
  "TE1622": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507e-tijera-electrica-scissor-lift-2/",
      "title": "LGMG SS0507E",
      "brand": "LGMG",
      "model": "SS0507E",
      "year": "2023",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 6m a los 20m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
      "specs": {
        "Altura plataforma": "14.30 m",
        "Altura de trabajo": "6.3 m",
        "Altura almacenaje": "2.15 m",
        "Longitud": "1.53 m",
        "Anchura": "0.81 m",
        "Peso": "985 kg",
        "Motor": "Eléctrico",
        "Capacidad": "230 kg"
      }
    },
    "general": "La LGMG SS0507E de segunda mano corresponde a una plataforma de tijera eléctrica con 6,3 m de altura de trabajo y capacidad declarada de 230 kg. La ficha recoge 1,53 m de largo, 0,81 m de ancho y 985 kg de peso. Figura una altura de almacenaje de 2,15 m. La altura de plataforma consignada como 14,30 m no concuerda con los 6,3 m de trabajo; por esa contradicción no se presenta como una prestación acreditada."
  },
  "TE1858": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/lgmg-ss0507etijera-electrica-electric-scissor/",
      "title": "LGMG SS0507E",
      "brand": "LGMG",
      "model": "SS0507E",
      "year": "2022",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 6m a los 20m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.",
      "specs": {
        "Altura plataforma": "14.30 m",
        "Altura de trabajo": "6.3 m",
        "Altura almacenaje": "2.15 m",
        "Longitud": "1.53 m",
        "Anchura": "0.81 m",
        "Peso": "985 kg",
        "Motor": "Eléctrico",
        "Capacidad": "230 kg"
      }
    },
    "general": "La plataforma de tijera eléctrica LGMG SS0507E anunciada de ocasión registra 230 kg de capacidad, 6,3 m de altura de trabajo y un peso declarado de 985 kg. Sus medidas son 1,53 m de longitud, 0,81 m de anchura y 2,15 m en posición de almacenaje, según la ficha técnica. El anuncio contiene además un valor de 14,30 m para la altura de plataforma, contradictorio con la altura de trabajo; esa cifra queda expresamente sin atribuir a la máquina."
  },
  "RE454": {
    "source": {
      "url": "https://www.gomarizrent.com/venta/movimiento-de-tierras-demolicion-y-compactacion/retroexcavadora/jcb-1cx-retroexcavadora-backhoe-gomariz-1/",
      "title": "JCB 1CX",
      "brand": "Jcb",
      "model": "1CX",
      "year": "1998",
      "condition": "Segunda mano",
      "shortDescription": null,
      "longDescription": "La retroexcavadora se utiliza habitualmente para poder remover, abrir surcos y posteriormente extraer cantidades grandes de tierra. Estas excavaciones generalmente son aprovechadas para colocar tuberías, cables, drenajes y, sobre todo, para la colocación de los cimientos en edificaciones.",
      "specs": {
        "Altura": "2.25 metros",
        "Altura de trabajo": "2.51 m",
        "Longitud": "3.31 m",
        "Anchura": "1.58 m",
        "Peso": "3158 KG",
        "Motor": "Eléctrico",
        "Capacidad": "660 kg"
      }
    },
    "general": "La JCB 1CX está anunciada como retroexcavadora de ocasión del año 1998. El proveedor consigna 3,31 m de longitud, 1,58 m de anchura y 3.158 kg de peso, y señala 660 kg en el campo de capacidad. También registra 2,25 m de altura y 2,51 m en el campo de altura de trabajo, sin justificar su interpretación como alcance de excavación. La ficha asigna un motor eléctrico, dato que no se traslada a esta descripción por no estar corroborado frente a la identidad de la retroexcavadora."
  },
} as const satisfies Readonly<Record<string, Evidence>>;

const entries: ReadonlyMap<string, Evidence> = new Map(Object.entries(evidence));

const equalSpecs = (actual: SpecsMap | undefined, expected: SpecsMap): boolean => {
  if (!actual) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every((key) => actual[key] === expected[key]);
};

export const verifiedGomarizPriorityGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference) return null;
  const entry = entries.get(record.reference);
  if (!entry) return null;
  const source = entry.source;
  if (record.url !== source.url || record.title !== source.title || record.brand !== source.brand ||
    record.model !== source.model || record.year !== source.year ||
    record.condition !== source.condition || record.shortDescription !== source.shortDescription ||
    record.longDescription !== source.longDescription || !equalSpecs(record.specs, source.specs)) return null;
  return entry.general;
};
