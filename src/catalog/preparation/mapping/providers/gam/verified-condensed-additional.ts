import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { verifyGamEditorialEvidence, type EditorialEvidence } from "./verified-condensed-general.js";

const evidence: Readonly<Record<string, EditorialEvidence>> = {
  "1210": {
    "url": "https://online.gamrentals.com/es/grupos-electrogenos-nuevos/1210-gsw65p",
    "title": "Grupo electrógeno PRAMAC GSW65P 65 kVA",
    "categoryKey": "otros-nuevos",
    "brand": "PRAMAC",
    "model": "GSW65P",
    "sourceHash": "e79be99bea3d8e4db765fc7cc68c68f4822ab21bf25c417353a513add93ba2d6",
    "sourceSpecs": {
      "Marca": "PRAMAC",
      "Modelo": "GSW65P",
      "Longitud": "2285 mm",
      "Anchura": "920 mm",
      "Altura": "1465 mm",
      "Peso": "1060 KG",
      "Marca motor": "Perkins 1103A-33TG2",
      "Potencia Motor (KW)": "62.17 / 56.37",
      "Combustible": "Diésel",
      "Marca alternador": "Mecc Alte ECP 32 2M B"
    },
    "general": "El grupo electrógeno Pramac GSW65P, anunciado en la gama de 65 kVA, está destinado al suministro eléctrico de apoyo en instalaciones y trabajos que precisan una fuente de energía autónoma. La ficha identifica un motor Perkins 1103A-33TG2 y un alternador Mecc Alte ECP 32 2M B; declara dos valores de potencia de motor, 62,17 y 56,37 kW, correspondientes a regímenes que deben comprobarse en la documentación técnica. Tiene carrocería insonorizada con paneles de acero galvanizado, bancada con apoyos antivibratorios y acceso lateral para mantenimiento. Sus dimensiones publicadas son 2.285 × 920 × 1.465 mm y el peso, 1.060 kg. El texto técnico común de esta gama describe regulación de tensión DSR con precisión estática de ±1 %, bobinado auxiliar MAUX con soporte de corriente de cortocircuito de hasta el 300 % durante 20 segundos y aislamiento de clase H; estas prestaciones deben verificarse según la versión instalada. Para seleccionar el equipo conviene verificar potencia eléctrica útil, tipo de servicio y consumo antes de dimensionar las cargas.",
    "originalShort": "➨ PRAMAC GSW65P ➨ Venta de grupo electrógeno nuevo 77,71 kWA ⭐Motor PERKINS ➨ 3 Fases",
    "revisedShort": "El grupo electrógeno Pramac GSW65P de la gama 65 kVA utiliza motor Perkins y carrocería insonorizada para suministro eléctrico de apoyo."
  },
  "1211": {
    "url": "https://online.gamrentals.com/es/grupos-electrogenos-nuevos/1211-gsw80p",
    "title": "Grupo electrógeno PRAMAC GSW80P 80 kVA",
    "categoryKey": "otros-nuevos",
    "brand": "PRAMAC",
    "model": "GSW80P",
    "sourceHash": "e79be99bea3d8e4db765fc7cc68c68f4822ab21bf25c417353a513add93ba2d6",
    "sourceSpecs": {
      "Marca": "PRAMAC",
      "Modelo": "GSW80P",
      "Longitud": "2285 mm",
      "Anchura": "920 mm",
      "Altura": "1465 mm",
      "Peso": "1140 KG",
      "Marca motor": "Perkins 1104A-44TG2",
      "Potencia Motor (KW)": "76 / 72",
      "Combustible": "Diésel",
      "Capacidad de la batería": "70 Ah",
      "Marca alternador": "Mecc Alte ECP 32 3L B"
    },
    "general": "El Pramac GSW80P es un grupo electrógeno de la gama 80 kVA con motorización diésel Perkins 1104A-44TG2 y alternador Mecc Alte ECP 32 3L B. Su resumen de origen distingue 83 kVA de potencia de emergencia y 78 kVA de servicio continuo; no deben confundirse ambos regímenes. El conjunto dispone de bancada de acero con soportes antivibratorios, carrocería insonorizada con protección anticorrosión, depósito con indicador de bajo combustible y accesos laterales para mantenimiento. Las medidas declaradas son 2.285 mm de longitud, 920 mm de anchura y 1.465 mm de altura, con 1.140 kg de peso; la batería indicada es de 70 Ah. El texto técnico común de esta gama describe regulación de tensión DSR con precisión estática de ±1 %, bobinado auxiliar MAUX con soporte de corriente de cortocircuito de hasta el 300 % durante 20 segundos y aislamiento de clase H; estas prestaciones deben verificarse según la versión instalada. Antes de utilizarlo es necesario contrastar las necesidades eléctricas, el tipo de servicio y las condiciones de instalación."
  },
  "1212": {
    "url": "https://online.gamrentals.com/es/grupos-electrogenos-menores-815kvs-pramac/1212-gsw110v",
    "title": "Grupo electrógeno PRAMAC GSW110V 110 kVA",
    "categoryKey": "otros-nuevos",
    "brand": "PRAMAC",
    "model": "GSW110V",
    "sourceHash": "733c9b2b1671ea64607c29038c7e0cec78776117b532553d0be16cfd796c11d7",
    "sourceSpecs": {
      "Marca": "PRAMAC",
      "Modelo": "GSW110V",
      "Longitud": "3000 mm",
      "Anchura": "1150 mm",
      "Altura": "1760 mm",
      "Peso": "1727 KG",
      "Marca motor": "Volvo TAD531GE",
      "Potencia Motor (KW)": "97.34 / 87.05",
      "Marca alternador": "Mecc Alte ECP34-2S/4"
    },
    "general": "El grupo electrógeno Pramac GSW110V pertenece a la gama de 110 kVA y está equipado, según la ficha, con motor Volvo TAD531GE y alternador Mecc Alte ECP34-2S/4. La potencia de motor se expresa mediante dos valores, 97,34 y 87,05 kW, que deben interpretarse conforme al régimen de servicio declarado por el fabricante, sin equipararlos directamente a potencia eléctrica suministrada. Integra bancada con apoyos antivibratorios, carrocería insonorizada formada por paneles de acero protegido y puertas laterales para facilitar las inspecciones y el mantenimiento. Mide 3.000 × 1.150 × 1.760 mm y pesa 1.727 kg según la tabla técnica. El texto técnico común de esta gama describe regulación de tensión DSR con precisión estática de ±1 %, bobinado auxiliar MAUX con soporte de corriente de cortocircuito de hasta el 300 % durante 20 segundos y aislamiento de clase H; estas prestaciones deben verificarse según la versión instalada. Para su aplicación deben verificarse demanda de arranque, régimen de funcionamiento y condiciones de ventilación.",
    "originalShort": "➨ PRAMAC GSW110V ➨ Venta de grupo electrógeno nuevo 121,68 kWA ⭐Motor VOLVO ➨ 3 Fases",
    "revisedShort": "El Pramac GSW110V es un grupo electrógeno de la gama 110 kVA equipado con motor Volvo y alternador Mecc Alte."
  },
  "1213": {
    "url": "https://online.gamrentals.com/es/pramac/1213-gsw165p",
    "title": "Grupo electrógeno PRAMAC GSW165P 165 kVA",
    "categoryKey": "otros-nuevos",
    "brand": "PRAMAC",
    "model": "GSW165P",
    "sourceHash": "733c9b2b1671ea64607c29038c7e0cec78776117b532553d0be16cfd796c11d7",
    "sourceSpecs": {
      "Marca": "PRAMAC",
      "Modelo": "GSW165P",
      "Longitud": "3400 mm",
      "Anchura": "1250 mm",
      "Altura": "1770 mm",
      "Peso": "2038 KG",
      "Marca motor": "Perkins 1106A-70TAG2 - PR83527U",
      "Potencia Motor (KW)": "148 / 140",
      "Combustible": "Diésel",
      "Marca alternador": "Mecc Alte ECP34-2L"
    },
    "general": "El Pramac GSW165P es un grupo electrógeno de la gama 165 kVA para suministro eléctrico en aplicaciones profesionales. La ficha especifica motor Perkins 1106A-70TAG2 y alternador Mecc Alte ECP34-2L, así como dos cifras de potencia de motor, 148 y 140 kW, cuya correspondencia con cada régimen de trabajo debe confirmarse. El equipo incorpora carrocería insonorizada de paneles metálicos con protección anticorrosión, bancada apoyada sobre elementos antivibratorios y accesos de servicio laterales. Las dimensiones publicadas son 3.400 mm de longitud, 1.250 mm de anchura y 1.770 mm de altura, con 2.038 kg de peso. El texto técnico común de esta gama describe regulación de tensión DSR con precisión estática de ±1 %, bobinado auxiliar MAUX con soporte de corriente de cortocircuito de hasta el 300 % durante 20 segundos y aislamiento de clase H; estas prestaciones deben verificarse según la versión instalada. Se debe contrastar la potencia eléctrica disponible, la autonomía y la instalación antes de utilizarlo como fuente principal o de respaldo.",
    "originalShort": "➨ PRAMAC GSW165P ➨ Venta de grupo electrógeno nuevo 194,51 kWA ⭐Motor PERKINS ➨ 3 Fases",
    "revisedShort": "El Pramac GSW165P es un grupo electrógeno de 165 kVA con motor Perkins y alternador Mecc Alte, concebido para alimentación eléctrica profesional."
  },
  "1214": {
    "url": "https://online.gamrentals.com/es/grupos-electrogenos-nuevos/1214-gsw200p",
    "title": "Grupo electrógeno PRAMAC GSW200P 200 kVA",
    "categoryKey": "otros-nuevos",
    "brand": "PRAMAC",
    "model": "GSW200P",
    "sourceHash": "733c9b2b1671ea64607c29038c7e0cec78776117b532553d0be16cfd796c11d7",
    "sourceSpecs": {
      "Marca": "PRAMAC",
      "Modelo": "GSW200P",
      "Longitud": "3400 mm",
      "Anchura": "1250 mm",
      "Altura": "1770 mm",
      "Peso": "2088 KG",
      "Marca motor": "Perkins 1106A-70TAG3",
      "Potencia Motor (KW)": "178.66 / 160.77",
      "Combustible": "Diésel",
      "Marca alternador": "Mecc Alte ECO38-1S/4"
    },
    "general": "El grupo electrógeno Pramac GSW200P, comercializado en la gama de 200 kVA, incorpora motor diésel Perkins 1106A-70TAG3 y alternador Mecc Alte ECO38-1S/4. En su ficha figuran potencias de motor de 178,66 y 160,77 kW, que no deben presentarse como potencia eléctrica de salida sin conocer el régimen de referencia. El conjunto integra una carrocería insonorizada, bancada de acero con elementos antivibratorios, depósito de combustible y accesos laterales para operaciones de mantenimiento. Las medidas declaradas son 3.400 × 1.250 × 1.770 mm y su peso es de 2.088 kg. El texto técnico común de esta gama describe regulación de tensión DSR con precisión estática de ±1 %, bobinado auxiliar MAUX con soporte de corriente de cortocircuito de hasta el 300 % durante 20 segundos y aislamiento de clase H; estas prestaciones deben verificarse según la versión instalada. La elección debe contemplar el régimen de carga, las puntas de arranque, la ventilación y el consumo de combustible aplicables a la instalación.",
    "originalShort": "➨ PRAMAC GSW200P➨ Venta de grupo electrógeno nuevo 200 kWA ⭐Motor PERKINS ➨ 3 Fases",
    "revisedShort": "El Pramac GSW200P es un grupo electrógeno diésel de la gama 200 kVA con motor Perkins y alternador Mecc Alte."
  },
  "6185": {
    "url": "https://online.gamrentals.com/es/cte/6185-plataforma-sobre-camion-articulado-cte-dz-20-auto-fib",
    "title": "PLATAFORMA SOBRE CAMIÓN ELÉCTRICA 20M CTE DZ 20 AUTO FIB",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "DZ 20 AUTO FIB",
    "sourceHash": "40c32dec7cc1fdaee42177c39802b553a43c9645d3ac382d75eb88487c8084cb",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "DZ 20 AUTO FIB",
      "Longitud": "7450 mm",
      "Altura": "3030 mm",
      "Peso": "3500 KG",
      "Altura de elevación (m)": "19,7 metros",
      "Capacidad de carga (kg)": "230 KG",
      "Controles Hidraúlicos": "ELÉCTRICOS",
      "Dimensiones Cesta": "1400x700x1100 metros",
      "Alcance Lateral": "9 metros",
      "Rotación de torreta": "700º",
      "Rotación de la cesta": "90° + 90°"
    },
    "general": "La plataforma articulada sobre camión CTE DZ 20 AUTO FIB está destinada a mantenimiento e instalaciones en altura que necesitan movilidad entre diferentes puntos de trabajo. La descripción de origen anuncia una altura máxima próxima a 19,6 m, una altura de cesta de 17,6 m y 9 m de alcance lateral. Su cesta de fibra de 1.400 × 700 × 1.100 mm admite 230 kg y gira 90° a cada lado; el empleo de fibra no sustituye las comprobaciones específicas para trabajos eléctricos. La torreta tiene una rotación indicada de 700° y se describe un sistema de estabilización automática H+H. El conjunto sobre camión pesa 3.500 kg y mide 7.450 mm de largo y 3.030 mm de alto según la ficha. Deben verificarse la zona de apoyo, el alcance admisible con carga y la versión instalada."
  },
  "6188": {
    "url": "https://online.gamrentals.com/es/cte/6188-plataforma-sobre-camion-telescopico-cte-b-lift-20-j-auto-fib",
    "title": "PLATAFORMA SOBRE CAMIÓN ELÉCTRICA 20M CTE B-LIFT 20 J AUTO FIB",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "B-LIFT 20 J AUTO FIB",
    "sourceHash": "bc74acc1d88a4ea73973bae3953b5a2728c17885194e6e8e1140e88139a010ce",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "B-LIFT 20 J AUTO FIB",
      "Peso": "3500 KG",
      "Altura de elevación (m)": "19,7 metros",
      "Capacidad de carga (kg)": "230 KG",
      "Controles Hidraúlicos": "ELÉCTRICOS",
      "Dimensiones Cesta": "1400x700x1100 metros",
      "Alcance Lateral": "12 metros",
      "Rotación de torreta": "700º",
      "Rotación de la cesta": "90° + 90°"
    },
    "general": "La CTE B-LIFT 20 J AUTO FIB es una plataforma telescópica sobre camión con plumín y cesta de fibra, orientada a trabajos de acceso en altura en mantenimiento e instalaciones técnicas. La descripción del proveedor publica 19,7 m de altura máxima de trabajo, 17,7 m de altura de cesta y hasta 12 m de alcance lateral. La cesta mide 1.400 × 700 × 1.100 mm, admite una carga máxima de 230 kg y puede girar 90° a cada lado. La torreta ofrece una rotación anunciada de 700° y el sistema HE+H permite la estabilización automática mediante cuatro apoyos hidráulicos. La ficha indica un peso de 3.500 kg. La cesta de fibra no implica por sí sola aptitud para trabajar con líneas eléctricas energizadas; deben comprobarse la homologación, la estabilización y la carga permitida."
  },
  "6874": {
    "url": "https://online.gamrentals.com/es/cte/6874-plataforma-sobre-furgon-cte-vj15-fib",
    "title": "PLATAFORMA SOBRE FURGÓN 15M CTE VJ15 FIB",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "VJ15 FIB",
    "sourceHash": "0d411ca76aecb28946df7ac50808b7ee4361e1fceda697fc966c622c72afc300",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "VJ15 FIB",
      "Longitud": "6850 mm",
      "Altura": "3280 mm",
      "Peso": "3500 KG",
      "Altura de trabajo (m)": "14,40 metros",
      "Capacidad de carga (kg)": "225 KG",
      "Dimensiones Cesta": "1400x700x1100 mm metros",
      "Alcance Lateral": "8,5 m metros",
      "Distancia entre ejes": "3682 mm",
      "Rotación": "400º"
    },
    "general": "La CTE VJ15 FIB es una plataforma elevadora montada sobre furgón que incorpora cesta de fibra para intervenciones de mantenimiento y servicios técnicos con desplazamientos frecuentes. La descripción comercial anuncia 14,40 m de altura máxima de trabajo, 12,40 m de altura de cesta y hasta 8,50 m de alcance lateral. Su cesta tiene dimensiones de 1.400 × 700 × 1.100 mm y una capacidad máxima declarada de 225 kg, sujeta a las condiciones de uso. El conjunto presenta una longitud de 6.850 mm, altura de 3.280 mm y peso de 3.500 kg; se indica una rotación de 400°. El montaje sobre furgón permite llevar herramientas junto al equipo, pero las cargas del vehículo y de la plataforma deben comprobarse por separado. La cesta de fibra no sustituye las medidas de protección eléctrica necesarias.",
    "originalShort": "La plataforma sobre furgón CTE VJ15 FIB es una solución versátil para trabajos en altura que destaca por incorporar una cesta de fibra, especialmente indicada para aplicaciones profesionales donde este tipo de configuración resulta necesaria. Ofrece una altura máxima de trabajo de 14,40 metros, un alcance lateral de hasta 8,50 metros y una capacidad máxima en cesta de 225 kg, permitiendo trabajar con hasta dos operadores. Montada sobre furgón, la CTE VJ15 FIB combina movilidad, espacio para herramientas y a",
    "revisedShort": "La CTE VJ15 FIB es una plataforma elevadora sobre furgón con cesta de fibra, 14,40 m de altura de trabajo y 225 kg de capacidad de cesta."
  },
  "6953": {
    "url": "https://online.gamrentals.com/es/cte/6953-plataforma-sobre-furgon-cte-vj12",
    "title": "PLATAFORMA SOBRE FURGÓN 12M CTE VJ12",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "VJ12",
    "sourceHash": "feb50aab4ba5e361904cea56f0dfa1a5f61698e2e8ddb7ca4a35238f51f6c141",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "VJ12",
      "Altura de elevación (m)": "12 metros",
      "Capacidad de carga (kg)": "120 KG"
    },
    "general": "La plataforma sobre furgón CTE VJ12 permite realizar tareas de mantenimiento, instalaciones y servicios urbanos que requieren trasladarse entre varios puntos de intervención. El montaje sobre vehículo con masa máxima autorizada anunciada de 3,5 toneladas facilita transportar herramientas junto a la plataforma sin utilizar un equipo remolcado independiente. La ficha de este modelo declara 12 m de altura de elevación y 120 kg de capacidad de cesta; la utilización de ese valor debe ajustarse a la configuración efectiva y al diagrama de trabajo. El texto original menciona controles eléctricos para posicionar la plataforma y sistemas destinados a regular las maniobras. Se deben comprobar las condiciones de estacionamiento, estabilización, accesibilidad y carga antes de operar. No debe confundirse esta versión con la VJ12 FIB, que dispone de cesta diferente.",
    "originalShort": "La plataforma sobre furgón CTE VJ12 es una solución compacta y versátil diseñada para realizar trabajos profesionales en altura con gran movilidad entre diferentes puntos de intervención. Su instalación sobre un vehículo de P.M.A. de 3,5 toneladas permite combinar las ventajas de una plataforma aérea con la facilidad de desplazamiento de un furgón, siendo especialmente adecuada para mantenimiento, instalaciones, telecomunicaciones y servicios urbanos. VJ12_FIB La CTE VJ12 incorpora controles eléctricos y un",
    "revisedShort": "La CTE VJ12 es una plataforma sobre furgón para trabajos de mantenimiento en altura, con 12 m de elevación y cesta de 120 kg."
  },
  "6168": {
    "url": "https://online.gamrentals.com/es/cte/6168-plataforma-sobre-camion-articulado-cte-zed-233-jhv",
    "title": "PLATAFORMA SOBRE CAMIÓN ARTICULADO 23M CTE ZED 23.3 JHV",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "ZED 23.3 JHV",
    "sourceHash": "8c5c7a86170181b1ac8f85b94a0f02100faa6af4e840a5eac8d196fa6bdd2c08",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "ZED 23.3 JHV",
      "Longitud": "7575 mm",
      "Anchura": "2260 mm",
      "Altura": "2780 mm",
      "Peso": "3500 KG",
      "Altura de elevación (m)": "23 metros",
      "Capacidad de carga (kg)": "250 KG",
      "Dimensiones Cesta": "1400x700x1100 metros",
      "Alcance Lateral": "10 metros",
      "Rotación de torreta": "320º",
      "Rotación de la cesta": "90° + 90°"
    },
    "general": "La plataforma sobre camión CTE ZED 23.3 JHV combina doble brazo articulado, tramo telescópico y plumín para acceder a zonas elevadas con obstáculos. La ficha técnica declara 23 m de altura de elevación, hasta 10 m de alcance lateral y una capacidad de cesta de 250 kg. La descripción de origen precisa una altura aproximada de 21 m para la cesta y rotación anunciada de la torreta de 320°. La cesta publicada mide 1.400 × 700 × 1.100 mm y gira 90° a cada lado. Las dimensiones del vehículo son 7.575 mm de longitud, 2.260 mm de anchura y 2.780 mm de altura, con un peso declarado de 3.500 kg. El operador debe comprobar estabilizadores, obstáculos y carga permitida según la posición de trabajo.",
    "originalShort": "➨ CTE ZED 23.3 JHV Nueva ➨ Venta de plataforma elevadora sobre camión de 23 metros de altura ⭐Capacidad de la cesta 230 kg",
    "revisedShort": "La plataforma articulada sobre camión CTE ZED 23.3 JHV ofrece 23 m de elevación y cesta con capacidad de 250 kg."
  },
  "4659": {
    "url": "https://online.gamrentals.com/es/cte/4659-plataforma-sobre-orugas-cte-traccess-230",
    "title": "Plataforma elevadora sobre orugas CTE TRACCESS 230",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "TRACCESS 230",
    "sourceHash": "967537899c9edff3c611f763cb9048fbd9842b84c09d0df41b2c3f4d3ba90c65",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "TRACCESS 230",
      "Altura de elevación (m)": "23 metros",
      "Capacidad de carga (kg)": "200 KG"
    },
    "general": "La CTE TRACCESS 230 es una plataforma elevadora sobre orugas con doble brazo articulado, tramo telescópico y plumín para trabajos de mantenimiento y acceso a zonas de difícil entrada. Su ficha declara una altura de elevación de 23 m y capacidad máxima de cesta de 200 kg. La descripción comercial destaca el chasis de orugas extensible, el sistema de estabilización automática con apoyos y los controles proporcionales por radio, elementos que ayudan al posicionamiento de la máquina. También menciona diferentes motorizaciones y una variante eléctrica denominada TRACCESS 230E, cuyas prestaciones energéticas no deben atribuirse automáticamente a este modelo. La selección debe tener en cuenta el terreno de apoyo, los accesos disponibles, el espacio de giro y las cargas efectivas de la cesta."
  },
  "4651": {
    "url": "https://online.gamrentals.com/es/cte/4651-plataforma-sobre-camion-telescopica-cte-b-lift-272",
    "title": "Plataforma elevadora sobre camión telescópica CTE B-LIFT 27.2",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "B-LIFT 27.2",
    "sourceHash": "18018ff7c8e4d2131446b4eb94483ffb0701a35b48a09a5f036b40af284c565e",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "B-LIFT 27.2",
      "Altura de elevación (m)": "27 metros",
      "Capacidad de carga (kg)": "250 KG"
    },
    "general": "La CTE B-LIFT 27.2 es una plataforma telescópica sobre camión diseñada para trabajos profesionales que requieren gran altura y alcance. La ficha anuncia 27 m de altura de trabajo, 15,5 m de alcance lateral y una capacidad máxima de 250 kg en cesta. El brazo telescópico incluye cinco secciones y el sistema electrónico S3 EVO gestiona el área de trabajo según la configuración de estabilizadores y la carga. La cesta de aluminio de 1.400 × 700 × 1.100 mm dispone, según el texto de origen, de mandos para el posicionamiento y funciones de retorno. El montaje se describe para vehículo de masa técnica mínima de 3.500 kg. Antes del uso hay que verificar apoyos, carga útil disponible, recorrido y compatibilidad del vehículo específico."
  },
  "6547": {
    "url": "https://online.gamrentals.com/es/cte/6547-plataforma-sobre-orugas-electrica-cte-traccess-240e",
    "title": "PLATAFORMA SOBRE ORUGAS ELÉCTRICA 24M CTE TRACCESS 240E",
    "categoryKey": "elevacion-nueva",
    "brand": "CTE",
    "model": "TRACCESS 240E",
    "sourceHash": "1e5f8051e304a6e0699234308956a804b503f787cd3a14f43906142cb73a9031",
    "sourceSpecs": {
      "Marca": "CTE",
      "Modelo": "TRACCESS 240E",
      "Longitud": "5460 mm",
      "Anchura": "1390 mm",
      "Altura": "2050 mm",
      "Altura de elevación (m)": "24 metros",
      "Capacidad de carga (kg)": "230 KG"
    },
    "general": "La plataforma sobre orugas eléctrica CTE TRACCESS 240E está concebida para tareas de mantenimiento, instalaciones y trabajos en altura en zonas con accesos estrechos o pavimentos delicados. La descripción de origen precisa 23,80 m de altura de trabajo, 21,80 m de altura de cesta y hasta 11 m de alcance horizontal. La cesta de 1.400 × 700 × 1.100 mm tiene una capacidad publicada de 230 kg y giro de 60° a cada lado; se describen orugas que no dejan marcas, mando por radio y estabilización automática. La ficha estructurada indica 5.460 mm de longitud, 1.390 mm de anchura y 2.050 mm de altura. El carácter eléctrico no evita comprobar acceso, carga de cesta y condiciones del terreno antes de montar los estabilizadores.",
    "originalShort": "➨ CTE TRACCESS 240E Nueva ➨ Venta de plataforma elevadora sobre orugas de 24 metros de altura ⭐Capacidad de la cesta 200 kg",
    "revisedShort": "La plataforma eléctrica sobre orugas CTE TRACCESS 240E alcanza una altura de trabajo próxima a 24 m y admite hasta 230 kg en cesta."
  },
  "6148": {
    "url": "https://online.gamrentals.com/es/tennant/6148-fregadora-tennant-fca-t290",
    "title": "Fregadora operador acompañante TENNANT FCA T260",
    "categoryKey": "limpieza-fregadoras",
    "brand": "Tennant",
    "model": "FCA T260",
    "sourceHash": "5b6309f1ad1abe890796654742da4c5caea3c2cbb62b8f3a1ae0dfb1cbcf996a",
    "sourceSpecs": {
      "Marca": "Tennant",
      "Modelo": "FCA T260",
      "Longitud": "1300 mm",
      "Anchura": "775 mm",
      "Altura": "1100 mm",
      "Peso": "140 KG",
      "RPM cepillo": "150"
    },
    "general": "La fregadora Tennant FCA T260 es un equipo de operador acompañante para limpieza de mantenimiento en pasillos, áreas comerciales y espacios interiores con obstáculos. Su diseño compacto permite trabajar con un ancho de fregado anunciado de 0,50 m, y la ficha declara 1.300 mm de longitud, 775 mm de anchura, 1.100 mm de altura y 140 kg de peso. El texto comercial describe alimentación por batería de 24 V, autonomía de hasta tres horas en condiciones de referencia, depósito de solución de 40 litros y depósito de recuperación de 45 litros. El cepillo tiene una velocidad indicada de 150 rpm. La puesta en marcha mediante mando único y el acceso a depósitos y elementos de limpieza simplifican las tareas habituales. La autonomía real dependerá del suelo, el modo de uso y el estado de la batería."
  },
  "2239": {
    "url": "https://online.gamrentals.com/es/yale/2239-preparapedidos-2000-k-yale-mo20p",
    "title": "Preparapedidos 2000 Kg Yale MO20P",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "MO20P",
    "sourceHash": "9b7ec9893e0cf9082958ad3b0392bd58cce40f214e89570a08a7c7afce9a8d40",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MO20P",
      "Longitud": "3816 mm",
      "Anchura": "796 mm",
      "Altura": "1360 mm",
      "Peso": "1120/1365 KG",
      "Capacidad de carga (kg)": "2000 KG",
      "Centro de carga": "1200 mm",
      "Radio de giro": "3142",
      "Capacidad de la batería": "24V / 465Ah(V/Ah)(V/Ah)",
      "Altura Plataforma": "-/980 metros"
    },
    "general": "El Yale MO20P es un preparapedidos eléctrico de bajo nivel para transportar dos europalets y realizar tareas de picking y reposición en almacenes. La ficha declara 2.000 kg de capacidad nominal con centro de carga de 1.200 mm, y la descripción original recoge plataforma elevable hasta 980 mm para facilitar el acceso a mercancías. La elevación de horquillas indicada es de 120 mm y se anuncia batería de 24 V y 465 Ah. El equipo mide 3.816 mm de longitud, 796 mm de anchura y 1.360 mm de altura, con radio de giro publicado de 3.142 mm. La velocidad opcional de hasta 13 km/h depende de la configuración. Conviene verificar el ancho de pasillo, la carga acumulada en los palés y las condiciones de circulación."
  },
  "5993": {
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-yale/5993-carretilla-elevadora-electrica-yale-erp45mxlg",
    "title": "CARRETILLA ELEVADORA ELÉCTRICA 4500KG YALE ERP4.5MXLG",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP4.5MXLG",
    "sourceHash": "39a96de25365ffec93e6414b4be765cf4cd58426c8d4b2faa5174607a384396a",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP4.5MXLG",
      "Longitud": "4280 mm",
      "Anchura": "1924 mm",
      "Altura": "2250 mm",
      "Peso": "6780 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "4500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "2850",
      "Altura de elevación (mm)": "3000 mm"
    },
    "general": "La carretilla eléctrica Yale ERP4.5MXLG está destinada al manejo de mercancías de gran tonelaje en instalaciones logísticas e industriales. Su capacidad nominal publicada es de 4.500 kg con centro de carga de 500 mm; la ficha técnica declara 3.000 mm de altura de elevación, aunque el resumen comercial menciona otra medida, por lo que debe prevalecer la configuración comprobada de la máquina. Equipa tecnología de batería de ion de litio según la descripción de origen y neumáticos industriales para circular sobre firmes adecuados. Las dimensiones declaradas son 4.280 × 1.924 × 2.250 mm y el peso, 6.780 kg; el radio de giro se indica en 2.850 mm. La descripción publica una batería LFP de 46,7 kWh y 154,5 V, con capacidad nominal de 302 Ah, motor de tracción de 30 kW y motor de elevación de 25 kW. También indica hasta 18 km/h de velocidad y 186 mm de despeje entre ejes, con variantes de mástil que pueden alcanzar alturas superiores. La altura de mástil, la capacidad residual y las condiciones del pavimento deben comprobarse para cada aplicación.",
    "originalShort": "➨ YALE ERP4.5MXLG nueva ➨ Venta de Carretilla Elevadora Eléctrica 4,2 metros nueva ⭐Capacidad de carga de 4.500 kg",
    "revisedShort": "La Yale ERP4.5MXLG es una carretilla elevadora eléctrica de 4.500 kg de capacidad nominal, con centro de carga de 500 mm."
  },
  "6425": {
    "url": "https://online.gamrentals.com/es/hyster/6425-carretilla-elevadora-electrica-hyster-j30utl",
    "title": "CARRETILLA ELEVADORA ELÉCTRICA 3000KG HYSTER J3.0UTL",
    "categoryKey": "carretillas-nuevas",
    "brand": "HYSTER",
    "model": "J3.0UTL",
    "sourceHash": "0d69c2ddc4aadf8d3e41f57166396d8f895dfb19e78b0e5ce09bfb3d91c4adae",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "J3.0UTL",
      "Longitud": "3614 mm",
      "Anchura": "1285 mm",
      "Altura": "2150 mm",
      "Peso": "4910 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "3000 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "2349mm",
      "Altura mástil replegado": "2050 mm",
      "Altura de elevación (mm)": "3000 mm"
    },
    "general": "La Hyster J3.0UTL es una carretilla elevadora eléctrica con batería de litio, diseñada para tareas habituales de carga, descarga y transporte de palés en instalaciones industriales. La ficha declara 3.000 kg de capacidad nominal con centro de carga de 500 mm y altura de elevación de 3.000 mm. Según la descripción técnica, su motorización comprende 11,5 kW de tracción y 15 kW de elevación, con batería LFP de 77,6 V y diferentes capacidades opcionales. El equipo mide 3.614 × 1.285 × 2.150 mm, pesa 4.910 kg y presenta un radio de giro publicado de 2.349 mm. Las prestaciones de velocidad y autonomía dependen de la versión de batería y del ciclo de trabajo; también debe verificarse el espacio de maniobra."
  },
  "6368": {
    "url": "https://online.gamrentals.com/es/yale/6368-tractor-electrico-de-arrastre-yale-mo70t",
    "title": "Tractor eléctrico de arrastre Yale MO70T",
    "categoryKey": "otros-nuevos",
    "brand": "YALE",
    "model": "MO70T",
    "sourceHash": "dc95e98537c337133cad0cfed769724d8a58826cf83a968a6e27d61e1d10b977",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "MO70T",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "7000 KG"
    },
    "general": "El Yale MO70T es un tractor eléctrico de arrastre para trenes logísticos y remolques en almacenes, centros de distribución y líneas de producción. Su ficha recoge una capacidad nominal de arrastre de 7.000 kg. La descripción técnica indica fuerza de tiro de 1.336 N, batería de 24 V con alternativa de 465 o 620 Ah y motor de tracción de 3 kW, además de freno de servicio electromagnético. Se anuncian velocidades de hasta 8,4 km/h con carga y 13 km/h sin carga y un radio de giro de 1.434 mm. La anchura publicada es de 796 mm y la altura de enganche, de 365 mm. La selección del equipo exige verificar masa remolcada, pendiente real, resistencia a la rodadura y compatibilidad de acoplamientos."
  },
  "6325": {
    "url": "https://online.gamrentals.com/es/yale/6325-carretilla-elevadora-electrica-yale-erp25ux-l-",
    "title": "Carretilla elevadora eléctrica 2500kg Yale ERP25UX L",
    "categoryKey": "carretillas-nuevas",
    "brand": "YALE",
    "model": "ERP25UX L",
    "sourceHash": "6b3f16cb0aacc121650832acf9eb430c0af9cc2d29c7a676fbd8a8381a42c20f",
    "sourceSpecs": {
      "Marca": "YALE",
      "Modelo": "ERP25UX L",
      "Longitud": "3387 mm",
      "Anchura": "1285 mm",
      "Altura": "2015 mm",
      "Peso": "4226 KG",
      "Tipo motor": "Eléctrico",
      "Capacidad de carga (kg)": "2500 KG",
      "Centro de carga": "500 mm",
      "Radio de giro": "2155mm",
      "Altura mástil replegado": "2015 mm",
      "Altura de elevación (mm)": "3990 mm"
    },
    "general": "La Yale ERP25UX L es una carretilla elevadora eléctrica de la gama UX para carga y descarga, almacenaje y movimientos internos de palés. La ficha declara 2.500 kg de capacidad nominal con centro de carga de 500 mm y 3.990 mm de altura de elevación; el resumen comercial menciona otra altura y debe contrastarse con el mástil instalado. El equipo mide 3.387 mm de longitud, 1.285 mm de anchura y 2.015 mm de altura, con un peso de 4.226 kg y un radio de giro declarado de 2.155 mm. La descripción de origen recoge motorización eléctrica y distintas soluciones de batería según configuración. Para elegir el equipo conviene comprobar anchura del pasillo, altura libre y capacidad residual a la elevación requerida.",
    "originalShort": "➨ YALE ERP25UX L ➨ Venta de Carretilla Elevadora Eléctrica 5,5 metros nueva ⭐Capacidad de carga de 2500 kg",
    "revisedShort": "La Yale ERP25UX L es una carretilla eléctrica de 2.500 kg, centro de carga de 500 mm y elevación declarada de 3.990 mm."
  },
  "2146": {
    "url": "https://online.gamrentals.com/es/transpaletas-hyster/2146-transpaleta-hyster-p30",
    "title": "Transpaleta eléctrica 3000Kg Hyster P3.0",
    "categoryKey": "marcas-nuevas",
    "brand": "HYSTER",
    "model": "P3.0",
    "sourceHash": "282865eb8eb4035a9f8704c0bed163f20313ce11f4e8c847787b609a5d2e1e02",
    "sourceSpecs": {
      "Marca": "HYSTER",
      "Modelo": "P3.0",
      "Peso": "633 KG",
      "Altura de elevación (m)": "0,12 metros",
      "Capacidad de carga (kg)": "3000 KG"
    },
    "general": "La transpaleta eléctrica Hyster P3.0 se utiliza para el movimiento horizontal de palés y operaciones de carga y descarga en almacenes e instalaciones logísticas. Según la ficha técnica, su capacidad nominal es de 3.000 kg y la elevación publicada equivale a 120 mm, adecuada para separar la carga del pavimento durante el transporte. El peso declarado es de 633 kg. La propulsión eléctrica y los mandos de conducción permiten realizar maniobras habituales de traslado en zonas de almacenaje, siempre de acuerdo con la carga admisible y el estado del suelo. El texto comercial es principalmente promocional y no identifica una autonomía o un voltaje verificable de esta unidad. Antes de su selección deben comprobarse dimensiones de horquilla, tipo de palé, pendientes y espacio disponible."
  },
};

export const resolveGamAdditionalCondensedGeneral = (record: ProductRecord): string | null =>
  verifyGamEditorialEvidence(record, evidence)?.general ?? null;

export const resolveGamAdditionalCondensedShort = (record: ProductRecord): string | null => {
  const entry = verifyGamEditorialEvidence(record, evidence);
  return entry?.originalShort && record.shortDescription === entry.originalShort ? entry.revisedShort ?? null : null;
};
