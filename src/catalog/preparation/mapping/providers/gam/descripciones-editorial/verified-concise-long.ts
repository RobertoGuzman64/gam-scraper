import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";

type ConciseGeneralEvidence = {
  readonly sourceDigest: string;
  readonly preparedDigest: string;
  readonly general: string;
};

const verified: Readonly<Record<string, ConciseGeneralEvidence>> = {
  "5994": {
    sourceDigest: "b39bdaf90cd358b512e0b6c63673358717f9b0e17df81adfefbcd73d5dab3677",
    preparedDigest: "fca41d24e6f80a12c868d44795ea95dc4a6fd3903f8be536f58e73673eae57d0",
    general: "La Yale ERP5.0MXLGS6 es una carretilla elevadora eléctrica para manipulación de palés y cargas en instalaciones industriales. La ficha declara 5.000 kg de capacidad nominal a 600 mm de centro de carga y una elevación de 3.000 mm. Sus dimensiones publicadas son 4.345 mm de longitud, 1.924 mm de anchura y 2.250 mm de altura. El peso indicado es de 7.420 kg. La elección del mástil y la capacidad residual deben comprobarse para cada aplicación."
  },
  "5989": {
    sourceDigest: "5fe48dfa07fa119149682814ac8acfd04753b7a4d4ec19e47eca63d7621f3c5c",
    preparedDigest: "f8c5ca5ecb365e1381c3faebb51aced7f8dd433b7fb64904dae63415df33bebc",
    general: "La carretilla elevadora eléctrica Yale ERP2.5MXLG permite el traslado y la elevación de mercancías en zonas de almacén y operaciones de carga. La ficha técnica declara una capacidad de 2.500 kg a 500 mm de centro de carga y una altura de elevación de 3.000 mm. Mide 3.690 mm de longitud, 1.160 mm de anchura y 2.010 mm de altura, con un peso de 3.900 kg. Para operar en estanterías hay que comprobar el mástil y la capacidad residual."
  },
  "5990": {
    sourceDigest: "f5cb19b66702c2a67948050ac1d398a14a3178eebb4e514b00cc3e8891644659",
    preparedDigest: "2233235b68a88c8ac0ae725d7d0a5ab9e2bb7dc24f28c3c03a8cd6cfdd760d53",
    general: "La Yale ERP3.0MXLG es una carretilla elevadora eléctrica destinada a carga, descarga y manutención de palés en entornos logísticos. Su capacidad nominal publicada es de 3.000 kg con centro de carga de 500 mm; la elevación consignada es de 3.000 mm. La ficha indica 3.760 mm de longitud, 1.230 mm de anchura, 2.150 mm de altura y 4.330 kg de peso. La altura del mástil y la carga admisible en elevación se deben contrastar con el trabajo previsto."
  },
  "4662": {
    sourceDigest: "1a2acd4c655587c2e5e59609cb41f36efddf574b4948f98ec7d3c3df714210fa",
    preparedDigest: "0751d802d3368be6b713e57c2c63cc02038759353cf162c44b901aedec5d94dc",
    general: "La CTE ZED 25 HV es una plataforma articulada sobre camión para acceso a puntos elevados en mantenimiento e instalaciones. El anuncio indica 25 metros de altura de trabajo, 12 metros de alcance lateral y capacidad de cesta de 250 kg. Su configuración articulada facilita el posicionamiento alrededor de obstáculos, sujeto a las condiciones de estabilización. El alcance admisible depende de la carga y de la posición de los apoyos, que deben verificarse antes de utilizarla."
  },
  "6166": {
    sourceDigest: "beb1b0dc6533eba325df4123ba0e55247ce42e8f8914708ae826d4417c574164",
    preparedDigest: "8578436eb3eb0a7be88d1c58229e179aa69317ab8e370b04eece417bf607ae95",
    general: "La plataforma telescópica sobre camión CTE B-LIFT 20 J AUTO incorpora brazo telescópico con jib y sistema de estabilización automática según la descripción de origen. Su altura máxima de trabajo indicada es de 19,7 metros, con 12 metros de alcance lateral y capacidad de cesta de 230 kg. La ficha declara un peso de 3.500 kg. Las condiciones de apoyo y el diagrama de trabajo determinan el alcance operativo disponible con la carga prevista."
  },
  "4844": {
    sourceDigest: "09a6fa7f51042ce9d8f2c9ae177505aa637514a102a494c2828cf12c6d3d995b",
    preparedDigest: "51b165616060f49618d9e86c3a96f4a829e7c048bbdf88da42f40b713a1edf39",
    general: "La CTE B-LIFT 18 HD FIB es una plataforma telescópica montada sobre camión con cesta de fibra, orientada a mantenimiento e instalaciones en altura. Su ficha consigna 18 metros de altura de trabajo y una capacidad de cesta de 300 kg; el texto de origen menciona un alcance lateral de 12,5 metros. La presencia de una cesta de fibra no debe interpretarse por sí sola como certificación de aislamiento para trabajos eléctricos: hay que verificar el equipamiento y las condiciones de uso."
  },
  "4657": {
    sourceDigest: "106b863eb849dbb2eb545ed142ca43e356df247eb5c2fbe5549a223c3a84d095",
    preparedDigest: "760623e6ba4374ad22cd03b3293c33ec4065300e810fd7b618caeba3d866a8c5",
    general: "La CTE TRACCESS 170E es una plataforma articulada sobre orugas con accionamiento eléctrico, adecuada para tareas de mantenimiento en puntos con acceso reducido. La altura indicada en la ficha es de 17 metros y la capacidad de cesta de 200 kg. El tren de orugas permite desplazar la máquina hasta la zona de trabajo; su utilización en pendiente requiere comprobar los límites del fabricante y el apoyo de los estabilizadores. No se atribuye una autonomía de batería sin dato de la configuración concreta."
  },
  "6172": {
    sourceDigest: "1120d7bc85660937dec42b8634dcf667cbcc908be55d0f68373fc1a92f13ad6e",
    preparedDigest: "ce6ab7d4a12b9bc0c875c2f8d0940a2cf10a27f9c2b9aba16d032afc1b47709f",
    general: "La CTE TRACCESS 230E es una plataforma sobre orugas de accionamiento eléctrico destinada a intervenciones en altura con acceso condicionado. El anuncio declara 23 metros de altura de trabajo y una capacidad de cesta de 200 kg; el texto de origen indica hasta 9,5 metros de alcance lateral. El brazo articulado permite posicionar la cesta evitando determinados obstáculos. La carga de la cesta, la estabilización y el terreno condicionan el alcance efectivo."
  },
  "6164": {
    sourceDigest: "4ce42a5dec47c9b83df835efd7a3dc593261cff8a79c63fba4e6fc1ac352a6e2",
    preparedDigest: "717433911fa567d37765adc0d82eb181efbe0cfc70b821bd0660ab448c53f50e",
    general: "La CTE B-LIFT 18 AUTO es una plataforma telescópica sobre camión para mantenimiento urbano e instalaciones técnicas. La ficha recoge 17,7 metros de altura máxima de trabajo, 10,5 metros de alcance lateral y capacidad de cesta de 230 kg. Su descripción incluye estabilización automática y el peso declarado es de 3.500 kg. Antes de cada operación deben comprobarse la superficie de apoyo, el despliegue de estabilizadores y la carga admitida en el diagrama de trabajo."
  },
  "4656": {
    sourceDigest: "af46b197cc7d7405344dfce0b9f40dee859d17ea647b9b2a9168bfbab71f9c42",
    preparedDigest: "199e40c63868a040c8c5763cdf1dda6ab3e3a5c8d4c2b5cb86f14962c33b2116",
    general: "La CTE TRACCESS 170 es una plataforma articulada sobre orugas cuya ficha de esta referencia describe motorización de gasolina. Indica 17 metros de altura de trabajo y capacidad de cesta de 200 kg. Sus dimensiones publicadas son 4.250 mm de longitud, 800 mm de anchura y 2.000 mm de altura, con un peso de 2.050 kg. El formato estrecho resulta relevante para accesos limitados, pero deben comprobarse el paso disponible, la estabilización y la ventilación del entorno."
  },
  "4723": {
    sourceDigest: "6f2c533659efe2e13eb46d1b7606b48214122cc3f96f1ef2f53f3212c71f8134",
    preparedDigest: "8f9a1b408e5df003de9804fbc833b6a2ca81376b80fa3434a53a0532c52ea3f1",
    general: "La CTE TRACCESS 170 de esta referencia es una plataforma articulada sobre orugas con motorización diésel, distinta de la oferta de gasolina del mismo modelo. La ficha indica 17 metros de altura de trabajo y 200 kg de capacidad de cesta. Declara 4.250 mm de longitud, 800 mm de anchura, 2.000 mm de altura y 2.050 kg de peso. Para planificar su utilización se deben contrastar acceso, superficie de estabilización y restricciones a motores de combustión."
  },
  "4655": {
    sourceDigest: "18ed2aeb26ad0278ece574ee18e49c9d24b81fe8cea4429f6925fb4e006d91ed",
    preparedDigest: "f02e40a37779e0408ab4a8550ccb0a2a244443fc8369f9ff4c73999669c50976",
    general: "La CTE TRACCESS 135 anunciada en esta referencia es una plataforma articulada sobre orugas con motor diésel para tareas de acceso en altura. La ficha publica 13,5 metros de altura de trabajo y capacidad de cesta de 200 kg. Sus dimensiones son 3.760 mm de longitud, 780 mm de anchura y 2.000 mm de altura, con peso de 1.600 kg. La anchura contenida facilita el estudio de accesos estrechos, sin sustituir la comprobación de apoyos y condiciones del terreno."
  },
  "4653": {
    sourceDigest: "bab069f02cbd647375b3fa5b442336a15ae36985f6609155f6dd6cb7f06acb07",
    preparedDigest: "2fc3a277a6e0334bf1f49e89ec7cc4cf37816cdeaaf4b78cb2b1ecc02694b13b",
    general: "La CTE TRACCESS 270 es una plataforma articulada sobre orugas orientada a trabajos elevados y de acceso complejo. La ficha declara 27 metros de altura de trabajo, 250 kg de capacidad de cesta y 4.355 kg de peso; el texto original menciona 14 metros de alcance horizontal. Sus dimensiones publicadas son 6.461 mm de longitud, 1.400 mm de anchura y 2.020 mm de altura. El diagrama de trabajo debe contrastarse con la carga, el apoyo y la geometría de cada intervención."
  },
  "4724": {
    sourceDigest: "94399723b09dc799bc8eaea3626acdd32a056db895fa6781821078dce4492da3",
    preparedDigest: "a515e6c5060cd4557404fa3b1cb52f3584809ae4f345cb41336ee5cf7f9b2b57",
    general: "La CTE TRACCESS 135 de esta referencia es una plataforma articulada sobre orugas con motorización de gasolina, según la ficha técnica. Indica una altura de trabajo de 13,5 metros y una capacidad de cesta de 200 kg. Sus dimensiones declaradas son 3.760 mm de longitud, 780 mm de anchura y 2.000 mm de altura, con un peso de 1.600 kg. Antes de trabajar deben revisarse accesos, apoyo de los estabilizadores y las condiciones de ventilación del emplazamiento."
  },
  "4813": {
    sourceDigest: "df4a958ee09193a693b73716b99b197acd4abd45abb064a033ad5f3c4a1df58f",
    preparedDigest: "a183e2d033b21e52a89eed150db8715e9130defd89b72fe79a0260a69789c4d8",
    general: "El XCMG XT2506KH es un manipulador telescópico para elevación y colocación de materiales en obra e instalaciones logísticas. La ficha técnica declara una capacidad nominal de 2.500 kg y una altura de elevación de 6 metros. Mide 3.930 mm de longitud, 1.835 mm de anchura y 1.975 mm de altura, con un peso publicado de 5.200 kg. La carga admisible a cada altura y alcance debe comprobarse en el diagrama de cargas correspondiente."
  },
  "5903": {
    sourceDigest: "429cfbd48c481b7ad7eb95a0f68703448cbe40a6da2c6771d198835c5482d279",
    preparedDigest: "f42eeca745006eadbac927964e40487363a5c29159fc35cc32bb6ece74f83aee",
    general: "La BRAVI Residential 170 es una plataforma elevadora eléctrica compacta para intervenciones en altura con acceso limitado. La ficha indica 3,7 metros de altura de trabajo, capacidad de cesta de 180 kg y un peso de 360 kg. Sus dimensiones publicadas son 1.155 mm de longitud, 673 mm de anchura y 1.747 mm de altura. El tamaño del equipo ayuda a valorar pasos y zonas de maniobra; la resistencia del suelo y las condiciones de uso deben verificarse antes de elevar la plataforma."
  },
  "2251": {
    sourceDigest: "ec899f73d2d5219fdbfcd568a007b7bf94b4eecbd4aa00c39bcf974a3f25094a",
    preparedDigest: "646388aa6b6479eadec11cd498a23f140990038eab5f12c2ffc50f831a5812f2",
    general: "La Yale MP20XUX es una transpaleta eléctrica identificada como de conductor montado en el título y en la URL de esta referencia. Está orientada al transporte horizontal de palés en operaciones de almacén y expedición. La ficha publica 2.000 kg de capacidad nominal, 1.830 mm de longitud y 750 mm de anchura, con un peso de 710 kg y alimentación de 24 V y 210 Ah. La selección debe tener en cuenta el tamaño de los palés, la anchura de los pasillos y el estado del pavimento."
  },
  "2259": {
    sourceDigest: "9f67021de1ea62eed562a67c2182652e73571f9fad0331aafbdeacb878b78c65",
    preparedDigest: "32671c519532a094b84946e52133cb33700ed9281df356d4f1edca8feeb8994b",
    general: "La Yale MP16UX es una transpaleta eléctrica de conductor acompañante para desplazamiento horizontal de palés en almacenes. La ficha indica 1.600 kg de capacidad nominal, 1.666 mm de longitud y 710 mm de anchura, con un peso publicado de 424 kg. Sus medidas ayudan a evaluar el paso por puertas y la circulación por pasillos. La maniobrabilidad también depende del tamaño de la carga y del estado del pavimento."
  },
  "2249": {
    sourceDigest: "4454a68e105a69a1f4458c4bf35761a856e1fe34afcf6f777f801b09bec2c3ab",
    preparedDigest: "200523174229150cefc2036709ab6962bf9ce22ae452b7e1d445feb3edd420b2",
    general: "La Yale MP25X es una transpaleta eléctrica de conductor a pie destinada al movimiento de palés y cargas sobre superficies de almacén. Su ficha publica 2.500 kg de capacidad nominal y unas dimensiones de 1.944 mm de longitud y 750 mm de anchura, con 678 kg de peso. La configuración de batería no queda identificada de forma inequívoca en esta ficha, por lo que debe verificarse antes de planificar turnos o recargas."
  },
  "2136": {
    sourceDigest: "6356c0bd365826c83cc2f43848af9c029989979f6535ec1d367ed5d7d5e2bc55",
    preparedDigest: "3d9483c0cdf5b4ce375e556e0bcb519d32bf7dd365110d859a4599e7fb71f265",
    general: "La Hyster P1.6 es una transpaleta eléctrica de conductor acompañante para transporte horizontal de palés en muelles y almacenes. La ficha técnica publica 1.600 kg de capacidad nominal, un peso de 545 kg y una altura de elevación de horquillas de 0,13 metros. Esta elevación es propia de una transpaleta y no debe confundirse con la de un apilador para estanterías. Para elegirla conviene contrastar el tamaño de los palés, el recorrido y el estado del suelo."
  },
  "6666": {
    sourceDigest: "b29aee912d358c9b6c9c782603000cff79a4fb9c320087b4f4fed5bfd99e22f3",
    preparedDigest: "f710cdccafbed52afa4f8300e772eb8e81abaa990b2d94b4cb327d0152b0482d",
    general: "Carretilla elevadora Hyster GLP de segunda mano. La ficha técnica identifica el modelo H4.5FTS5 y el año 2019, mientras que el título menciona H4.5FTS6 y el texto comercial H4.5FT6 de 2020: la variante debe confirmarse antes de atribuirle equipamiento. Los valores técnicos de esta unidad son 4.500 kg de capacidad y 4.800 mm de elevación; el horómetro registra 4.263 horas. No se trasladan los 4.330 kg ni los 4,15 metros indicados en el texto contradictorio."
  },
  "5258": {
    sourceDigest: "1fd68ad81cfad731b39308debcce252798ef58c140b8d5ad10812c19f672fcd8",
    preparedDigest: "ed98a71f2832c78b7aa3d90476ae00fd6e3848d2263c67f492b99f61d83c638d",
    general: "Carretilla elevadora Hyster GLP de ocasión. El modelo H4.5FTS5 consta en la ficha y en la URL, pero el título anuncia H4.5FTS6 y el texto general describe H4.5FT6; no se da por resuelta esa discrepancia. La ficha publica 4.500 kg de capacidad, 4.145 mm de elevación y mástil tríplex. Registra 3.436 horas. El año 2019 figura en la URL, mientras que el relato comercial indica 2020, por lo que el año debe verificarse."
  },
  "6665": {
    sourceDigest: "f277abd441513a13ace6be5bdc414df9c4e8b16245a641928a86fa30491e6bdc",
    preparedDigest: "8981aacaa08ac54a96feb1bbabb88b39c080d2e3237a6cb22bc351d5ba69a5c8",
    general: "Carretilla elevadora GLP Hyster H5.0FT de segunda mano, con año de fabricación 2022 indicado en la ficha técnica. Sus especificaciones registran capacidad de 5.000 kg, altura de elevación de 6.000 mm y mástil dúplex, con 1.383 horas de horómetro. El texto de origen mezcla una motorización diésel y una elevación de 4 metros, incompatibles con el anuncio GLP y la elevación técnica; no se adoptan esas afirmaciones."
  },
  "6863": {
    sourceDigest: "57802f8c8e4f1ff4d9f87a520c853319ce444447a55a5d2918251c523aed4cfb",
    preparedDigest: "cf17c65d8a374eadd03766720f96344a9eff658418defd2466917713fca105fb",
    general: "Carretilla elevadora eléctrica Yale de ocasión. El título y la URL identifican ERP16VT MWB, pero la ficha técnica registra ERP16VF (MWB); debe confirmarse la variante antes de asociarle prestaciones de fabricante. La ficha de esta unidad publica 1.600 kg de capacidad, 5.500 mm de elevación, mástil tríplex y fabricación en 2016. El horómetro indica 24.122 horas. Se mantienen estos datos de la unidad sin resolver la discrepancia de modelo."
  },
  "6146": {
    sourceDigest: "4cab996292b05275dd105f9388bc211d1a1e90607ebbea346fa3d63faf1eb3b8",
    preparedDigest: "6ed4664fb0e02d640fbe4892e94cd9d1cca655562c09cb2057e5f524c9724335",
    general: "Carretilla elevadora eléctrica Unicarriers A1N1L18Q de ocasión, con 1.800 kg de capacidad y 4.750 mm de elevación declarados en su ficha técnica. El horómetro registra 6.832 horas. La URL identifica el año 2015, mientras que el texto comercial atribuye 2018 a esta carretilla; no se acredita ninguno como año de fabricación hasta comprobar la documentación de la unidad. Su capacidad residual debe revisarse para el mástil instalado."
  },
  "6865": {
    sourceDigest: "c72d345dc5647ba767633562227aab6b6d2ebff32084293c2fd8a6b1ad4e0192",
    preparedDigest: "b0e7a05f6331f6050747cf49ead6b9be222a6eca4442e14e21d2d3a896c3af8f",
    general: "Carretilla elevadora eléctrica Unicarriers G1Q2L30Q usada, con 3.000 kg de capacidad, elevación de 4.750 mm y mástil tríplex declarados en la ficha. El horómetro indica 4.863 horas. La URL sitúa la unidad en 2015 pero la descripción general habla de fabricación en 2018; el año requiere confirmación. La ficha la clasifica como segunda mano, aunque la descripción corta original incluye por error la palabra nueva."
  },
  "6841": {
    sourceDigest: "5dee07c997a0797573f63e9c33ad3d783647528749fda36a1229c011f1dfab94",
    preparedDigest: "1994d8f3cafcc972bb200131f5cdedbb336eb582bcd11536e32d94b0cca2640a",
    general: "Carretilla elevadora eléctrica Yale ERP18VTMWB de ocasión, anunciada con 1.800 kg de capacidad. La ficha técnica indica 4.900 mm de altura de elevación y 13.597 horas de horómetro. La descripción comercial atribuye 4,6 metros, dato que no coincide con la ficha de esta unidad y no se utiliza. La URL identifica 2018 como año de referencia de la unidad. Para trabajar en estanterías deben verificarse las características del mástil y la capacidad residual."
  },
  "6588": {
    sourceDigest: "4c7b2ce73bcba17b43ceda7d84cc31e08eb095566b08204c5bafba6fe29d09ab",
    preparedDigest: "e46f1bed909bc8d9b202198e000a6cf6d085168dbcd0573a436cffe94dcb5d59",
    general: "Preparapedidos eléctrico Yale MO20P de ocasión con horquillas largas, capacidad de 2.000 kg y elevación de 810 mm según la ficha técnica. El horómetro registra 4.509 horas. El año no se consolida: el campo extraído indica 2000, mientras que la URL y la descripción comercial contienen 2019; esa discrepancia necesita comprobación documental. La elevación indicada corresponde al equipo preparapedidos y no a una altura de trabajo del operario."
  },
  "6590": {
    sourceDigest: "22b170732dcb5788885549f72c7c9e544cd5ddabef9cc7e4e8df3d25560475b2",
    preparedDigest: "e46f1bed909bc8d9b202198e000a6cf6d085168dbcd0573a436cffe94dcb5d59",
    general: "Preparapedidos eléctrico Yale MO20P de segunda mano con horquillas largas, capacidad de 2.000 kg y elevación declarada de 810 mm. El horómetro de esta unidad registra 5.407 horas. La información temporal no está alineada: el año extraído es 2000 y la URL y descripción señalan 2019; ninguno se publica como fecha acreditada de fabricación. Antes de utilizarlo deben verificarse las dimensiones de la carga y los requisitos de circulación."
  },
  "6652": {
    sourceDigest: "de9d797aba1d761ed8a7195ba6328ebb2c708de97c9cfd451f89b001ca272095",
    preparedDigest: "0fe420f7be623c66c2f992a3fc333f3c556e64d15a74467ae2470655ad52566a",
    general: "Apilador doble eléctrico Hyster P2.0SD de segunda mano. La ficha técnica identifica fabricación en 2021, 2.000 kg de capacidad y elevación de 3 metros; el texto comercial lo atribuye a 2013, por lo que se descarta ese año contradictorio. La ficha no aporta una lectura válida del horómetro: indica NA horas y no debe transformarse en horas de uso. Conviene comprobar la configuración de horquillas y la carga residual según el trabajo previsto."
  },
  "6852": {
    sourceDigest: "7ea3e2749f4e92baef7022bfe85d92876e3c42e9d23097359267ea625bf5ab46",
    preparedDigest: "1d8cb17f5208ac114ba735ba7dc78ae420ee1aaad22bca98a001c3b745cde590",
    general: "Apilador eléctrico S1.2 de ocasión, con capacidad de 1.200 kg, elevación de 3.690 mm y 5.400 horas de horómetro según la ficha técnica. Existe un conflicto de marca: el título, la URL y la descripción original identifican Yale, mientras que el campo Marca de especificaciones indica Hyster. Hasta verificar la placa no se asigna una marca definitiva a esta unidad. La cifra de 3,6 metros del texto es aproximada frente a los 3.690 mm declarados en la ficha."
  },
  "5895": {
    sourceDigest: "4b8144b4d380abbfd4df922c246ff0bfc7d2320169075933fb14e81735b579a4",
    preparedDigest: "60b8dd570420bf0da52f796ed4746dc3ebdc1cd04f5df5c08328526e55266c81",
    general: "Transpaleta eléctrica P1.8 de segunda mano. El título, la URL y la ficha técnica identifican Hyster y capacidad de 1.800 kg; la descripción general confunde esta referencia con una Yale de 1.600 kg. La ficha también publica 4.052 horas de uso y 1.675 mm de longitud. Se conservan los datos técnicos de la unidad y se descartan la marca y la carga trasladadas de otro anuncio."
  },
  "6103": {
    sourceDigest: "da894d640b20ef483abb6f3fdb3d3d6dbb705fea92cf9bd41899221a61b87f3f",
    preparedDigest: "d7fac3b6e1c1ce1bb1f09e8fa96fecf06b0dbfd9a44deb4a87b73e112f8f2bda",
    general: "Transpaleta eléctrica P2.5S de conductor montado de segunda mano. La ficha técnica declara 2.500 kg de capacidad, elevación de 210 mm, año de fabricación 2022 y 577 horas. Hay una discordancia de identidad: el título, la URL y el texto comercial la identifican como Hyster, pero el campo Marca de especificaciones indica Isuzu. Es necesario contrastar esa marca antes de publicarla como identidad acreditada; las magnitudes indicadas pertenecen al registro de la unidad."
  },
  "6584": {
    sourceDigest: "9f4aade275cd5828578db5f7ec2518955eff450464188bab42bebbae1a91d5f7",
    preparedDigest: "1ccb112cd1bc969ce245f86075807cecc34331b2b18228c379b1ad3386f4cd19",
    general: "Carretilla trilateral eléctrica Yale MTC13MWB de segunda mano, con año 2016 en ficha técnica. Los datos del anuncio son 1.300 kg de capacidad nominal, elevación de 8.240 mm, mástil tríplex y 3.053 horas de horómetro. Su descripción corta original la denomina diésel pese a que el título y el texto general describen una unidad eléctrica; se elimina esa motorización contradictoria. El uso en pasillos estrechos requiere comprobar las condiciones del mástil y de las cargas."
  },
  "6687": {
    sourceDigest: "9eba971278d3e3dc96286ae3f5db41c87545f4ea9ff79c9c8db139809a528fec",
    preparedDigest: "17a6715405bc022b93724706089ab55b38cb800952be8aa534a4d19e4b856f0c",
    general: "Carretilla elevadora Hyster H3.0FT de ocasión, anunciada como GLP. La ficha técnica identifica fabricación en 2021, 3.000 kg de capacidad, elevación de 5.600 mm y mástil tríplex con desplazador lateral. El horómetro registra 13.132 horas. Estos datos se refieren a la unidad publicada y no a todas las configuraciones del modelo; antes de elevar cargas deben verificarse la capacidad residual, el estado del equipo y las condiciones de maniobra."
  },
  "6706": {
    sourceDigest: "7a7a05047c0221b8f658d58f08b7144968e887d3e2f1e46c2fee056fbd204d77",
    preparedDigest: "e0338579488332c55aea3b34e4b938352f25fb3d7edafcdcf22b14fa78f436ca",
    general: "Carretilla elevadora eléctrica Yale ERP 16 VF LWB de segunda mano, con fabricación en 2019 declarada en la ficha técnica. Su capacidad es de 1.600 kg y la elevación indicada de 4.900 mm, con mástil tríplex y desplazador lateral. El horómetro registra 11.077 horas. Para planificar el almacenaje deben verificarse la capacidad residual del conjunto y la altura del mástil replegado de 2.150 mm, distinta de la elevación máxima."
  },
  "6816": {
    sourceDigest: "36b431a6d18312e99c00ed94873de3c0456c787d929188623612a16b546566dd",
    preparedDigest: "44f7662a98c64d26c8c8720cdfe5c3f8c230ed127b083dc99e3e041ec2dd1ad9",
    general: "Carretilla elevadora eléctrica Cesab B318LII de segunda mano, con 1.800 kg de capacidad nominal. Esta unidad registra 4.500 mm de elevación, mástil tríplex, desplazador lateral y 5.070 horas de horómetro. La URL indica 2023, pero la ficha no consigna ese año como dato de fabricación. El modelo comparte denominación con otras unidades Cesab de elevación y tipo de mástil diferentes; no deben transferirse sus medidas a esta ficha."
  },
  "6820": {
    sourceDigest: "e95e1ad63d9f2dbadf5b7b5728338c6fa5fe8adad9f7002360e530acb5b9f7b2",
    preparedDigest: "1ee12d84dafbf330f8d6a31ebc52fce847f0902aac7a07f8f4f912801908e3b4",
    general: "Carretilla elevadora eléctrica Cesab B318LII de ocasión con 1.800 kg de capacidad. La ficha de esta unidad declara 3.300 mm de elevación, mástil dúplex, desplazador lateral y 2.084 horas de horómetro. La URL identifica 2024, pero el año no figura como dato de fabricación en las especificaciones técnicas. Frente a otras unidades B318LII con mástil tríplex, aquí se conserva expresamente la configuración dúplex declarada."
  },
  "6502": {
    sourceDigest: "0b4d8c5aad71b78b81326383ebf20cddaa22cc60497003051ce9b1e1e26d1432",
    preparedDigest: "f01a663f59df99fdffa71a074d8227f63068134fe7aa7a0f9da525de1692a501",
    general: "Manipulador telescópico Magni TH 5,5.15 de segunda mano. La ficha técnica declara 5.500 kg de capacidad, altura de elevación de 15 metros, fabricación en 2022 y 575 horas de horómetro. Sus dimensiones publicadas son 6.310 mm de longitud, 2.530 mm de anchura y 2.525 mm de altura, con 13.700 kg de peso. La carga admisible a máxima altura o alcance debe contrastarse con el diagrama de cargas del equipo, que no se incluye en el anuncio."
  }
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const sourceDigest = (record: ProductRecord): string => digest(JSON.stringify({
  url: record.url,
  title: record.title,
  brand: record.brand,
  model: record.model,
  externalReference: record.externalReference,
  condition: record.condition,
  categoryKey: record.categoryKey,
  shortDescription: record.shortDescription,
  longDescription: record.longDescription,
  specs: record.specs
}));

export const resolveGamVerifiedConciseGeneral = (record: ProductRecord, preparedGeneral: string | null): string | null => {
  const item = record.reference ? verified[record.reference] : undefined;
  if (record.providerId !== "gam" || !item || !preparedGeneral ||
    sourceDigest(record) !== item.sourceDigest || digest(preparedGeneral) !== item.preparedDigest) return null;
  return item.general;
};
