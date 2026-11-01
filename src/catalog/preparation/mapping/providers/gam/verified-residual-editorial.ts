import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

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
  }
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const sourceDigest = (record: ProductRecord): string => digest(JSON.stringify([
  record.providerId, record.reference, record.url, record.title, record.brand,
  record.model, record.externalReference, record.condition, record.categoryKey,
  record.categoryName, record.shortDescription, record.longDescription, record.specs,
  record.price
]));

export const resolveGamVerifiedResidualEditorial = (
  record: ProductRecord, short: string | null, general: string | null
): { readonly short: string | null; readonly general: string } | null => {
  const item = record.reference ? evidence[record.reference] : undefined;
  if (record.providerId !== "gam" || !item || !short || !general ||
    sourceDigest(record) !== item.source ||
    digest(JSON.stringify([short, general])) !== item.prepared) return null;
  return { short: item.short ?? short, general: item.general };
};
