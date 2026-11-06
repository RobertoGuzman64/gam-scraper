import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";

type VerifiedResidualEditorial = {
  readonly source: string;
  readonly prepared: string;
  readonly general: string;
  readonly short: string | null;
};

const evidence: Readonly<Record<string, VerifiedResidualEditorial>> = {
  "2148": {
    "source": "5638f3294bc70db9e600814b69f69a19b1f7ce2478c13649e551173c6b7cb42a",
    "prepared": "a232062aca6b011ebd13d3b078b23091b27348cd6f7892b5c940e0bfa5b91768",
    "general": "La Hyster RP2.0N es una transpaleta eléctrica para el transporte horizontal de palés en almacenes y zonas de carga. La ficha identifica una capacidad de 2.000 kg, elevación de 0,12 m y peso de 1.010 kg. La batería indicada es de 24 V y 465 Ah. El texto comercial original empleaba también la denominación RP2.5N, que no corresponde al modelo de esta referencia.",
    "short": null
  },
  "6190": {
    "source": "e23dce4f256b5ed719be6970103ef8e6b19f520c82cbcb8bc352a74306a9df3a",
    "prepared": "cf70b32dfe0a97b80d93496c690a59124de07ee312768adf7c90403331e8c7c2",
    "general": "La CTE B-LIFT 27.2 FIB es una plataforma telescópica montada sobre camión para acceder a puntos de trabajo elevados. Su estructura telescópica permite posicionar la cesta manteniendo el vehículo de apoyo en la zona de operación. El anuncio declara 27 m de altura de trabajo, 15,5 m de alcance horizontal y 250 kg de capacidad de cesta. El diagrama de trabajo y la estabilización deben comprobarse para la configuración ofertada.",
    "short": null
  },
  "6192": {
    "source": "043f55dd3a6dbe47cd68ff406d33cec1e712a6edf50a20bf2058a0c4ef0ba967",
    "prepared": "333cc9d1e5064408dc0f23c379d2155ba155b26ff5d1fc4ec25a361ea74e0352",
    "general": "La CTE ZED 23.3 JHV FIB es una plataforma articulada sobre camión destinada a trabajos de acceso en altura. La articulación del brazo facilita aproximar la cesta a posiciones de trabajo que no quedan directamente sobre el vehículo. El anuncio declara 23 m de altura de trabajo, alcance lateral de hasta 10 m y capacidad de cesta de 250 kg. La estabilización y los límites de movimiento deben contrastarse con la configuración ofertada.",
    "short": null
  },
  "6191": {
    "source": "5ffe2bd9b551d79e39b1fc65e70245bab4c72197199412ec2c7cf5a513f1f5c3",
    "prepared": "ccb547d37f32b8aa43b7153f93297631ba0c1a54cffa2a56cd2795c6ef7b640f",
    "general": "La CTE ZED 21.3 JHV FIB es una plataforma articulada instalada sobre camión para mantenimiento, instalaciones y otros trabajos de acceso en altura. El anuncio identifica la versión JHV FIB y publica una altura comercial aproximada de 21 m y una capacidad de cesta de 300 kg. Estos valores corresponden al anuncio; antes de operar deben verificarse el diagrama de trabajo y las condiciones de estabilización de la unidad.",
    "short": null
  },
  "6163": {
    "source": "00896dd726f2b0fd92e2f3d54ca51713ba6b8bc4946e24a65e1a9cc106800bcc",
    "prepared": "511b33aa3dac7c8d171db89a147c4dc7f9fd6bfbd988ad1a73464104257ba0af",
    "general": "La CTE DZ 24 AUTO es una plataforma articulada sobre camión para intervenciones en altura. La ficha técnica indica 23,6 m de altura, alcance lateral de 12,8 m y capacidad de cesta de 230 kg. La máquina se anuncia con estabilización automática; la maniobra y el posicionamiento deben ajustarse a los límites de trabajo especificados para la configuración concreta.",
    "short": null
  },
  "2300": {
    "source": "08c02ec325958cabf10b13952438cf660df74f7c57bbb6d36d82a16f28485b0b",
    "prepared": "fbe952d9e37257f9d37ac186ff485355765fbb77eed3bbf01c6b93fe5c38c938",
    "general": "El Yale MC12 es un apilador eléctrico de conducción a pie para el movimiento y la colocación de palés en almacenes. La ficha anuncia 1.200 kg de capacidad y dimensiones de 2.892 mm de longitud, 939 mm de anchura y 2.325 mm de altura. Los campos originales de centro de carga, radio de giro y batería contienen valores con unidades incongruentes; no se utilizan para atribuir prestaciones técnicas.",
    "short": null
  },
  "5899": {
    "source": "212fbde4b48cb39984c29f2b51e163777d2d8d25fb4f97fddcdf1ff40b035b49",
    "prepared": "11d1f66663cb9e296b3960326162ecf97bde88802507ac398f14da242d711c11",
    "general": "La CTE AZ14 PICKUP es una plataforma articulada montada sobre vehículo tipo pick-up para trabajos de mantenimiento e instalaciones en altura. La ficha anuncia una altura de 13,5 m, capacidad de cesta de 230 kg y longitud de equipo de 5.900 mm. El texto comercial anterior la denominaba ZED 14; esta referencia corresponde al modelo AZ14 PICKUP y no se le asignan prestaciones de otra serie.",
    "short": null
  },
  "2292": {
    "source": "9721bb55151dfbd648512f9a59cb38511071e95bf7a0bbafacdae2f4439caee0",
    "prepared": "8ab48e2dd5d944dc68c9b49d9d944b985c723d5d577d8d0913fa258601394a0a",
    "general": "La Yale ERP18VF (MWB) es una carretilla elevadora eléctrica, no un apilador, para el transporte y apilado de palés. La ficha identifica 1.800 kg de capacidad a 500 mm de centro de carga, elevación de 5.500 mm y batería de 48 V y 625 Ah. Sus dimensiones declaradas son 3.088 × 1.050 × 2.230 mm. La variante MWB debe conservarse al cotejar el equipo con otras configuraciones.",
    "short": "Carretilla elevadora eléctrica Yale ERP18VF (MWB), de 1.800 kg de capacidad y 5.500 mm de elevación según ficha."
  },
  "2211": {
    "source": "9c6f8451cf2fe858a94d63fd2952d68452001ed2010d36998aca846e495b2682",
    "prepared": "a7c85ad1474ce308ee141c7606f068c1979bf3d13e8d92c7ada289f86b53600d",
    "general": "La Yale GDP160EF12 es una carretilla diésel para cargas industriales de gran volumen. Su ficha indica capacidad de 16.000 kg a un centro de carga de 900 mm y elevación de 7.000 mm. Se publican motor Cummins QSB 6.7L Diesel, transmisión ZF WG161 y peso de 21.837 kg. El centro de carga indicado es específico de esta referencia y no debe sustituirse por el de otras GDP160EF.",
    "short": null
  },
  "6542": {
    "source": "9a8acd46317d9d80779c5acd03810bc14a1f8a6bc2f5d67a9c4f68547f865885",
    "prepared": "316dd9785d66882801b8e12a928bd6055acf97ac5fef80f004e7ac6ee3d6fa28",
    "general": "La XCMG XGA43K es una plataforma articulada diésel para trabajos de acceso en altura en instalaciones y obras. La ficha declara una altura de 43 m, capacidad de cesta de 460 kg y peso de 24.500 kg. La configuración de brazos permite desplazar la cesta respecto a la base, pero el alcance efectivo y la carga permitida en cada posición deben comprobarse en su diagrama de trabajo.",
    "short": null
  },
  "2301": {
    "source": "cf9f8b1896aae2b7585e6c19a12798a76b675afb8d08e5762c5401aa493ccc2b",
    "prepared": "2bd3756496954e72de6f4a8aeb8e9dc33e9f14c5857bc2cfded1189de124bbc9",
    "general": "El Yale MC15 es un apilador eléctrico de conducción a pie para transporte interno y apilado de mercancía paletizada. La ficha indica capacidad nominal de 1.500 kg y dimensiones de 3.042 × 939 × 2.325 mm. Los campos originales de centro de carga, radio de giro y batería mezclan magnitudes y unidades; se omiten para evitar presentar cifras ambiguas como prestaciones de la máquina.",
    "short": null
  },
  "2232": {
    "source": "16c80b8089ddf42b19b2428ebfd6ef50f0c967c74611b57eb7b68bb799c84ef3",
    "prepared": "85e1642ad1b45b6384b1d22b5b7103551defdc5e51d93dd4fc3e330f03afd370",
    "general": "La Yale MR16HD es una carretilla retráctil para el apilado de palés en pasillos de almacén. La ficha declara capacidad de 1.600 kg y dimensiones de 2.538 × 1.265 × 3.227 mm. Publica alternativas de batería de 48 V con capacidades entre 560 y 775 Ah, sin identificar una capacidad instalada única; la configuración de batería y mástil debe verificarse para la unidad seleccionada.",
    "short": null
  },
  "4725": {
    "source": "d5c6615986a093bb4e68e4e1f898360a4c9f97efa57a29943f9c2e8b22b02b80",
    "prepared": "76193e922e77167bb7377ae3841947978000c13bee71c69c3cfc417890df2907",
    "general": "La CTE ZETA 23 es una plataforma articulada instalada sobre camión para mantenimiento e intervenciones de acceso en altura. Su ficha anuncia 23 m de altura y 250 kg de capacidad de cesta. La articulación permite trabajar en puntos desplazados respecto al vehículo, dentro de los límites de alcance y estabilización indicados por el fabricante para la configuración utilizada.",
    "short": null
  },
  "2050": {
    "source": "f872ddef1d00557102c64b608d93dec07faea8b71bcc85a3cd843a7696dd3fd2",
    "prepared": "f3f62d405cef9c90e33e2123cd228a69ee0d2358c2fc89bc7b3ca7b733431aeb",
    "general": "La Hyster H32XD-9 es una carretilla diésel de gran tonelaje para la manipulación de mercancías industriales. La ficha declara 32.000 kg de capacidad a 1.200 mm de centro de carga y 9.850 mm de elevación. Indica motor MTU 10.7L Diesel, un peso de 52.385 kg y anchura de 3.430 mm. Los accesos, el pavimento y el diagrama de cargas requieren comprobación específica para esta máquina.",
    "short": null
  },
  "3134": {
    "source": "15b43e920fd6f08d5c72437340bb262355a57bc5700828167b3ced2f0f98b9c1",
    "prepared": "6515b14d09d04d7a86a9dcf275c1239aa0f2aa1e77084cadf1e794c2081eb0f6",
    "general": "La Hyster H5.0UT6 es una carretilla elevadora diésel destinada a movimiento de palés y cargas industriales. Según la ficha, admite 5.000 kg a 600 mm de centro de carga y alcanza 4.700 mm de elevación. Mide 4.715 × 2.020 × 2.500 mm y declara 8.360 kg de peso. La selección del equipo debe contemplar las dimensiones de paso y la capacidad residual con el mástil instalado.",
    "short": null
  },
  "2302": {
    "source": "0d4f4873d0adb52ee68d9b5d0264ca31b47f7a0661679e7fa063d12d7f240785",
    "prepared": "41c58ffaa0061ac608d052367298f924f4f3ffcb486221b1564e9950fb80c554",
    "general": "El Yale MO10 es un preparapedidos eléctrico orientado a operaciones de picking y traslado interno de mercancías en almacén. La ficha declara una capacidad nominal de 1.000 kg, un peso de 2.890 kg y batería de 48 V y 310 Ah. El campo original de altura de plataforma combina una cifra con unidades incongruentes, por lo que no se reproduce como altura técnica acreditada.",
    "short": null
  },
  "2365": {
    "source": "37c34a35513afc79dfa9bca4212ffefe512c5cd96a0f153642f655aba70c9777",
    "prepared": "93914b46eb17d8ba3fcef7624dbbdeaee26e147eb3ca8993aa146f1d05122de8",
    "general": "El Bravi SOLO GYPS es un equipo de elevación concebido para facilitar el posicionamiento de paneles durante trabajos de instalación. La ficha anuncia una altura de elevación de 4,9 m y una capacidad de carga de 120 kg. Su aplicación debe comprobarse conforme a las instrucciones del fabricante y a las limitaciones de carga y colocación del conjunto, sin tratarlo como una plataforma de personal de otra serie.",
    "short": null
  },
  "52": {
    "source": "a8fb7be2c35b64c7f4eda90b183ecc1f0dbdb1f4b9658a9ab2f89637e83d4d8d",
    "prepared": "5040c4259fcef8bfa3ba6fd7abd9de15b306d448cb65fa3456153c4b072f36b1",
    "general": "La Hyster R2.0 es una carretilla retráctil para almacenamiento en estanterías y transporte de palés en pasillos de almacén. La ficha declara 2.000 kg de capacidad y elevación de 8.150 mm. Publica alternativas de batería a 48 V entre 560 y 775 Ah, sin identificar una capacidad única instalada. Las dimensiones de la máquina son 2.538 × 1.265 × 2.195 mm.",
    "short": null
  },
  "53": {
    "source": "4263f8df4fc6bbb56c2646a55b0193606f3102bed3b6a7db70d79234aee3d228",
    "prepared": "63b87f4a7ed1be9af1ae6f775c03cd09d8e7315c1082e283b2df001e5b44f1cb",
    "general": "La Hyster R2.5 es una carretilla elevadora retráctil diseñada para operaciones de apilado en almacenes. La ficha indica 2.500 kg de capacidad, elevación de 8.150 mm y dimensiones de 2.615 × 1.345 × 2.195 mm. Se anuncian opciones de batería de 48 V entre 700 y 930 Ah; esta variedad no determina la batería concreta suministrada con una unidad.",
    "short": null
  },
  "5081": {
    "source": "06807fe26d97e1c7efc38111c1f42ffddebad571f4653da53aad1424fefc2942",
    "prepared": "54c042ead314c4cdb748e95358e24d3dfeec359c4b9512dc4301019edfbcd387",
    "general": "El Yale MSC12 es un apilador eléctrico de conducción a pie para movimiento de palés y colocación de cargas en almacén. Su ficha declara una capacidad de 1.200 kg y peso de 600 kg. Los datos dimensionales deben contrastarse con el espacio de paso y la configuración de mástil de la máquina; no se deducen altura de elevación, autonomía ni equipamiento opcional que el anuncio no acredite.",
    "short": null
  },
  "1022": {
    "source": "0c4566dd1c1b3731d30a50137c0debe9f0eae84dff0c25f912bee07bb4fe2ba7",
    "prepared": "e1d381eeec062a2d47399560b99b68edb9adc629f403b3c5176bcb32c6caa224",
    "general": "La Hyster PC1.5 es una transpaleta eléctrica compacta de conductor a pie, con capacidad de 1.500 kg y batería de litio extraíble. Las especificaciones declaran longitud de 1.622 mm, anchura de 685 mm, peso de 120 kg y centro de carga de 600 mm. El origen ofrece capacidades de batería diferentes; no se identifica una única configuración instalada.",
    "short": null
  },
  "2016": {
    "source": "fa2baae0cc091cf926961f0d8ea5a72d33ca37ec1d77a4fe2fa1448ffa82978c",
    "prepared": "99be6a1ec620689c9ebf2db5e1f172a4c2e9229df5ff4a33873d8fdfbf7a9c94",
    "general": "La Hyster J1.8UTT es una carretilla elevadora eléctrica para operaciones de carga y apilado en almacén. Las especificaciones de esta referencia publican 1.600 kg de capacidad a 500 mm de centro de carga, elevación de 6.000 mm, batería de 48 V y 460 Ah y peso de 3.120 kg. El resumen comercial anterior indicaba otra capacidad, que no se considera acreditada.",
    "short": "Carretilla eléctrica Hyster J1.8UTT, 1.600 kg de capacidad y elevación de 6.000 mm según ficha técnica."
  },
  "2028": {
    "source": "e906f7c182ac51c6884ee447d201df351be5bec72b0e33775d46f7d1d628c73d",
    "prepared": "b368243ef39d998deeb40e398202ea0c702e6bba0f54ec3a60340a40675c2e4c",
    "general": "La Hyster E5.0XNS es una carretilla elevadora eléctrica de 5.000 kg de capacidad nominal para movimientos de carga en áreas de manutención. La ficha indica elevación de 5.740 mm, centro de carga de 500 mm, batería de 80 V y 675 Ah y peso de 8.121 kg. Sus dimensiones declaradas son 3.748 × 1.420 × 2.138 mm; la elección del mástil debe contrastarse con el espacio operativo.",
    "short": null
  },
  "2049": {
    "source": "556f020129181d6a8f41e26f2df823469e05b218dea1a2c52b0d96789eee5cad",
    "prepared": "e89e216f752c1e45174fb752ce7f61f6815431b9ac9df46a2fd10e6521f0ef13",
    "general": "La Hyster H32XD-12 es una carretilla diésel de gran capacidad para manipulación industrial pesada. La ficha técnica de esta referencia declara 32.000 kg de capacidad a 900 mm de centro de carga, elevación de 9.850 mm, motor MTU 7.7L Diesel y peso de 45.868 kg. El anuncio original contiene otras cifras de capacidad y centro de carga; no se atribuyen a esta ficha como valores confirmados.",
    "short": "Carretilla diésel Hyster H32XD-12, 32.000 kg de capacidad y 9.850 mm de elevación según ficha técnica."
  },
  "2061": {
    "source": "2122485ccb5c4960d65a3bf86decb939cdbc289ea0ac2a75bb0d1eba41939579",
    "prepared": "cc3a1e9f4720d9e7ff12daecb1b2556d3cf2dcfdb1b40935d633c467207ad609",
    "general": "La Hyster H13XDS6 es una carretilla elevadora diésel de gran tonelaje para manutención industrial. Las especificaciones de esta referencia indican 13.500 kg de capacidad a 600 mm de centro de carga, elevación de 7.000 mm y peso de 18.483 kg. Sus dimensiones declaradas son 6.544 × 2.541 × 4.193 mm. No se trasladan cifras de capacidad diferentes del texto comercial original.",
    "short": null
  },
  "2074": {
    "source": "f995be9f851962451e193f15bc74d00e32c52077178999b5e288dc5e65795aa7",
    "prepared": "ac3cd9b7eec89a72f0cbc2149919e53d475e1e32510b2df33e3ef389c6f47fde",
    "general": "La Hyster S5.5FTS es una carretilla elevadora contrapesada de 5.500 kg de capacidad, con elevación declarada de 5.300 mm, centro de carga de 500 mm y peso de 7.618 kg. El origen publica alternativas de motorización diésel y GLP, mientras identifica la ficha comercial como diésel; no se atribuye a la unidad un motor GLP específico del texto general anterior.",
    "short": null
  },
  "2138": {
    "source": "41bd639800b9ce68a18cb7328b480271fe466d96aca42a7fe075c28671728f34",
    "prepared": "bd8301e3c60e92501e501c465cca6307c8660556cf0086e5c208ca4d5a79e185",
    "general": "La Hyster P2.0 es una transpaleta elevadora eléctrica para transporte horizontal de palés, con 2.000 kg de capacidad y elevación publicada de 0,13 m. El registro declara 632 kg de peso y distintas configuraciones de batería a 24 V, convencionales o de ion-litio. Las opciones de batería no se atribuyen como equipo concreto suministrado con esta referencia.",
    "short": null
  },
  "2159": {
    "source": "7d2dc22afff4b6cc2f51c63bc2d79f4b4403f693405657fad6aefde061de0cbc",
    "prepared": "24b5b71dc9c799147c19c756373a613d7a4e053b4d8692723981473b28870232",
    "general": "La Bravi Lui 460 es una plataforma elevadora eléctrica de dimensiones compactas para trabajos de acceso en altura. La ficha técnica declara 6,62 m de elevación, 280 kg de capacidad y 1.250 kg de peso, con anchura de 760 mm. El resumen original mencionaba 180 kg; esta descripción utiliza únicamente los 280 kg de las especificaciones de la referencia.",
    "short": "Plataforma elevadora eléctrica Bravi Lui 460, 6,62 m de elevación y 280 kg de capacidad según ficha técnica."
  },
  "2162": {
    "source": "a12cd8278b779f18566d600039fd2597d1da46cd66b3e306898c5812f3cfce8c",
    "prepared": "117d124f53b58ccaf8d53132d9f8df416748f2291031b0b895855c53791c6f33",
    "general": "La Hyster H11XD-ECD9 está anunciada para la manipulación de contenedores, con 10.000 kg de capacidad a 1.220 mm de centro de carga. La ficha técnica especifica 18,92 m de elevación, motor MTU 7.7L Diesel, transmisión ZF 5WG211 y peso de 41.886 kg. El dato comercial de 119 m del resumen original no corresponde a la elevación registrada en la ficha.",
    "short": "Manipulador de contenedores Hyster H11XD-ECD9, 10.000 kg de capacidad y 18,92 m de elevación según ficha técnica."
  },
  "2167": {
    "source": "cd6a475c899708c148438aae48b5ba61728f1d3c983becba3752c4277981c09d",
    "prepared": "7d1424e2c182bb76a1afc89ca937ed9890955048fa4a3fdb20c28676380b0e5a",
    "general": "La Hyster H7XD-EC4 es una máquina para la manipulación de contenedores en terminales y áreas logísticas. Su ficha declara 7.000 kg de capacidad a 1.220 mm de centro de carga, elevación de 9,9 m y peso de 24.590 kg. Se identifica motor Mercedes-Benz OM 934 Stage V y transmisión ZF 3WG161. Los sistemas de seguridad promocionales no sustituyen la documentación técnica de la configuración vendida.",
    "short": null
  },
  "2168": {
    "source": "216aaf590a4c41972976d925b9a2067252c954ad2af46b2c6fcb3666c57ec72a",
    "prepared": "00d230d850b9c42661fd16cd1a76fb0496f9e93ad1dcc77700aa0a6303f16426",
    "general": "La Hyster H8XD-EC6 es una máquina de manutención de contenedores. Las especificaciones de esta referencia indican 8.000 kg de capacidad a 1.220 mm de centro de carga, elevación de 16,16 m, motor MTU 7.7L Diesel y peso de 35.508 kg. La descripción corta anterior anunciaba 48 toneladas y otro motor; esas características no se atribuyen a esta máquina.",
    "short": "Manipulador de contenedores Hyster H8XD-EC6, capacidad de 8.000 kg y elevación de 16,16 m según ficha técnica."
  },
  "2172": {
    "source": "e44c330707c52eadc1955907a6510c9f4e74c599f0ec9afb51a1196813f983c4",
    "prepared": "9d71dfcbb71723243838e299121010677aed97045f4f0b86aadbc83998b72f62",
    "general": "La Hyster H9XDL6 es una carretilla elevadora de alta capacidad para movimiento de cargas industriales. El registro técnico señala 9.500 kg de capacidad a 600 mm de centro de carga y elevación de 7.000 mm, con peso de 13.535 kg. Publica longitud de 5.724 mm y anchura de 2.490 mm. No se asignan prestaciones opcionales ni datos de motor que no constan en las especificaciones de esta referencia.",
    "short": null
  },
  "2173": {
    "source": "ff4c2d8fbb76d6a3ade48be9419990d5e2b2d70d907cdba50ba6a9f2f5c2170c",
    "prepared": "7c936d56b61d2c848a570619021855b50911f72ffbbf4d10488321efcd620c5a",
    "general": "La Hyster H9XD-ECD8 es una máquina de manipulación de contenedores cuya ficha declara 9.000 kg de capacidad a 1.220 mm de centro de carga. Publica elevación de 18,92 m, motor MTU 7.7L Diesel, transmisión ZF 5WG211 y peso de 40.853 kg. Los elementos de equipamiento citados en el texto comercial deben confirmarse para la configuración concreta.",
    "short": null
  },
  "2183": {
    "source": "bc9374818b598696ccc350b96dba222f62096b55e078b778c044215ecab7c586",
    "prepared": "fb807dfb444bba7bcaaaf1830e8001147eeb4ac4874620730f656e7d8227a907",
    "general": "La Hyster H9XD-ECD7 está destinada a operaciones de manipulación de contenedores. En esta referencia se declaran 11.000 kg de capacidad a 1.220 mm de centro de carga, elevación de 21,5 m, motor MTU 7.7L Diesel y peso de 44.198 kg. El texto promocional menciona un motor Cummins diferente; se conserva el dato de motor de las especificaciones sin confirmar equipamiento adicional.",
    "short": null
  },
  "2241": {
    "source": "c91505c968d1c6edf968dcbea00800d8332494cd1a2d9a6d52c5493da88bb543",
    "prepared": "88c5e6abe864cd89045f9df00dd55f5cd1de7f09c636f30e8161cf4336d6f81a",
    "general": "El Yale MO10S es un preparapedidos eléctrico para operaciones de picking en almacenes. Su ficha indica 1.000 kg de capacidad nominal, batería de 48 V y 560 Ah y peso de 4.065 kg, con dimensiones de 3.242 × 1.200 × 3.720 mm. El campo de centro de carga contiene un valor anómalo y no se utiliza para deducir capacidad adicional ni geometría operativa.",
    "short": null
  },
  "2649": {
    "source": "51279991bcad9b7d32d75553953493b8654d7f3b2362295b1811101870bbdfa3",
    "prepared": "6f49b09ec7f90005a29638e87af7a97bfed25c26657f0a00215ec0f59b15ac1d",
    "general": "El BLYYD V2 es un tractor eléctrico de arrastre para desplazamiento de cargas en entornos industriales. La ficha publica 38.000 kg en el campo de capacidad de carga, potencia de motor de 55 kW, velocidad de 20/24 km/h con y sin carga y peso de 8.550 kg. Esos datos se presentan como declarados por el proveedor; la capacidad de remolque homologada debe verificarse para el uso concreto.",
    "short": null
  },
  "4776": {
    "source": "b671962386ab83ff8d2810656126008af47e7dd7b800967d1b1a453acac01946",
    "prepared": "67dcde77ae0c500c50b5e638a4f86d8c78b61e562a6c9da078de5c543d7c7ab2",
    "general": "La XCMG XGA22ACK1 es una plataforma articulada eléctrica nueva para trabajos de acceso en altura. La ficha técnica indica 22 m de elevación, 350 kg de capacidad de cesta, 10.400 kg de peso y dimensiones de 8.490 × 2.400 × 2.380 mm. La batería se identifica como de plomo en las especificaciones; el texto comercial original menciona litio, por lo que esa química no se da por acreditada.",
    "short": null
  },
  "6206": {
    "source": "c7efd17dce96c942db4612c4723ab4f196b14c7d4fed099a75d33d3630d466d2",
    "prepared": "9e6e835ab2261137da177f1ec370ecf50ff76d14bc48f3d97f160ab7bff22bc6",
    "general": "La Manitou 170AETJL-BI es una plataforma articulada eléctrica de ocasión con 17 m de elevación y 230 kg de capacidad de cesta, según la ficha. Esta unidad se identifica por el número de serie 966862 y ubicación Alicante; sus dimensiones publicadas son 5.250 × 1.900 × 2.100 mm y pesa 7.435 kg. El horómetro figura sin lectura válida, por lo que no se atribuyen horas de uso.",
    "short": null
  },
  "6545": {
    "source": "60558e6361369050e3cce6a4859a0c83e3ab912bec19cfd434bbdf738f247f76",
    "prepared": "4710d8fdccd212005a3167fd32d9d91769bed56fa3da8603b167f6b8ce9ba997",
    "general": "La Samag MICRON INOX es una transpaleta eléctrica de conducción a pie para el desplazamiento de palés, con 1.600 kg de capacidad declarada. Esta unidad de ocasión, serie 25996, figura en Málaga con 521 horas y horquillas de 1.150 × 560 mm. Su ejecución inoxidable está indicada en el modelo del anuncio; no se le asignan prestaciones o certificaciones higiénicas no acreditadas por la ficha.",
    "short": null
  },
  "6585": {
    "source": "64c392bfa37ed48e17bbbca04c710cba08569a2fc29d8f6249682bbd23b522df",
    "prepared": "2b1eb1b41fe58a22ea1ee94821fcedeed0683de900472f24cd99354a5f191d75",
    "general": "La Hyster J2.0XNT MWB es una carretilla eléctrica triciclo de segunda mano, fabricada en 2021, con 2.000 kg de capacidad y elevación de 4.900 mm. La unidad K160B16988V se encuentra anunciada en Tarragona con 4.503 horas, desplazador lateral y horquillas de 1.200 mm. El origen indica un estado de baterías del 50 %, dato referido a esta unidad.",
    "short": "Carretilla eléctrica Hyster J2.0XNT MWB de segunda mano, 2.000 kg de capacidad y 4.900 mm de elevación."
  },
  "6707": {
    "source": "81fc1a77478fb00f124eadd06af9604ab0ba91defae384659a1f0f401cf9e7dc",
    "prepared": "e8acc43404bec21b9eec135619de40d4ce8f9eb31c68c79d2354f01005460c08",
    "general": "La Lifter GS/I 25S4 RA es una transpaleta manual para movimientos cortos de palés. Esta unidad de segunda mano, fabricada en 2022, tiene capacidad declarada de 2.500 kg, longitud de 1.550 mm, anchura de 525 mm y peso de 63 kg. Consta con número de serie HLI0979054 y ubicación Granada. No se interpreta como tiempo de funcionamiento la cifra de horómetro consignada para este equipo manual.",
    "short": null
  },
  "6817": {
    "source": "5e3cae6b69d24be7329d9f50cae1f0cd07f09464720c071b864c694d936acfab",
    "prepared": "b662575fe14ea5519345fd4695978c58a2c1d3989dc2f863ef148b47671094df",
    "general": "La Cesab B318LII es una carretilla eléctrica triciclo usada de 1.800 kg de capacidad y 4.500 mm de elevación. La unidad, serie CE4344415, figura en Madrid con 2.427 horas, mástil tríplex, 1.600 mm de elevación libre y desplazador lateral. El anuncio menciona un cargador trifásico 48/120; la anchura del origen contiene cifras mezcladas y no se reproduce como dimensión acreditada.",
    "short": null
  }
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const sourceDigest = (record: ProductRecord): string => digest(JSON.stringify([
  record.providerId, record.reference, record.url, record.title, record.brand,
  record.model, record.externalReference, record.condition, record.categoryKey,
  record.categoryName, record.shortDescription, record.longDescription, record.specs,
  record.price
]));

export const resolveGamVerifiedSourceMatchedEditorial = (
  record: ProductRecord, short: string | null, general: string | null
): { readonly short: string | null; readonly general: string } | null => {
  const item = record.reference ? evidence[record.reference] : undefined;
  if (record.providerId !== "gam" || !item || !short || !general ||
    sourceDigest(record) !== item.source ||
    digest(JSON.stringify([short, general])) !== item.prepared) return null;
  return { short: item.short ?? short, general: item.general };
};
