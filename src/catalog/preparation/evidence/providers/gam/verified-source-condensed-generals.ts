import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

type VerifiedGeneral = Readonly<{ fingerprint: string; general: string }>;

const evidence: Readonly<Record<string, VerifiedGeneral>> = {
  "6126": {
  "fingerprint": "20a4ce224f6f59d474029fae7ec286be64175833a028f75d0755e55b204ecd24",
  "general": "La plataforma articulada eléctrica Genie Z-30/20N, anunciada como unidad de ocasión de 2016, tiene 11 metros de altura de elevación y 227 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Tarragona, con número de serie Z30N16F-17879. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 3.500 mm; anchura: 1.190 mm; altura: 2.000 mm; peso: 6.600 kg. La pendiente superable declarada es del 35%."
},
  "6228": {
  "fingerprint": "825429f2bfff516dacd9a4eefea1df98fb996ca7923f5cdf32b1a870376bdee6",
  "general": "La plataforma articulada eléctrica Genie Z-30/20N, anunciada como unidad de ocasión de 2016, tiene 11 metros de altura de elevación y 227 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Tarragona, con número de serie Z30N16F-17902. La ficha no acredita una lectura de horas. Sus medidas publicadas son longitud: 3.500 mm; anchura: 1.090 mm; altura: 2.000 mm; peso: 6.600 kg. La pendiente superable declarada es del 35%."
},
  "6778": {
  "fingerprint": "c2619438a83034821bc0f1874b711b10ffdddb1e5551b782b13a8fdfdbfbe2a5",
  "general": "La plataforma de tijera eléctrica Snorkel S3219E, anunciada como unidad de ocasión de 2017, tiene 8 metros de altura de elevación y 250 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Tarragona, con número de serie S3219E-01-170200620. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 1.780 mm; anchura: 810 mm; altura: 2.110 mm; peso: 1.611 kg. La pendiente superable declarada es del 25%."
},
  "6779": {
  "fingerprint": "a103cf3db6e0d861e9598a8c9def155c2ef01f5bc3aacfe1fdef64051d7e7f03",
  "general": "La plataforma de tijera eléctrica Snorkel S3219E, anunciada como unidad de ocasión de 2017, tiene 8 metros de altura de elevación y 250 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Tarragona, con número de serie S3219E-01-170300683. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 1.780 mm; anchura: 720 mm; altura: 2.110 mm; peso: 1.611 kg."
},
  "6859": {
  "fingerprint": "46a40f820d3ba124c172337dd87998869a559d62f5fd26232bfceb43b5f15520",
  "general": "La plataforma de tijera eléctrica Snorkel S3219E, anunciada como unidad de ocasión de 2017, tiene 8 metros de altura de elevación y 250 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Tarragona, con número de serie S3219E-01-170300662. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 1.780 mm; anchura: 810 mm; altura: 2.000 mm; peso: 1.611 kg. La pendiente superable declarada es del 25%."
},
  "6845": {
  "fingerprint": "3a430c0a4e95317e5a353a28cad144b157f7a4eb6c71b4b9726284472582bbe3",
  "general": "La plataforma de tijera eléctrica Haulotte COMPACT 8, anunciada como unidad de ocasión de 2012, tiene 8 metros de altura de elevación y 300 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Alicante, con número de serie CE149040. El horómetro registra 909 horas. Sus medidas publicadas son longitud: 2.480 mm; anchura: 810 mm; altura: 2.000 mm; peso: 1.876 kg. La pendiente superable declarada es del 25%."
},
  "6130": {
  "fingerprint": "78418e4fa9ecf4f43ac67d774e9a00121277ac12200d2a6f4a2f367dd7cc6b4f",
  "general": "La plataforma de tijera eléctrica Haulotte COMPACT 8, anunciada como unidad de ocasión de 2011, tiene 8 metros de altura de elevación y 350 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Tarragona, con número de serie CE144316. La ficha no acredita una lectura de horas. Sus medidas publicadas son longitud: 2.480 mm; anchura: 810 mm; altura: 2.000 mm; peso: 1.655 kg. La pendiente superable declarada es del 25%."
},
  "6937": {
  "fingerprint": "532d68fe3a577a8bb09a9a0f10c575da59208c06d1205b5346f4ac5e166f5ff8",
  "general": "La plataforma de tijera eléctrica Haulotte OPTIMUM 8, anunciada como unidad de ocasión de 2007, tiene 8 metros de altura de elevación y 230 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Girona, con número de serie CE132384. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 1.840 mm; anchura: 790 mm; altura: 1.900 mm; peso: 1.420 kg. La pendiente superable declarada es del 25%."
},
  "6967": {
  "fingerprint": "9e03b84e608601afe04b7bea9b7da10960e233d474c8184a9a07f6e9dca4e483",
  "general": "La plataforma de tijera eléctrica Haulotte OPTIMUM 8, anunciada como unidad de ocasión de 2007, tiene 8 metros de altura de elevación y 230 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Toledo, con número de serie CE127106. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 1.840 mm; anchura: 790 mm; altura: 1.900 mm; peso: 1.730 kg. La pendiente superable declarada es del 25%."
},
  "5845": {
  "fingerprint": "fdf6ff5e081b5d921f27c369f7ba20562262b3e2bc9032e56bdc5e99f25c46f8",
  "general": "La plataforma de tijera eléctrica Jlg 10RS, anunciada como unidad de ocasión de 2015, tiene 12 metros de altura de elevación y 320 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Ferrol, con número de serie B200024090. El horómetro registra 677 horas. Sus medidas publicadas son longitud: 2.410 mm; anchura: 1.220 mm; altura: 1.970 mm; peso: 2.775 kg. La pendiente superable declarada es del 25%."
},
  "6912": {
  "fingerprint": "041aec1f55d1005206b6f58655957b5463d3ac2e4c5c1dced705d31d4525d14a",
  "general": "La plataforma articulada diésel Snorkel A46JRT, anunciada como unidad de ocasión de 2018, tiene 16 metros de altura de elevación y 227 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Almería, con número de serie A46JRT-01-180300108. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 5.700 mm; anchura: 2.100 mm; altura: 2.160 mm; peso: 7.550 kg. La pendiente superable declarada es del 40%."
},
  "6492": {
  "fingerprint": "e04ed22a09bc0cd7ebf966499022dc7e7a6b5161e150827159133a43f2e69899",
  "general": "La plataforma unipersonal eléctrica Haulotte STAR 10, anunciada como unidad de ocasión de 2015, tiene 10 metros de altura de elevación y 200 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en León, con número de serie ME114570. El proveedor indica que el horómetro ha sido sustituido, sin lectura total de horas acreditada. Sus medidas publicadas son longitud: 2.700 mm; anchura: 1.000 mm; altura: 1.990 mm; peso: 2.680 kg. La pendiente superable declarada es del 25%."
},
  "6972": {
  "fingerprint": "1cd3fb2be6359f457bd5a7065c7935bfb539456fef3d945a2b2c0b594c413420",
  "general": "La plataforma de tijera diésel Haulotte H12SX, anunciada como unidad de ocasión de 2007, tiene 12 metros de altura de elevación y 700 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Mallorca, con número de serie CD113611. El horómetro registra 4.390 horas. Sus medidas publicadas son longitud: 4.180 mm; anchura: 2.250 mm; altura: 2.570 mm; peso: 5.510 kg. La pendiente superable declarada es del 40%."
},
  "6983": {
  "fingerprint": "0ff92515e6cff778f89041f530543a86a27f837afec8dae0b0404b4e5649825f",
  "general": "La plataforma de tijera diésel Jlg 3394 RT, anunciada como unidad de ocasión de 2007, tiene 12 metros de altura de elevación y 1020 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Mallorca, con número de serie 0200161579. El horómetro registra 2.928 horas. Sus medidas publicadas son longitud: 3.890 mm; anchura: 2.390 mm; altura: 1.970 mm; peso: 6.620 kg. La pendiente superable declarada es del 45%."
},
  "6483": {
  "fingerprint": "51e19eccc442b81db398a13a85cd350ce34ddd7b18b60db703ae57b8c81920ac",
  "general": "La plataforma de tijera diésel Haulotte H15SX, anunciada como unidad de ocasión de 2007, tiene 15 metros de altura de elevación y 500 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Mallorca, con número de serie CD112070. El horómetro registra 4.403 horas. Sus medidas publicadas son longitud: 4.180 mm; anchura: 2.250 mm; altura: 2.770 mm; peso: 6.340 kg. La pendiente superable declarada es del 40 %."
},
  "6642": {
  "fingerprint": "809a03fa550a41ea366c0cecc4c4c3b85f41b9c6f9d798a991f421de8f54a6d7",
  "general": "La plataforma de tijera diésel Magni DS1523RTP, anunciada como unidad de ocasión de 2022, tiene 15 metros de altura de elevación y 680 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Pamplona, con número de serie MN220307-35. La ficha no acredita una lectura de horas. Sus medidas publicadas son anchura: 2.330 mm; altura: 2.270 mm; peso: 7.900 kg."
},
  "6886": {
  "fingerprint": "5b7aec5e809fa53263939993e9e2ce145528adb2b1cee8c10aec3e2c2efba777",
  "general": "La plataforma de tijera diésel Magni DS1523RTP, anunciada como unidad de ocasión de 2023, tiene 15 metros de altura de elevación y 680 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Lleida, con número de serie MN220307-51. El horómetro registra 180 horas. Sus medidas publicadas son longitud: 4.880 mm; anchura: 2.330 mm; altura: 2.260 mm; peso: 7.900 kg. La pendiente superable declarada es del 40%."
},
  "6669": {
  "fingerprint": "8adc2259b9c1e03f397d1ff28f907ef11e19a59b3b8ccf7031bffcfeb8fd20e0",
  "general": "La plataforma de tijera eléctrica Berg Horticultura STAR 300, anunciada como unidad de ocasión de 2023, tiene 5 metros de altura de elevación y 250 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Albacete, con número de serie 733/2023. La ficha no acredita una lectura de horas. Sus medidas publicadas son anchura: 430 mm; altura: 1.185 mm; peso: 398 kg."
},
  "6631": {
  "fingerprint": "beceab4dcd43017f446f1205acf1d1bc87707ace0cbb9f7bc6e027932c515884",
  "general": "La plataforma articulada eléctrica Manitou 150 AETJC, anunciada como unidad de ocasión de 2008, tiene 15 metros de altura de elevación y 200 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Alicante, con número de serie 515512. El horómetro registra 268 horas. Sus medidas publicadas son longitud: 4.400 mm; anchura: 1.500 mm; altura: 2.080 mm; peso: 6.700 kg."
},
  "6984": {
  "fingerprint": "ec2443ee97e1fedc9fc228c84386a7f9c0affd16f2feab93849c7024f40bdad1",
  "general": "La plataforma articulada diésel Genie Z45/25J, anunciada como unidad de ocasión de 2018, tiene 16 metros de altura de elevación y 230 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Toledo, con número de serie Z4525M-7794. El horómetro registra 2.002 horas. Sus medidas publicadas son longitud: 6.830 mm; anchura: 1.790 mm; altura: 2.000 mm; peso: 6.130 kg. La pendiente superable declarada es del 25%."
},
  "6139": {
  "fingerprint": "c3e6ea731c29aefe1f1900f9bfd5cf1cf5b962970791cc8a342205d58ab3a56e",
  "general": "La plataforma articulada diésel Jlg 450AJ, anunciada como unidad de ocasión de 2013, tiene 16 metros de altura de elevación y 230 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Alicante, con número de serie E3000001501. El horómetro registra 3.546 horas. Sus medidas publicadas son longitud: 6.710 mm; anchura: 2.340 mm; altura: 2.290 mm; peso: 6.490 kg. La pendiente superable declarada es del 45%."
},
  "6233": {
  "fingerprint": "e498257061f72eb22565f2ea21b4031687a7b4d81127e770f560f7c9ac1e485c",
  "general": "La plataforma telescópica diésel Jlg 860SJ, anunciada como unidad de ocasión de 2007, tiene 28 metros de altura de elevación y 230 kg de capacidad de carga según la ficha técnica. La máquina figura ubicada en Ferrol, con número de serie 300112533. El horómetro registra 5.863 horas. Sus medidas publicadas son longitud: 12.200 mm; anchura: 2.490 mm; altura: 3.050 mm; peso: 17.038 kg. La pendiente superable declarada es del 45%."
},
  "2076": {
    "fingerprint": "b6e1e0a662f3ccc793485fc210d95ec52d3ade68e2d2e53aefbf376e195480be",
    "general": "La Hyster S7.0FT se presenta como carretilla elevadora diésel para manutención pesada. La ficha técnica consigna capacidad de carga de 7.000 kg a 600 mm de centro de carga y altura de elevación de 5.600 mm. Declara 4.128 mm de longitud, 1.438 mm de anchura y 2.697 mm de altura. La familia técnica recoge alternativas de motor, por lo que no se atribuye a la unidad ninguna motorización específica adicional."
  },
  "2294": {
    "fingerprint": "cddeb1c929d62a3250b09d0d14b9881def7ba231704339a10bd69d1bf2cc479c",
    "general": "La Yale ERP35VL de batalla larga (LWB) es una carretilla elevadora eléctrica para manejo de cargas. La ficha identifica 3.500 kg de capacidad de carga a 500 mm de centro y 5.800 mm de altura de elevación. Consigna una batería de 80 V y 700 Ah, 3.570 mm de longitud, 1.289 mm de anchura y radio de giro de 2.076 mm. Los datos corresponden a la variante LWB indicada en el registro."
  },
  "2367": {
    "fingerprint": "3e58569fe0ca251c8c8e685e89b9530f513212725e0085c8f7bef70ea29c9957",
    "general": "La Hyster S5.5FT es una carretilla elevadora para operaciones industriales con cargas de hasta 5.500 kg, según la ficha técnica. Indica 500 mm de centro de carga y 5.300 mm de altura de elevación. Sus dimensiones registradas son 4.061 mm de longitud, 1.420 mm de anchura y 2.135 mm de altura, con peso de 7.595 kg y radio de giro de 2.375 mm."
  },
  "3130": {
    "fingerprint": "4b01b02e677f30bafcc7e2ff2066e951ffc59211ed90e1ef7d5663d58bf6a748",
    "general": "La Hyster H2.0AS es una carretilla elevadora con motorización GLP para manipulación de mercancías. La ficha técnica declara 2.000 kg de capacidad de carga a 500 mm de centro de carga y 3.800 mm de altura de elevación. Mide 3.349 mm de longitud, 1.251 mm de anchura y 1.966 mm de altura, con peso registrado de 2.993 kg. Estos valores corresponden al modelo identificado en su ficha."
  },
  "5739": {
    "fingerprint": "4554d5811b6af93ff8ab65ae032a531747f263085ce1f1f69b28c9d07e7661c5",
    "general": "La Hyster P1.6 es una transpaleta eléctrica de 1.600 kg, fabricada en 2022 según la ficha original. Esta unidad de Sevilla registra 312 horas y número de serie A418T10056V. Mide 1.670 × 712 × 1.221 mm, pesa 558 kg y equipa horquillas con longitud declarada de 1.156 mm. Está indicada para el movimiento de mercancías en almacenes y operaciones logísticas."
  },
  "5855": {
    "fingerprint": "8c5330c195b66153aea76d83a6886141c0f61727a9c9583d293df9b00f0d4cef",
    "general": "La Manitou 160 ATJ E3 es una plataforma articulada diésel de segunda mano, con 16 m de altura y 230 kg de capacidad de cesta. La unidad de Alicante registra 3.609 horas, serie 936448 y año de fabricación 2022 según su descripción original. Sus dimensiones declaradas son 4.440 × 2.300 × 2.370 mm y pesa 6.160 kg. La ficha indica pendiente superable del 40 %."
  },
  "5900": {
    "fingerprint": "028c0fe714a178e3ad0e3316bc64f3d05cccf6c89bb423a1a0db34a139db632c",
    "general": "La plataforma articulada diésel XCMG XGA36K está destinada a trabajos de elevación con acceso lateral y desplazamiento en terreno irregular. La ficha técnica declara 36 m de altura, 460 kg de capacidad de cesta y tracción 4x4; admite pendientes de hasta el 40 % en las condiciones indicadas por el fabricante. El equipo mide 12.428 mm de longitud y 2.490 mm de anchura, con un peso declarado de 22.200 kg."
  },
  "5902": {
    "fingerprint": "8677c8672ea02d488e404170a46802041921fd09331294fa15047a662a9433a2",
    "general": "La XCMG XGA43K es una plataforma articulada diésel para elevación de gran altura. El registro técnico indica 43 m de altura, 460 kg de capacidad de cesta y una pendiente superable del 40 % según las condiciones de trabajo de la ficha. Declara unas dimensiones generales de 12.928 mm de longitud y 2.490 mm de anchura, un peso de 24.500 kg y cesta de 2,44 × 0,90 m."
  },
  "5937": {
    "fingerprint": "77d8fca1b319a655fa939e5bda5bf3847970e0fdf7e530763d161219fdb78c91",
    "general": "La Hyster P2.0SD es un apilador eléctrico doble de 2.000 kg, fabricado en 2021 según la ficha del proveedor. La unidad de Soria registra 1.295 horas, serie B433T01985V y mástil dúplex con elevación de 1.600 mm. Sus medidas son 2.700 × 775 × 1.510 mm y pesa 1.095 kg. El anuncio consigna ruedas de bandaje, horquillas de 1.190 × 200 × 56 mm y estado de baterías del 60 %."
  },
  "6186": {
    "fingerprint": "baa69c66efadb62f48d9ee5fd428deb55833966c8cd974f9460167f6a7ea8307",
    "general": "La CTE DZ 24 AUTO es una plataforma articulada sobre camión con estabilización automática H+H y cesta de fibra. Su descripción técnica indica 23,60 m de altura máxima de trabajo, 12,70 m de alcance lateral y 230 kg de carga en cesta. Dispone de cuatro estabilizadores hidráulicos, rotación de torre de 700°, nivelación automática y mandos electrohidráulicos proporcionales. La cesta incorpora tomas de 230 V y 12 V."
  },
  "6187": {
    "fingerprint": "e947e7f6b63176b2540ed597015f8c21fba6a27e59d7a81951aaf2c1d678880e",
    "general": "La CTE B-LIFT 18 AUTO es una plataforma telescópica sobre camión con cesta de fibra y estabilización automática H+H. La ficha indica 17,70 m de altura máxima de trabajo, 10,50 m de alcance lateral y 230 kg de capacidad de cesta. Integra rotación de torre de 700°, nivelación automática, mandos electrohidráulicos proporcionales y tomas de 230 V y 12 V en la cesta. Su vehículo portador se describe con PMA de 3.500 kg."
  },
  "6272": {
    "fingerprint": "cc3b6cb3c036e55d8107227df7d5f60586ff1dd09b19e0de0eee603586191f9b",
    "general": "La Hyster H12XD-12 es una carretilla elevadora diésel para cargas pesadas. Su ficha técnica identifica 12.500 kg de capacidad a 1.200 mm de centro de carga y una altura de elevación de 6.648 mm. Las dimensiones declaradas son 7.754 mm de longitud, 2.541 mm de anchura y 4.193 mm de altura, con un peso de servicio de 19.750 kg. Corresponde a la variante H12XD-12, no a otras capacidades de la serie."
  },
  "6311": {
    "fingerprint": "fe697e7ef3b2e8012925b8f61c2fd59a5b9d7595f8f3ce77968921eaca284fee",
    "general": "La Haulotte HA20PX es una plataforma articulada diésel de 20 m, con cesta para 230 kg y pendiente superable del 40 % según su ficha. Esta unidad ubicada en Barcelona registra 4.139 horas y serie AD124635; el anuncio identifica fabricación en 2012. Mide 8.930 × 2.380 × 2.670 mm, pesa 11.710 kg y dispone de cesta de 1,8 × 0,8 m."
  },
  "6572": {
    "fingerprint": "865f339c642702b4776b54918297fa6af01c05b4bd46ec298aaef66dc0b31d43",
    "general": "La Haulotte HA260PX es una plataforma articulada diésel de 26 m de altura con capacidad de cesta de 230 kg, según la ficha técnica. Fabricada en 2006 según su anuncio, esta unidad consta con 7.775 horas de horómetro y número de serie AD112237, ubicada en Barcelona. Sus dimensiones declaradas son 12.000 mm de longitud por 2.380 mm de anchura, con un peso de 15.950 kg. La ficha señala una pendiente superable del 40 %."
  },
  "6630": {
    "fingerprint": "d2695357462ec2e0fc2f539b6ec81673f583575828736dd562449e40fba6f95a",
    "general": "La Haulotte HA20PX es una plataforma articulada diésel de 20 m de altura y 230 kg de capacidad de cesta. Esta unidad de Alicante registra 4.237 horas y número de serie AD4004678; la descripción original indica fabricación en 2011. Declara 8.930 mm de longitud, 2.380 mm de anchura, 2.670 mm de altura, 11.710 kg de peso y pendiente superable del 40 %."
  },
  "6746": {
    "fingerprint": "9223ce4ddafa536c4cf3d72fcd4a9d52dbb4868853c6d679f45a0229c06f3786",
    "general": "El Yale MO10E es un preparapedidos eléctrico para picking de segundo y tercer nivel. La información del modelo declara 1.000 kg de capacidad nominal y centro de carga de 600 mm; según versión, la altura de preparación llega aproximadamente a 4,8 m. Su gama contempla motores de tracción y elevación de 4 kW y 3 kW, respectivamente, y baterías de 24 V con capacidades de 620 Ah o 560 Ah. Estas opciones no se atribuyen a una configuración individual concreta."
  },
  "6776": {
    "fingerprint": "8672f557eadb646432c2f2e5443fb6ac76d2afe733a614b55a6185879d397705",
    "general": "La Genie GR-20 es una plataforma eléctrica unipersonal de 8 m y 159 kg de capacidad. Su anuncio declara fabricación en 2018 y ubicación en Tarragona, con número de serie GRP-52182. El horómetro figura como sustituido, sin lectura de horas acreditada. Mide 1.350 × 800 × 1.980 mm, pesa 1.151 kg y la cesta indicada es de 0,89 × 0,75 m."
  },
  "6921": {
    "fingerprint": "35b29dbec639854732f12deed8b1470ac87af232ffd8544d4f7129b972a0786a",
    "general": "La Snorkel S3219E es una plataforma de tijera eléctrica de ocasión, fabricada en 2016 según su anuncio, con 8 m de altura y capacidad de cesta de 250 kg. Esta unidad está ubicada en Toledo, con serie S3219E-01-200243. La ficha señala expresamente que se ha sustituido el horómetro, por lo que no acredita horas de uso. Sus dimensiones son 1.780 × 810 × 2.110 mm y pesa 1.564 kg."
  },
  "6922": {
    "fingerprint": "c37c63593023d9e8b8b1ea78933a86a9b330c83c6761aaf0030db5fd9082597f",
    "general": "La Hyster P1.6 es una transpaleta eléctrica de 1.600 kg, fabricada en 2021 según la ficha. Esta unidad ubicada en Toledo registra 738 horas y número de serie A418T09139V. Mide 1.650 × 750 × 1.270 mm y pesa 378 kg. Declara horquillas de 1.150 × 170 × 80 mm y estado de baterías del 80 % en el registro del proveedor."
  },
  "6974": {
    "fingerprint": "bac9a46598053a03a50cae9008650a04f6878495a8a976c1e193c6ff7c9f01c1",
    "general": "La Manitou MI50D es una carretilla elevadora diésel de 5.000 kg con mástil dúplex y elevación de 4.000 mm. La unidad de Valencia registra 385 horas, serie MAN00000C01170518 y año 2026 según su descripción. Cuenta con cabina, aire acondicionado y cuarta válvula. Se entrega sin pinzas ni horquillas, condición expresamente indicada en el anuncio. Su peso declarado es 7.140 kg."
  },
  "6982": {
    "fingerprint": "05c730e8473737d305c31d53cb78135aba530e4fb4e81fccbe052ae226a64e34",
    "general": "La Haulotte Compact 12 es una plataforma de tijera eléctrica con altura indicada de 12 m y capacidad de cesta de 320 kg. Esta unidad registra 1.430 horas, serie CE143981 y ubicación en Valencia. Sus dimensiones declaradas son 2.480 mm de longitud por 1.200 mm de anchura y peso de 2.940 kg. La ficha técnica indica una pendiente superable del 25 %."
  },
  "6641": {
    "fingerprint": "ba65ab9c6228f9be8cce12cf144547954891a937680f4df1d1187e8e492ace9e",
    "general": "El recogepedidos Crown GPC 3020 2.0 de ocasión, fabricado en 2019 según la ficha, admite 2.000 kg de carga. La unidad de Pontevedra está identificada con la serie 5A415362 y registra 5.606 horas. Sus medidas publicadas son 3.700 mm de largo y 810 mm de ancho, con un peso declarado de 2.073 kg. Los valores corresponden a esta unidad concreta, no a toda la gama."
  },
  "6640": {
    "fingerprint": "a2f497fb33e9e76d920377fe7201887716b9091fa530879be4c184f2e766c113",
    "general": "El recogepedidos Crown GPC 3020 2.0 de ocasión, fabricado en 2019 según la ficha, admite 2.000 kg de carga. La unidad de Pontevedra está identificada con la serie 5A415365 y registra 5.755 horas. Sus medidas publicadas son 3.700 mm de largo y 810 mm de ancho, con un peso declarado de 2.073 kg. Los valores corresponden a esta unidad concreta, no a toda la gama."
  },
  "6639": {
    "fingerprint": "20287fcb7e92283412e7129fc90b1bb5c1d2b7eb477cc8b5bf4a2ea15065fc56",
    "general": "El recogepedidos Crown GPC 3020 2.0 de ocasión, fabricado en 2019 según la ficha, admite 2.000 kg de carga. La unidad de Pontevedra está identificada con la serie 5A415363 y registra 5.970 horas. Sus medidas publicadas son 3.700 mm de largo y 810 mm de ancho, con un peso declarado de 2.073 kg. Los valores corresponden a esta unidad concreta, no a toda la gama."
  },
  "6638": {
    "fingerprint": "d8bbc2a55000b74e3ddd9722372840bb00c176ac586b28e321e82ab1ba892dd4",
    "general": "El recogepedidos Crown GPC 3020 2.0 de ocasión, fabricado en 2019 según la ficha, admite 2.000 kg de carga. La unidad de Pontevedra está identificada con la serie 5A415360 y registra 6.899 horas. Sus medidas publicadas son 3.700 mm de largo y 810 mm de ancho, con un peso declarado de 2.079 kg. Los valores corresponden a esta unidad concreta, no a toda la gama."
  },
  "6880": {
    "fingerprint": "3fbe8077a76bd3400a337fd2d21aff4ef0586f054bd287560922ad72b3f43b3d",
    "general": "La carretilla elevadora diésel Manitou MI 35 DX ST5, de ocasión de 2022, tiene una capacidad de 3.500 kg y eleva a 4.500 mm mediante mástil triplex; el anuncio confirma desplazador lateral. La unidad de Barcelona registra 2.528 horas, serie MAN0000K00887374 y matrícula E-3753-BHT. El vendedor declara cuarta válvula, luces BlueSpot y equipo matriculado, con ITV por cuenta del comprador."
  },
  "6860": {
    "fingerprint": "003cfd95e2d3376e2765e9a04dcb5d137794d8d611878edacd8a04b2c9d8a1c4",
    "general": "La carretilla elevadora eléctrica Still RX 60-35 de ocasión, del año 2015, tiene capacidad de 3.500 kg, mástil duplex y altura de elevación de 4.500 mm. Su ficha indica horquillas de 1500x100 × 50 mm, 32.135 horas y serie 516367F00031, ubicada en Ferrol. Dimensiones: 4.080 mm de largo, 1.260 mm de ancho y 2.350 mm de alto; peso declarado de 4.430 kg."
  },
  "6024": {
    "fingerprint": "16246d6850f1466dc4451dff21e6e9944b5e7cc8915f1e3d283bc2cd077274aa",
    "general": "La carretilla frontal diésel Jungheinrich DFG320S de segunda mano, anunciada del año 2017, tiene capacidad de 2.000 kg y elevación a 4.000 mm. Está equipada con horquillas de 1.200 mm y su mástil replegado mide 2.400 mm. La unidad situada en Alicante registra 12.360 horas, serie FN534195, y declara 3.400 mm de longitud por 1.120 mm de anchura."
  },
  "6950": {
    "fingerprint": "0d15225cbd9564a88077766db4a5e38d4cbbba755d69e3ccbcafe21b44a3c258",
    "general": "La carretilla retráctil eléctrica Hyster R1.6, anunciada como unidad de ocasión de 2021, tiene capacidad de 1.600 kg y alcanza 7.400 mm de elevación. La ficha indica desplazador lateral y 3.000 mm de altura con mástil replegado. Está ubicada en Vigo y se identifica mediante la serie D435T07766V. Sus dimensiones declaradas son 2.380 mm de largo, 1.265 mm de ancho y 3.000 mm de alto; peso de 3.950 kg. La ficha no publica una lectura de horas."
  },
  "6893": {
    "fingerprint": "cc14926ac20ba4e73d2c0d363043ab032a9626af6a6d190332377a90411f7f38",
    "general": "El manipulador telescópico Haulotte HTL 4014 de segunda mano, del año 2018, declara 14 metros de elevación, 4.000 kg de carga y una pendiente superable del 45%. La unidad de Tarragona registra 6.180 horas, serie 2034956 y matrícula E-8629-BGW. Sus dimensiones son 6.470 mm de largo por 2.430 mm de ancho, con 16.000 kg de peso. El anuncio advierte que falta la documentación original y que la ITV corre por cuenta del comprador."
  },
  "6650": {
    "fingerprint": "e13faf1cba97f5d6918c1edb5c48d1f70c4dacd58f5287f3bc6f54ad4f667120",
    "general": "La plataforma articulada eléctrica JLG E300AJP de ocasión, fabricada en 2006 según el anuncio, alcanza 11 metros y soporta 230 kg en la cesta. La unidad ubicada en Barcelona registra 2.047 horas y serie 30097810. La ficha publica longitud de 5.740 mm, anchura de 1.220 mm, altura de 2.010 mm y peso de 6.859 kg; pendiente superable del 25%."
  },
  "6634": {
    "fingerprint": "0028d64f7bf915208af5dc50e9ba00199e8e3be38def2bfafaca07de2c3264e8",
    "general": "La transpaleta manual monouña Logitrans Logiq 200, fabricada en 2021 según el anuncio, admite 200 kg de carga y dispone de horquilla de 600 × 205 mm. La ficha identifica esta unidad de Ferrol con la serie 212H04217979; declara 860 mm de longitud, 1.040 mm de altura y 20 kg de peso. El horómetro figura sin lectura válida en el origen, por lo que no se atribuyen horas de uso."
  },
  "6632": {
    "fingerprint": "87ce4030eac10d465145c0a17224a8acfa6d921be5bff6e5a25b1e249b72ac85",
    "general": "La plataforma articulada diésel Haulotte HA20PX de ocasión, del año 2012, alcanza 20 metros y admite 230 kg en la cesta. Esta unidad de Alicante registra 2.841 horas, serie AD400575. Sus medidas son 8.930 mm de largo, 2.380 mm de ancho, 2.670 mm de alto y 11.710 kg de peso. El vendedor advierte una leve pérdida por el cilindro del «main»."
  },
  "6663": {
    "fingerprint": "b3ffe228ed83a322019762f09bda58d8c3057ab998319588a41a10b2c79cb261",
    "general": "El apilador eléctrico a pie Still EXV 14 I de ocasión, del año 2018, dispone de 1.400 kg de capacidad, mástil duplex y elevación a 2.950 mm. Su ficha indica 1.900 mm de mástil replegado, 830 mm de anchura y 1.320 kg de peso. Ubicado en Valencia, serie F20323J00104; el horómetro figura sustituido, sin horas totales acreditadas."
  },
  "6997": {
    "fingerprint": "72a6f5c964c291edc764567015232ad3b539f838b6af053269c8c7d261623e16",
    "general": "La plataforma de tijera diésel Skyjack SJ-6826 RT de ocasión, anunciada del año 2007, alcanza 10 metros y soporta 545 kg. La unidad de Santander registra 2.879 horas, serie 37000297, y pesa 3.500 kg. El proveedor advierte tres incidencias: no funciona en desniveles superiores al 4 %, el anuncio comunica un fallo del autonivelador sin precisar su alcance y no dispone de placa identificativa."
  },
  "6625": {
    "fingerprint": "0e9caebd6b78acc889e68af8f8c143159fbbce20073a364d3a5a3d0c90f77d08",
    "general": "La plataforma de tijera diésel Genie GS-5390 de ocasión, anunciada de 2014, tiene 18 metros de elevación y 1.400 kg de capacidad de carga. La unidad ubicada en Alicante registra 1.522 horas, serie GS9014-49496. Declara 4.880 mm de largo, 2.290 mm de ancho, 2.470 mm de alto, peso de 7.920 kg y pendiente superable del 40%."
  },
  "6644": {
    "fingerprint": "dc031fc2ff32e06cf40f8d5e3f5b7bbe682c698c3abab729108c64de0471bf92",
    "general": "La carretilla elevadora GLP Hyster H1.6FT de ocasión, fabricada en 2022, tiene capacidad de 1.600 kg, mástil triplex y elevación a 4.900 mm. Cuenta con elevación libre, controles de minipalancas y ruedas superelásticas, según la ficha. La unidad de Mérida registra 256 horas, serie G001B04001W, y lleva horquillas de 1200x80 × 40 mm."
  },
  "6436": {
    "fingerprint": "d8bc83e5d4a820a122567483b5aa294c9079311cdf9e3690eb3e97c9208fcde8",
    "general": "La transpaleta eléctrica Hyster P2.0 de ocasión, anunciada del año 2022, admite 2.000 kg y alcanza 220 mm de elevación. Esta unidad de Santander, con serie A418T10740W, declara horquillas de 1.180 mm, longitud de 2.000 mm, anchura de 730 mm y peso de 590 kg. El proveedor no publica una lectura válida de horómetro."
  },
  "6915": {
    "fingerprint": "13aed1e3f0cce230110ec1029021477adefc65b7a5f1d2a77c11607faa00a11e",
    "general": "La carretilla elevadora diésel Mora M160C de ocasión, anunciada del año 2009, admite 16.000 kg y alcanza 4.000 mm de elevación. Ubicada en Castellón, serie 20143, registra 95.677 horas en el anuncio. Su ficha indica horquillas de 1.200 mm, longitud de 5.470 mm, anchura de 2.050 mm y peso de 23.140 kg."
  },
  "6626": {
    "fingerprint": "27285e2bb8f79a79dacaa0d756451ee753019b3f54843a1e519ec17340095f54",
    "general": "La plataforma telescópica diésel JLG 860SJ de ocasión, anunciada del año 2008, dispone de 28 metros de elevación y 230 kg de capacidad de cesta. Esta unidad, ubicada en Alicante y con serie 300124592, mide 12.200 mm de largo por 2.490 mm de ancho y pesa 17.200 kg. La ficha declara pendiente superable del 45%; no publica horas acreditadas."
  },
  "6372": {
    "fingerprint": "7cff60f658a0725d558dd596c57eb1a9e025d465e9b42cec4bb361c8b8b155af",
    "general": "La carretilla elevadora diésel Kalmar DCD200-12LB de segunda mano, anunciada del año 2008, tiene una capacidad de 20.000 kg y altura de elevación de 5.000 mm. La ficha indica desplazador lateral y mástil replegado de 4.430 mm. La unidad de León registra 12.057 horas, serie T34108.0974, y declara 8.460 mm de longitud, 3.050 mm de anchura y 31.350 kg de peso."
  },
  "6675": {
    "fingerprint": "58d297567a75c3f626a0f972bf7fbf9df24392633e3d85799a74d8bd227b4ddf",
    "general": "La transpaleta eléctrica de conductor montado Hyster P2.0S FBW de ocasión, fabricada en 2020 según el anuncio, admite 2.000 kg y dispone de horquillas de ancho frutero, indicadas expresamente por el vendedor. La unidad de Montijo (Portugal), serie D439T09256U, registra 1.155 horas. Sus medidas publicadas son 2.400 mm de largo y 780 mm de ancho, con un peso de 988 kg."
  },
  "6823": {
    "fingerprint": "71dafeee9ce443179b6793d8bf54b26088b6f29f34b3b3bb54ed726520b60172",
    "general": "La carretilla elevadora eléctrica triciclo Cesab B318LII de ocasión, anunciada del año 2024, admite 1.800 kg y alcanza 3.300 mm mediante mástil duplex. La ficha indica desplazador lateral, elevación libre y cargador trifásico «48/120». Esta unidad de Madrid registra 1.694 horas, serie CE437410; declara horquillas de 1.000 mm, y 3.300 kg de peso."
  },
  "6679": {
    "fingerprint": "efd150db769b0a9e502a0ac05091a9e748a7ffe24d3231e3d983556b14dceab1",
    "general": "El equipo de ocasión Hyster H3.5FT es una carretilla elevadora GLP del año 2019, con capacidad de carga declarada de 3.500 kg. La altura de elevación consignada es de 3.600 mm. Esta unidad de Murcia, con serie P177B08990T, registra 27.437 horas en el horómetro. La ficha publica altura de mástil replegado 2.750 mm, anchura 1.150 mm, altura 2.200 mm, peso 5.160 kg. Equipamiento o condiciones declaradas: desplazador lateral."
  },
  "6704": {
    "fingerprint": "55b2ac9edb33ef19de95509a0d4912f00bf9b3710025a0288858eee1afd5a0b2",
    "general": "El equipo de ocasión Hyster H2.0FT es una carretilla elevadora GLP del año 2020, con capacidad de carga declarada de 2.000 kg. La altura de elevación consignada es de 4.910 mm. Esta unidad de Sevilla, con serie P177B11134U, registra 1.055 horas en el horómetro. La ficha publica horquillas 1100x100x40 mm, anchura 1.150 mm, altura 2.200 mm, peso 4.010 kg. Equipamiento o condiciones declaradas: desplazador lateral."
  },
  "6755": {
    "fingerprint": "5e76c2f64fc457d3f24b7fd7926cfabbf9d0ad2887a65bfc28c7cb640473c86d",
    "general": "El equipo de ocasión Toyota 02 – 8FGF25 es una carretilla elevadora GLP del año 2019, con capacidad de carga declarada de 2.500 kg. La altura de elevación consignada es de 4.700 mm. Esta unidad de Valladolid, con serie 8FGF25-66769, registra 20.143 horas en el horómetro. La ficha publica mástil triplex, altura de mástil replegado 2.120 mm, horquillas 1.200 mm, longitud 3.000 mm, anchura 1.150 mm, altura 2.120 mm, peso 3.940 kg. Equipamiento o condiciones declaradas: desplazador lateral, elevación libre."
  },
  "5227": {
    "fingerprint": "18b666c8dc0aa0b759f3f6d797e0b72e831a982935e613489ae80d17d05d35bf",
    "general": "El equipo de ocasión Hyster H2.5FT es una carretilla elevadora GLP del año 2020, con capacidad de carga declarada de 2.500 kg. La altura de elevación consignada es de 3.290 mm. Esta unidad de Vigo, con serie P177B10319U, registra 14.363 horas en el horómetro. La ficha publica altura de mástil replegado 2.150 mm, longitud 3.670 mm, anchura 1.160 mm, altura 2.150 mm, peso 4.040 kg."
  },
  "6662": {
    "fingerprint": "223426cb5bf4e19230722d7fa51929cfc55b3b2f171d686e3920b9441511eda4",
    "general": "El equipo de ocasión Hyster H2.5FT es una carretilla elevadora GLP del año 2021, con capacidad de carga declarada de 2.500 kg. La altura de elevación consignada es de 5.030 mm. Esta unidad de Barcelona, con serie P177B11975V, registra 11.590 horas en el horómetro. La ficha publica altura de mástil replegado 3.170 mm, longitud 2.840 mm, anchura 1.050 mm, peso 4.150 kg."
  },
  "6657": {
    "fingerprint": "f3d8a80567b62154da501f6c6974007807797261a38882b150635e32ef8fc432",
    "general": "El equipo de ocasión Hyster H2.5FT es una carretilla elevadora GLP del año 2019, con capacidad de carga declarada de 2.500 kg. La altura de elevación consignada es de 4.950 mm. Esta unidad de Valladolid, con serie P177B08974T, registra 14.213 horas en el horómetro. La ficha publica altura de mástil replegado 2.050 mm, horquillas 1100x100x40 mm, anchura 1.150 mm, altura 2.200 mm, peso 4.355 kg. Equipamiento o condiciones declaradas: desplazador lateral."
  },
  "5280": {
    "fingerprint": "6a37fd67fb5af5aa08a4035f0c7c5d9c89a9a357dec8dd60ed5a7ab6dc620c5a",
    "general": "El equipo de ocasión Hyster H2.5FT es una carretilla elevadora GLP del año 2019, con capacidad de carga declarada de 2.500 kg. La altura de elevación consignada es de 4.350 mm. Esta unidad de Barcelona, con serie P177B08753T, registra 11.503 horas en el horómetro. La ficha publica mástil triplex, altura de mástil replegado 2.000 mm, horquillas 1.100 mm, longitud 3.700 mm, anchura 1.180 mm, altura 2.200 mm, peso 4.580 kg. Equipamiento o condiciones declaradas: desplazador lateral, cuarta válvula mencionada por el vendedor."
  },
  "6885": {
    "fingerprint": "9c1ea192621bd8d2f7b1d4046adadc27f9f611121ca4650ae195b734f4792b11",
    "general": "El equipo de ocasión Hyster H2.5FT es una carretilla elevadora GLP del año 2016, con capacidad de carga declarada de 2.500 kg. La altura de elevación consignada es de 4.950 mm. Esta unidad de Tarragona, con serie P177B03028P, registra 6.766 horas en el horómetro. La ficha publica mástil triplex, altura de mástil replegado 2.150 mm, horquillas 1.100 mm, longitud 3.600 mm, anchura 1.140 mm, altura 2.150 mm, peso 4.810 kg. Equipamiento o condiciones declaradas: elevación libre."
  },
  "5213": {
    "fingerprint": "e4e0d5c4854d222eedb84c9f856e326426386e5aa048c36d812249f854209aec",
    "general": "El equipo de ocasión Hyster H3.5FT es una carretilla elevadora GLP del año 2019, con capacidad de carga declarada de 3.500 kg. La altura de elevación consignada es de 4.615 mm. Esta unidad de Valladolid, con serie P177B08945T, no presenta una lectura válida de horas de uso. La ficha publica mástil triplex, altura de mástil replegado 2.150 mm, horquillas 1.100 mm, longitud 3.700 mm, anchura 1.220 mm, altura 2.150 mm, peso 5.030 kg. Equipamiento o condiciones declaradas: desplazador lateral, elevación libre."
  },
  "6686": {
    "fingerprint": "b3e9cc43230339f5c66b5f0c4880e02a5c407bbf84d83def8d10949a03d4a424",
    "general": "El equipo de ocasión Hyster H5.0FT es una carretilla elevadora GLP del año 2012, con capacidad de carga declarada de 5.000 kg. La altura de elevación consignada es de 3.400 mm. Esta unidad de Murcia, con serie R005B01736K, registra 17.653 horas en el horómetro. La ficha publica altura de mástil replegado 2.500 mm, horquillas 900X150X60 mm, longitud 4.500 mm, anchura 1.400 mm, altura 2.500 mm, peso 7.690 kg. Equipamiento o condiciones declaradas: desplazador lateral."
  },
  "6684": {
    "fingerprint": "07df90aaa3b21485a00fc2e7f717e0c3888cf3fa9831c3785c64df54e505b691",
    "general": "El equipo de ocasión Hyster H5.0FT es una carretilla elevadora GLP del año 2011, con capacidad de carga declarada de 5.000 kg. La altura de elevación consignada es de 3.400 mm. Esta unidad de Murcia, con serie P005B03558J, registra 22.951 horas en el horómetro. La ficha publica horquillas 1100X150X60 mm, longitud 4.500 mm, anchura 1.400 mm, altura 2.500 mm, peso 7.745 kg. Equipamiento o condiciones declaradas: desplazador lateral."
  },
  "5714": {
    "fingerprint": "8d659261bb5421065a4f5a1b578974c7ab6746f64e2c15348d5d8afb1bd4e950",
    "general": "El equipo de ocasión Hyster H5.5FT es una carretilla elevadora GLP del año 2021, con capacidad de carga declarada de 5.500 kg. La altura de elevación consignada es de 6.350 mm. Esta unidad de Madrid, con serie U005B06635V, no presenta una lectura válida de horas de uso. La ficha publica altura de mástil replegado 2.870 mm, horquillas 1200X150X60 mm, longitud 3.336 mm, anchura 1.280 mm, altura 2.870 mm, peso 8.294 kg. Equipamiento o condiciones declaradas: desplazador lateral, ruedas superelásticas."
  },
  "6819": {
    "fingerprint": "e2ba600ae72dcc3f23c194678d311da4e2c306c3a25555320d087b80d5c17ac9",
    "general": "El equipo de ocasión Cesab B318LII es una carretilla elevadora eléctrica del año 2023, con capacidad de carga declarada de 1.800 kg. La altura de elevación consignada es de 3.300 mm. Esta unidad de Madrid, con serie CE436945, registra 1.962 horas en el horómetro. La ficha publica mástil duplex, altura de mástil replegado 2.150 mm, horquillas 1.000 mm, longitud 3.000 mm, anchura 1.050 mm, altura 2.150 mm, peso 3.300 kg. Equipamiento o condiciones declaradas: desplazador lateral, elevación libre consignada como 1600, sin unidad indicada, mandos hidráulicos mini palancas, ruedas macizas, cargador trifásico 48/120 declarado por el proveedor."
  },
  "6821": {
    "fingerprint": "ac7938db1012942d53097a31c0bea45408ecf2f418aff410c52d34242f4acf65",
    "general": "El equipo de ocasión Cesab B318LII es una carretilla elevadora eléctrica del año 2024, con capacidad de carga declarada de 1.800 kg. La altura de elevación consignada es de 3.300 mm. Esta unidad de Madrid, con serie CE436894, registra 2.062 horas en el horómetro. La ficha publica mástil duplex, altura de mástil replegado 2.150 mm, horquillas 1.000 mm, longitud 3.000 mm, anchura 1.050 mm, altura 2.150 mm, peso 3.320 kg. Equipamiento o condiciones declaradas: desplazador lateral, elevación libre consignada como 1600, sin unidad indicada, mandos hidráulicos mini palancas, ruedas macizas, cargador trifásico 48/120 declarado por el proveedor."
  },
  "6822": {
    "fingerprint": "f14e2321cb9d60c1efbfa8d61e56599748f45e88d1388c46702fe04d28645fc1",
    "general": "El equipo de ocasión Cesab B318LII es una carretilla elevadora eléctrica del año 2024, con capacidad de carga declarada de 1.800 kg. La altura de elevación consignada es de 3.300 mm. Esta unidad de Madrid, con serie CE436948, registra 2.313 horas en el horómetro. La ficha publica mástil duplex, altura de mástil replegado 2.150 mm, horquillas 1.000 mm, longitud 3.000 mm, anchura 1.050 mm, altura 2.150 mm, peso 3.370 kg. Equipamiento o condiciones declaradas: desplazador lateral, elevación libre consignada como 1600, sin unidad indicada, mandos hidráulicos mini palancas, ruedas macizas, cargador trifásico 48/120 declarado por el proveedor."
  },
  "6849": {
    "fingerprint": "6573eb9aa135a26fa5aee12f0a7274d27928adb884b25eb90fe009d380ed83ae",
    "general": "El equipo de ocasión Yale ERP16VT MWB es una carretilla elevadora eléctrica del año 2017, con capacidad de carga declarada de 1.600 kg. La altura de elevación consignada es de 5.500 mm. Esta unidad de Valencia, con serie G807B10136R, registra 8.717 horas en el horómetro. La ficha publica altura de mástil replegado 2.400 mm, horquillas 1.100 mm, longitud 3.000 mm, anchura 1.300 mm, altura 2.400 mm, peso 4.276 kg."
  },
  "6878": {
    "fingerprint": "c350a18c4da5e00efc351df376d285d38e10e7fe831ff1738ecb6982b6bf0bc3",
    "general": "El equipo de ocasión Linde E16C es una carretilla elevadora eléctrica del año 2019, con capacidad de carga declarada de 1.600 kg. La altura de elevación consignada es de 4.600 mm. Esta unidad de Girona, con serie C11275V00211, registra 7.489 horas en el horómetro. La ficha publica altura de mástil replegado 2.040 mm, horquillas 1.100 mm, longitud 2.900 mm, anchura 970 mm, altura 2.040 mm, peso 3.465 kg."
  },
  "5910": {
    "fingerprint": "18400bb1fb11b4e9c6120bdd8e0e4c80bafe1eaf1ff70bfcba7c775996bde8bb",
    "general": "El equipo de ocasión Hyster J1.8XNT MWB es una carretilla elevadora eléctrica del año 2019, con capacidad de carga declarada de 1.800 kg. La altura de elevación consignada es de 4.900 mm. Esta unidad de León, con serie K160B13841T, registra 6.067 horas en el horómetro. La ficha publica mástil triplex, altura de mástil replegado 2.040 mm, horquillas 1100X40 mm, longitud 3.000 mm, anchura 1.113 mm, altura 2.080 mm, peso 3.553 kg. Equipamiento o condiciones declaradas: mandos hidráulicos minilevers, estado de baterías indicado: 60%."
  },
  "6582": {
    "fingerprint": "3ecb880c19d9849e328ae01130e0c740c8450381cee36116d9021a56f7098fcd",
    "general": "El preparapedidos eléctrico Yale MO10E AC, anunciado de ocasión del año 2014, admite 1.000 kg de carga. Esta unidad de Zaragoza, con serie C862T02266M, registra 19.823 horas en el horómetro. La ficha publica longitud 2.930 mm, anchura 775 mm, altura 1.675 mm, peso 1.781 kg."
  },
  "6601": {
    "fingerprint": "54f3a9a0e15dc2cbff52a07b38d1a14ef4ccfd8a33f49d9b1649421db7174073",
    "general": "El preparapedidos eléctrico Yale MO10E AC, anunciado de ocasión del año 2017, admite 1.000 kg de carga. Esta unidad de Tarragona, con serie C862T02658R, registra 7.031 horas en el horómetro. La ficha publica longitud 3.100 mm, anchura 950 mm, altura 3.070 mm, peso 1.781 kg."
  },
  "6754": {
    "fingerprint": "ac6b0bffec1dddb13e672a83b4078c09c7fbe74da04383e5e201cd139a9fb2a7",
    "general": "El recogepedidos eléctrico Hyster LO2.5, anunciado de ocasión del año 2021, admite 2.500 kg de carga. Esta unidad de Valladolid, con serie E444T05415V, registra 2.576 horas en el horómetro. La ficha publica horquillas 2.350 mm, longitud 4.000 mm, anchura 800 mm, altura 1.500 mm, peso 900 kg. Equipamiento o condiciones declaradas: estado de baterías indicado: 80%."
  },
  "6941": {
    "fingerprint": "bf6f29e9266833221c71842a0327d939571c438c96f1f69691038130f955fdca",
    "general": "El equipo de ocasión Hyster J1.5XNT SWB es una carretilla elevadora eléctrica del año 2019, con capacidad de carga declarada de 1.500 kg. La altura de elevación consignada es de 3.215 mm. Esta unidad de Santander, con serie K160B13279T, registra 4.055 horas en el horómetro. La ficha publica altura de mástil replegado 2.070 mm, horquillas 1.200 mm, longitud 3.000 mm, anchura 1.050 mm, altura 2.100 mm, peso 3.115 kg."
  },
  "6861": {
    "fingerprint": "bbee1ef44968d86432441716a4bcd9268c88e3510f6737d7ac457346ffbe999e",
    "general": "La carretilla retráctil eléctrica YALE MR14H, del año 2010 y anunciada como equipo de ocasión, corresponde a la unidad con serie C849T05976H, ubicada en Madrid (España). Su ficha técnica identifica una configuración destinada a operaciones de almacenaje y elevación de mercancías. Datos operativos del equipo: capacidad nominal declarada de 1400 kg; altura de elevación publicada de 8700 mm. Lectura del horómetro consignada por el vendedor: 11833 horas. Dimensiones y peso publicados: longitud 2055 mm, anchura 1300 mm, altura 3735 mm, peso 3900 KG. Otros datos de la ficha: mástil: TRIPLEX; altura de mástil replegado: 3735 mm; horquillas: 1200 mm; desplazador lateral: SI; mandos hidráulicos: Mini palancas; estado de batería informado: 90%; elevación libre: SI."
  },
  "6761": {
    "fingerprint": "1f0fa486e3a067deef68137f1ccac653e62ef2886bc0e07481c9edc34338fa16",
    "general": "El preparapedidos eléctrico TOYOTA OME100M, del año 2007 y anunciado como equipo de ocasión, corresponde a la unidad con serie 977208, ubicada en Valladolid (España). Su ficha técnica identifica una configuración destinada a operaciones de almacenaje y elevación de mercancías. Datos operativos del equipo: capacidad nominal declarada de 1000 kg; altura de elevación publicada de 4750 mm. El vendedor indica un horómetro sustituido; no acredita las horas totales de uso de esta unidad. Dimensiones y peso publicados: longitud 3200 mm, anchura 1250 mm, altura 2800 mm, peso 1800 KG. Otros datos de la ficha: altura de mástil replegado: 2800 mm; horquillas: 1150 mm; estado de batería informado: 60%."
  },
  "5848": {
    "fingerprint": "b172048d9d45e327ad1f92d96bb54eb4d3e666d23c183d432c4ed4cf407a2da2",
    "general": "La transpaleta eléctrica con conductor montado TOYOTA LPE240/S, del año 2011 y anunciada como equipo de ocasión, corresponde a la unidad con serie 6173682, ubicada en Valladolid (España). Se ofrece para la manipulación y el traslado interno de palets, con los datos individuales indicados a continuación. Datos operativos del equipo: capacidad nominal declarada de 2000 kg. Lectura del horómetro consignada por el vendedor: 2348 horas. Dimensiones y peso publicados: longitud 2120 mm, anchura 850 mm, altura 1660 mm, peso 1238 KG. Otros datos de la ficha: horquillas: 1150 mm."
  },
  "5792": {
    "fingerprint": "0d089080cf8d2d1e50594672a73f551d49dd754643ba6f3e3018edda2399ea27",
    "general": "La transpaleta eléctrica con conductor montado TOYOTA LPE200, del año 2006 y anunciada como equipo de ocasión, corresponde a la unidad con serie 963448, ubicada en Valladolid (España). Se ofrece para la manipulación y el traslado interno de palets, con los datos individuales indicados a continuación. Datos operativos del equipo: capacidad nominal declarada de 2000 kg. Lectura del horómetro consignada por el vendedor: 6548 horas. Dimensiones y peso publicados: longitud 1800 mm, anchura 760 mm, altura 1460 mm, peso 700 KG. Otros datos de la ficha: horquillas: 1150 mm."
  },
  "6738": {
    "fingerprint": "d2135bb034e8bc63d7851d9bff03b7ed92678e7d1945bf7ce8af4dc5d4ea2c17",
    "general": "La carretilla elevadora eléctrica UNICARRIERS A1N1L18Q, del año 2016 y anunciada como equipo de ocasión, corresponde a la unidad con serie A1N1E723022, ubicada en Montijo (Portugal). El anuncio acredita su configuración para manipulación y elevación de cargas. Datos operativos del equipo: capacidad nominal declarada de 1800 kg; altura de elevación publicada de 4750 mm. El vendedor indica un horómetro sustituido; no acredita las horas totales de uso de esta unidad. Dimensiones y peso publicados: longitud 3070 mm, anchura 1105 mm, altura 2110 mm, peso 3600 KG. Otros datos de la ficha: mástil: TRIPLEX; altura de mástil replegado: 2110 mm; horquillas: 1100 mm."
  },
  "6664": {
    "fingerprint": "405c1b6e1ef2a82695c5828dab1fb4a5c3d9f1243bebb3dbc0dd02e10190513d",
    "general": "La transpaleta eléctrica con conductor montado HYSTER P2.0S FBW, del año 2020 y anunciada como equipo de ocasión, corresponde a la unidad con serie D439T09255U, ubicada en Burgos (España). Se ofrece para la manipulación y el traslado interno de palets, con los datos individuales indicados a continuación. Datos operativos del equipo: capacidad nominal declarada de 2000 kg. Lectura del horómetro consignada por el vendedor: 607 horas. Dimensiones y peso publicados: longitud 2400 mm, altura 1450 mm, peso 980 KG. Otros datos de la ficha: horquillas: 1600 mm."
  },
  "6691": {
    "fingerprint": "274fb150aa4556ba2029c4f764ece77b1b2d0f2acb95119829c31d1ef2e660fc",
    "general": "La transpaleta eléctrica de conductor a pie HYSTER PC1.4, del año 2018 y anunciada como equipo de ocasión, corresponde a la unidad con serie H1395470, ubicada en Ferrol (España). Se ofrece para la manipulación y el traslado interno de palets, con los datos individuales indicados a continuación. Datos operativos del equipo: capacidad nominal declarada de 1400 kg. El vendedor indica un horómetro sustituido; no acredita las horas totales de uso de esta unidad. Dimensiones y peso publicados: longitud 1500 mm, anchura 685 mm, peso 393 KG."
  },
  "6788": {
    "fingerprint": "43248161036c7af6dcb387c73716704e642a3364f7ecaec82c669e0ff1bbb829",
    "general": "El apilador eléctrico con conductor montado YALE MS15XUX, del año 2021 y anunciado como equipo de ocasión, corresponde a la unidad con serie A7R3H01737V, ubicada en Tarragona (España). El anuncio acredita su configuración para manipulación y elevación de cargas. Datos operativos del equipo: capacidad nominal declarada de 1500 kg; altura de elevación publicada de 3500 mm. Lectura del horómetro consignada por el vendedor: 4809 horas. Dimensiones y peso publicados: longitud 2100 mm, anchura 2239 mm, altura 2235 mm, peso 1320 KG."
  },
  "6627": {
    "fingerprint": "38e91782e5c4a260d4433550a69dca61b35c97d5d3dc895cf497eba19c438593",
    "general": "La carretilla elevadora diésel KARGO TH40W, del año 2014 y anunciada como equipo de ocasión, corresponde a la unidad con serie 004S/C0192, ubicada en Alicante (España). El anuncio acredita su configuración para manipulación y elevación de cargas. Datos operativos del equipo: capacidad nominal declarada de 4000 kg; altura de elevación publicada de 4200 mm. Lectura del horómetro consignada por el vendedor: 2219 horas. Dimensiones y peso publicados: longitud 4830 mm, anchura 1360 mm, altura 2150 mm, peso 5700 KG. Otros datos de la ficha: altura de mástil replegado: 2150 mm; horquillas: 1200 mm."
  },
  "6835": {
    "fingerprint": "b11263071143bb0a3f9c6978610a3bc0d050d0211575d60ffde42453f038a300",
    "general": "La carretilla elevadora eléctrica YALE ERP35VL, del año 2019 y anunciada como equipo de ocasión, corresponde a la unidad con serie A976B08243T, ubicada en Tarragona (España). El anuncio acredita su configuración para manipulación y elevación de cargas. Datos operativos del equipo: capacidad nominal declarada de 3500 kg; altura de elevación publicada de 4100 mm. Lectura del horómetro consignada por el vendedor: 1660 horas. Dimensiones y peso publicados: longitud 2600 mm, anchura 1173 /1289 mm, altura 2750 mm, peso 5430 KG. Otros datos de la ficha: altura de mástil replegado: 2750 mm; horquillas: 1100 mm."
  },
  "6587": {
    "fingerprint": "04b542b7c9d9fd6faf4694d4ea10e2689a20bc84e4dfa4ec98ce921b877986f8",
    "general": "La carretilla elevadora eléctrica BT C4E500V, del año 2008 y anunciada como equipo de ocasión, corresponde a la unidad con serie CE322803, ubicada en Madrid (España). El anuncio acredita su configuración para manipulación y elevación de cargas. Datos operativos del equipo: capacidad nominal declarada de 5000 kg; altura de elevación publicada de 4700 mm. Lectura del horómetro consignada por el vendedor: 8657 horas. Dimensiones y peso publicados: longitud 4250 mm, anchura 1500 mm, altura 3239 mm, peso 8260 KG. Otros datos de la ficha: mástil: DUPLEX; altura de mástil replegado: 3230 mm; horquillas: 1500x125x50 mm; desplazador lateral: NO; elevación libre: NO."
  },
  "6951": {
    "fingerprint": "dcf3b012599ca2381465983a7ee8f1f443c509b6b3665786f4922429a5e22a65",
    "general": "La carretilla elevadora trilateral BT VCE150A, del año 2011 y anunciada como equipo de ocasión, corresponde a la unidad con serie 6174134, ubicada en Valencia (España). Su ficha técnica identifica una configuración destinada a operaciones de almacenaje y elevación de mercancías. Datos operativos del equipo: capacidad nominal declarada de 1500 kg; altura de elevación publicada de 9050 mm. La ficha no proporciona una lectura de horas acreditada. Dimensiones y peso publicados: longitud 3700 mm, anchura 1520 mm, altura 3750 mm, peso 8460 KG. Otros datos de la ficha: altura de mástil replegado: 3750 mm."
  },
  "6084": {
    "fingerprint": "b2194b5fa009c3e322ea60b8e5bd4b4d0691f566c034ff4b7235d7817e1336d1",
    "general": "El apilador eléctrico a pie LOGITRANS EHSI1000, del año 2021 y anunciado como equipo de ocasión, corresponde a la unidad con serie 214A14224091, ubicada en Vigo (España). Su ficha técnica identifica una configuración destinada a operaciones de almacenaje y elevación de mercancías. Datos operativos del equipo: capacidad nominal declarada de 1000 kg; altura de elevación publicada de 1920 mm. Lectura del horómetro consignada por el vendedor: 1000 horas. Dimensiones y peso publicados: longitud 1730 mm, anchura 673 mm, altura 1920 mm, peso 250 KG. Otros datos de la ficha: altura de mástil replegado: 1590 mm."
  },
  "6949": {
    "fingerprint": "a0e1a3b505e75583eede0b9a98cfea1504440fc30ff89c0692b1efddd135331e",
    "general": "La transpaleta eléctrica HYSTER P1.6, del año 2018 y anunciada como equipo de ocasión, corresponde a la unidad con serie A418T05369S, ubicada en León (España). Se ofrece para la manipulación y el traslado interno de palets, con los datos individuales indicados a continuación. Datos operativos del equipo: capacidad nominal declarada de 1600 kg. El vendedor indica un horómetro sustituido; no acredita las horas totales de uso de esta unidad. Dimensiones y peso publicados: longitud 1672 mm, anchura 712 mm, altura 1221 mm, peso 558 KG."
  },
  "5228": {
    "fingerprint": "2632a4242dbac651a09f582ff070f05b2c0c32688284a8625903fbff4f3b63b6",
    "general": "La transpaleta manual a pie LIFTER GS/I 25S4 RA, del año 2022 y anunciada como equipo de ocasión, corresponde a la unidad con serie HLI0979058, ubicada en Granada (España). Se ofrece para la manipulación y el traslado interno de palets, con los datos individuales indicados a continuación. Datos operativos del equipo: capacidad nominal declarada de 2500 kg. La ficha no proporciona una lectura de horas acreditada. Dimensiones y peso publicados: longitud 1550 mm, anchura 525 mm, altura 1185 mm, peso 59 KG."
  },
  "5880": {
    "fingerprint": "7cec8a272f6ee07086f135fec2753aceb6f4295a83cc9c4a099fe0ce50f802d9",
    "general": "La carretilla elevadora eléctrica CESAB B418, del año 2016 y anunciada como equipo de ocasión, corresponde a la unidad con serie CE401178, ubicada en Alicante (España). El anuncio acredita su configuración para manipulación y elevación de cargas. Datos operativos del equipo: capacidad nominal declarada de 1800 kg; altura de elevación publicada de 3300 mm. Lectura del horómetro consignada por el vendedor: 7222 horas. Dimensiones y peso publicados: longitud 3100 mm, anchura 1020 mm, altura 1950 mm, peso 2500 KG. Otros datos de la ficha: altura de mástil replegado: 1930 mm; horquillas: 1100 mm."
  },
  "6510": {
    "fingerprint": "4a40d0fa8193a11d43aab9414f4abaf4c2e6a4618bae1d2a0c45eca90fa6ea69",
    "general": "La carretilla elevadora eléctrica CARER R150VLK96V, del año 1999 y anunciada como equipo de ocasión, corresponde a la unidad con serie 21591, ubicada en León (España). El anuncio acredita su configuración para manipulación y elevación de cargas. Datos operativos del equipo: capacidad nominal declarada de 15000 kg; altura de elevación publicada de 5000 mm. La ficha no proporciona una lectura de horas acreditada. Dimensiones y peso publicados: longitud 6200 mm, anchura 2500 mm, altura 4100 mm, peso 23400 KG. Otros datos de la ficha: altura de mástil replegado: 4100 mm; horquillas: 2000x200 mm; desplazador lateral: SI."
  },
  "6123": {
    "fingerprint": "41e2fff6ef72d50c6b0d25da3c9477e85a1c809cfda997a72423129995b7ee2c",
    "general": "La transpaleta eléctrica de conductor a pie LOGITRANS EHLIP 1004, del año 2022 y anunciada como equipo de ocasión, corresponde a la unidad con serie 222C14230143, ubicada en Albacete (España). Se ofrece para la manipulación y el traslado interno de palets, con los datos individuales indicados a continuación. Datos operativos del equipo: capacidad nominal declarada de 1500 kg. La ficha no proporciona una lectura de horas acreditada. Dimensiones y peso publicados: longitud 1650 mm, anchura 560 mm, altura 540 mm, peso 272 KG."
  },
  "6571": {
    "fingerprint": "c6a462330700c76736bbdf7662554c8cf52e9c3f02e9a2fd5c9b471e05dbdac8",
    "general": "La plataforma articulada diésel HAULOTTE HA32PX, del año 2009 y anunciada como equipo de ocasión, corresponde a la unidad con serie AD122284, ubicada en Barcelona (España). El anuncio identifica la unidad para trabajos de acceso en altura mediante brazo articulado. Datos operativos del equipo: capacidad nominal declarada de 250 kg; altura de elevación publicada de 32 metros. Lectura del horómetro consignada por el vendedor: 5615 horas. Dimensiones y peso publicados: longitud 11200 mm, anchura 2530 mm, altura 2700 mm, peso 21100 KG. Otros datos de la ficha: pendiente superable declarada: 45%; medidas de la cesta: 2,44X0,80 metros."
  },
  "6879": {
    "fingerprint": "20d43a5379358e9f28f9f09120e7ab5e53bb8933b0f1f6a6f747525f74356421",
    "general": "La plataforma articulada diésel GENIE Z60/34, del año 2007 y anunciada como equipo de ocasión, corresponde a la unidad con serie Z6007-7093, ubicada en Alicante (España). El anuncio identifica la unidad para trabajos de acceso en altura mediante brazo articulado. Datos operativos del equipo: capacidad nominal declarada de 227 kg; altura de elevación publicada de 20 metros. Lectura del horómetro consignada por el vendedor: 6345 horas. Dimensiones y peso publicados: longitud 8150 mm, anchura 2460 mm, altura 2690 mm, peso 10826 KG. Otros datos de la ficha: pendiente superable declarada: 40%; medidas de la cesta: 2,44X0,91 metros."
  },
  "6977": {
    "fingerprint": "3915e198345e5a9559ca6b6cb1bde6dd69bae87673dbd249f1abb5a04c84823a",
    "general": "La plataforma articulada diésel JLG 800AJ, del año 2005 y anunciada como equipo de ocasión, corresponde a la unidad con serie 300081910, ubicada en Alicante (España). El anuncio identifica la unidad para trabajos de acceso en altura mediante brazo articulado. Datos operativos del equipo: capacidad nominal declarada de 230 kg; altura de elevación publicada de 26 metros. Lectura del horómetro consignada por el vendedor: 7139 horas. Dimensiones y peso publicados: longitud 11120 mm, anchura 2430 mm, altura 3000 mm, peso 15000 KG. Otros datos de la ficha: pendiente superable declarada: 45%; medidas de la cesta: 1,83x0,91 metros."
  },
  "6752": {
    "fingerprint": "4e8f3539da96a9674625737f91905c26dfb29ebb090021faf4ee5cac8fa901b3",
    "general": "La plataforma articulada diésel JLG 600AJ, del año 2007 y anunciada como equipo de ocasión, corresponde a la unidad con serie 0300107883, ubicada en Soria (España). El anuncio identifica la unidad para trabajos de acceso en altura mediante brazo articulado. Datos operativos del equipo: capacidad nominal declarada de 230 kg; altura de elevación publicada de 20 metros. Lectura del horómetro consignada por el vendedor: 5541 horas. Dimensiones y peso publicados: longitud 8820 mm, anchura 2490 mm, altura 2570 mm, peso 10826 KG. Otros datos de la ficha: pendiente superable declarada: 45 %; medidas de la cesta: 1,83x0,91 metros."
  },
  "6980": {
    "fingerprint": "dd70874903bdbabc3d6c10a67ddf103f291fbe2f51e7d24dd822dbf476bd45b1",
    "general": "La plataforma de tijera eléctrica JLG 1930ES se anuncia como unidad de ocasión del año 2014. La ficha técnica declara capacidad de carga de 230 KG. La unidad está situada en Burgos (España) y se identifica con el número de serie 0200232676. El horómetro registra 655 horas. Dimensiones y peso publicados: longitud 1870 mm, anchura 760 mm, altura 1590 mm, peso 1565 KG. Datos adicionales consignados: dimensiones de la cesta: 1,87X0,76 metros."
  },
  "6846": {
    "fingerprint": "7bd18fad5b84f335ec2ae29c92a5cc8988d9c4aa7880e3a3b32c8f03df33d45d",
    "general": "La plataforma articulada diésel JLG 510AJ se anuncia como unidad de ocasión del año 2006. La ficha técnica declara altura de elevación de 18 metros y capacidad de carga de 230 KG. La unidad está situada en Alicante (España) y se identifica con el número de serie 1300001930. El horómetro registra 5962 horas. Dimensiones y peso publicados: longitud 7680 mm, anchura 2260 mm, altura 2300 mm, peso 7610 KG. Datos adicionales consignados: pendiente superable: 45%; dimensiones de la cesta: 1,83 x 0,76 metros."
  },
  "6945": {
    "fingerprint": "e451540536f59fa4ad08f4cb282b09fc6a17e256f8a59ac15db0ddb2970a93d7",
    "general": "La plataforma articulada diésel JLG 800AJ se anuncia como unidad de ocasión del año 2007. La ficha técnica declara altura de elevación de 26 metros y capacidad de carga de 230 KG. La unidad está situada en Tarragona (España) y se identifica con el número de serie 0300121662. El proveedor indica que el horómetro está sustituido y no acredita las horas totales de uso. Dimensiones y peso publicados: longitud 11120 mm, anchura 2430 mm, altura 3000 mm, peso 15600 KG. Datos adicionales consignados: pendiente superable: 45%; dimensiones de la cesta: 1,83x0,91 metros."
  },
  "6726": {
    "fingerprint": "b52a31ba951b1fa08aa1eab28f099f6224bc47a578c629542cad1712f4fb21a2",
    "general": "La carretilla elevadora diésel Kalmar DCE120-6 se anuncia como unidad de ocasión del año 2011. La ficha técnica declara elevación de 4000 mm y capacidad de carga de 12000 KG. La unidad está situada en León (España) y se identifica con el número de serie A40200265. El horómetro registra 17018 horas. Dimensiones y peso publicados: longitud 6500 mm, anchura 2530 mm, altura 3560 mm, peso 17500 KG. Datos adicionales consignados: mástil: DUPLEX; desplazador lateral; horquillas: 1600 mm; altura del mástil replegado: 3515 mm."
  },
  "5962": {
    "fingerprint": "8a365f3fd8884dfd647668d269caf71415af47fc811f4443cbfd01ab1a29ab2f",
    "general": "La transpaleta eléctrica de conductor montado Hyster P2.0S FBW se anuncia como unidad de ocasión del año 2015. La ficha técnica declara capacidad de carga de 2000 KG. La unidad está situada en Montijo (Portugal) y se identifica con el número de serie D439T04424N. El horómetro registra 3986 horas. Dimensiones y peso publicados: longitud 1955 mm, anchura 800 mm, altura 1565 mm, peso 1032 KG. Datos adicionales consignados: horquillas: 1185 mm."
  },
  "5719": {
    "fingerprint": "ee71bb159af147e659587ecee361b83cfd0be86777377b17e1fe2442e28206f7",
    "general": "La transpaleta eléctrica de conductor montado Hyster P2.0S se anuncia como unidad de ocasión del año 2018. La ficha técnica declara capacidad de carga de 2000 KG. La unidad está situada en Montijo (Portugal) y se identifica con el número de serie D439T06776S. El horómetro registra 1445 horas. Dimensiones y peso publicados: longitud 1960 mm, anchura 800 mm, altura 1565 mm, peso 930 KG. Datos adicionales consignados: horquillas: 1185 mm."
  },
  "6618": {
    "fingerprint": "4935d5659b3eae6fa1035c8ada6d817da3702bd16ac9120ba551faec4831d460",
    "general": "La carretilla elevadora diésel Mitsubishi FD45K2 se anuncia como unidad de ocasión del año 2006. La ficha técnica declara elevación de 4750 mm y capacidad de carga de 4500 KG. La unidad está situada en Alicante (España) y se identifica con el número de serie EF19C-80378. El horómetro registra 6089 horas. Dimensiones y peso publicados: longitud 4200 mm, anchura 1300 mm, altura 2370 mm, peso 7165 KG. Datos adicionales consignados: mástil: TRIPLEX; horquillas: 1200 mm; altura del mástil replegado: 2370 mm."
  },
  "6116": {
    "fingerprint": "f272300a00d7163c933cc0953eaad4a273635e1f9e8bdcdbc7805d664edd6cb3",
    "general": "La plataforma de tijera eléctrica Snorkel S4732E se anuncia como unidad de ocasión del año 2018. La ficha técnica declara altura de elevación de 12 metros y capacidad de carga de 350 KG. La unidad está situada en Barcelona (España) y se identifica con el número de serie S4732E-01-180300380. La ficha no acredita una lectura válida del horómetro. Dimensiones y peso publicados: longitud 2300 mm, anchura 1190 mm, altura 2390 mm, peso 2740 KG. Datos adicionales consignados: pendiente superable: 25%; dimensiones de la cesta: 2,14X1,09 metros."
  },
  "6486": {
    "fingerprint": "ff9b24b98f46b2c19e53d1e930b62fff440e8cab44bd34c81e6771017b4390bf",
    "general": "La plataforma de tijera eléctrica JLG 1930 ES se anuncia como unidad de ocasión del año 2006. La ficha técnica declara altura de elevación de 8 metros y capacidad de carga de 230 KG. La unidad está situada en Alicante (España) y se identifica con el número de serie 1200010109. El horómetro registra 765 horas. Dimensiones y peso publicados: longitud 1870 mm, anchura 760 mm, altura 1520 mm, peso 1700 KG. Datos adicionales consignados: pendiente superable: 25%."
  },
  "6284": {
    "fingerprint": "69a2a97c40610a17976aef04f7121e42e1b6f989872be610f06af5104c9c147b",
    "general": "La plataforma de tijera eléctrica Genie GS-2632 se anuncia como unidad de ocasión del año 2016. La ficha técnica declara altura de elevación de 10 metros y capacidad de carga de 227 KG. La unidad está situada en León (España) y se identifica con el número de serie GS3216C-15436. El proveedor indica que el horómetro está sustituido y no acredita las horas totales de uso. Dimensiones y peso publicados: longitud 2440 mm, anchura 810 mm, altura 2260 mm, peso 2007 KG. Datos adicionales consignados: pendiente superable: 30%; dimensiones de la cesta: 2,26x0,81 metros."
  },
  "2082": {
    "fingerprint": "92dd054aa22b604c2dc94d79204a49bce54fdaf1975925fcf98e8cc655b3b8f4",
    "general": "La carretilla elevadora diésel Hyster H2.5A6 se ofrece como modelo nuevo. La ficha técnica declara elevación de 8550 mm y capacidad de carga de 2500 KG. Dimensiones y peso publicados: longitud 3714 mm, anchura 1353 mm, altura 2592 mm, peso 4642 KG. Datos adicionales consignados: centro de carga: 600 mm; radio de giro: 2333mm."
  },
  "2084": {
    "fingerprint": "a93e1f9c48d77660491773c850c2bd60dc2b4247dd918140fec391ab173ffd4f",
    "general": "La carretilla elevadora diésel Hyster H3.5A se ofrece como modelo nuevo. La ficha técnica declara elevación de 8070 mm y capacidad de carga de 3500 KG. Dimensiones y peso publicados: longitud 3813 mm, anchura 1353 mm, altura 2692 mm, peso 6470 KG. Datos adicionales consignados: centro de carga: 500 mm; radio de giro: 2449mm."
  },
  "2085": {
    "fingerprint": "188a18da04b0aac6acb8ada2f376caa8b9673dc2ada89115e2dcf49524a41dbb",
    "general": "La carretilla elevadora diésel Hyster H4.0FT5 se ofrece como modelo nuevo. La ficha técnica declara elevación de 6000 mm y capacidad de carga de 4000 KG. Dimensiones y peso publicados: longitud 3946 mm, anchura 1485 mm, altura 2171 mm, peso 6264 KG. Datos adicionales consignados: centro de carga: 600 mm; radio de giro: 2599mm."
  },
  "2041": {
    "fingerprint": "c78974fc9db31da67adaaef9b3e8a5c4a65df95db19bfab21de8bfa7e31660df",
    "general": "La carretilla elevadora diésel Hyster H18XDS-9 se ofrece como modelo nuevo. La ficha técnica declara elevación de 7000 mm y capacidad de carga de 18000 KG. Dimensiones y peso publicados: longitud 7975 mm, anchura 2923 mm, altura 4142 mm, peso 28858 KG. Datos adicionales consignados: motor declarado: MTU 7.7L Diesel."
  },
  "2045": {
    "fingerprint": "a4979421d0811eee6f6956b296639f172870149876d438c198395df9da48c8d7",
    "general": "La carretilla elevadora diésel Hyster H25XD-9 se ofrece como modelo nuevo. La ficha técnica declara elevación de 9850 mm y capacidad de carga de 25000 KG. Dimensiones y peso publicados: longitud 8321 mm, anchura 3220 mm, altura 4099 mm, peso 45616 KG. Datos adicionales consignados: centro de carga: 900 mm; radio de giro: 6185mm; motor declarado: MTU 7.7L Diesel."
  },
  "2046": {
    "fingerprint": "a64021e7da24c66d1da1790735c19e6142fc21a1327b371759d8053218134690",
    "general": "La carretilla elevadora diésel Hyster H28XD-12 se ofrece como modelo nuevo. La ficha técnica declara elevación de 9850 mm y capacidad de carga de 28000 KG. Dimensiones y peso publicados: longitud 9066 mm, anchura 3430 mm, altura 4224 mm, peso 46262 KG. Datos adicionales consignados: centro de carga: 1200 mm; radio de giro: 6185mm; motor declarado: MTU 7.7L Diesel."
  },
  "2048": {
    "fingerprint": "9c631e65065ca3a67930e8f4ada21f7b01f7c2b2ef231cf4ce72df8c756e0c25",
    "general": "La carretilla elevadora diésel Hyster H30XD-9 se ofrece como modelo nuevo. La ficha técnica declara elevación de 9850 mm y capacidad de carga de 29700 KG. Dimensiones y peso publicados: longitud 8686 mm, anchura 3430 mm, altura 4224 mm, peso 45935 KG. Datos adicionales consignados: centro de carga: 900 mm; radio de giro: 6185mm; motor declarado: MTU 7.7L Diesel."
  },
  "2047": {
    "fingerprint": "56cd274c724659d0639e44abc39270ede0a27e3e437d93db5244f7930f45d1e7",
    "general": "La carretilla elevadora diésel Hyster H30XD-12 se ofrece como modelo nuevo. La ficha técnica declara elevación de 9850 mm y capacidad de carga de 30000 KG. Dimensiones y peso publicados: longitud 9066 mm, anchura 3430 mm, altura 4224 mm, peso 45325 KG. Datos adicionales consignados: centro de carga: 1200 mm; radio de giro: 5.691mm; motor declarado: MTU 7.7L Diesel."
  },
  "22": {
    "fingerprint": "4ef7bdea8083b7448b6196b3550e1c05ad66d87775a9ac2c8bd3f66338bdc0cc",
    "general": "La carretilla elevadora eléctrica Hyster J1.6XN se ofrece como modelo nuevo. La ficha técnica declara elevación de 5500 mm y capacidad de carga de 1600 KG. Dimensiones y peso publicados: longitud 3088 mm, anchura 1050 mm, altura 2230 mm. Datos adicionales consignados: centro de carga: 500 mm; radio de giro: 1654mm; batería: 48V / 625Ah(V/Ah)."
  },
  "18": {
    "fingerprint": "de151cb744baf37238c5a7bf7c89bfb9490f98081128554b8457269bc792e823",
    "general": "La carretilla elevadora eléctrica Hyster A1.3XNT se ofrece como modelo nuevo. La ficha técnica declara capacidad de carga de 1300 KG. Dimensiones y peso publicados: longitud 2724 mm, altura 2060 mm. Datos adicionales consignados: radio de giro: 1398; batería: 24V / 735-875Ah(V/Ah)."
  },
  "2027": {
    "fingerprint": "e07ba13d0cf19018430c4c03b102390583d7595a0ae621e957ea67f7246aa578",
    "general": "La carretilla elevadora eléctrica Hyster E5.0XN se ofrece como modelo nuevo. La ficha técnica declara elevación de 5740 mm y capacidad de carga de 5000 KG. Dimensiones y peso publicados: longitud 3821 mm, anchura 1420 mm, altura 2138 mm, peso 8112 KG. Datos adicionales consignados: centro de carga: 500 mm; radio de giro: 2341mm; batería: 80V / 750Ah(V/Ah)."
  },
  "2037": {
    "fingerprint": "e45d4596d3950142f248dda789b51ad12ddd076240ff4aa7c81f7fed77a321d7",
    "general": "La carretilla elevadora eléctrica Hyster J2.5XNL se ofrece como modelo nuevo. La ficha técnica declara elevación de 5250 mm y capacidad de carga de 2500 KG. Dimensiones y peso publicados: longitud 3480 mm, anchura 1289 mm, altura 2192 mm. Datos adicionales consignados: centro de carga: 500 mm; radio de giro: 2073mm."
  },
  "6976": {
    "fingerprint": "d722f6299346071058426beddec4764846fb904e9ea90a91b575b4c43a93ca9e",
    "general": "La unidad de ocasión MANITOU MI50D, anunciada como «Carretilla elevadora diésel 5000Kg MANITOU MI50D», figura como fabricada en 2026, con número de serie MAN00000C01170516. Ubicación declarada: VALENCIA, ESPAÑA. Horómetro declarado: 385 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 5000 KG; altura de elevación (mm): 4000 mm; tipo mástil: DUPLEX. Dimensiones y peso publicados: longitud: 3250 mm; anchura: 1490 mm; altura: 3250 mm; peso: 7140 KG. El anuncio especifica cabina con aire acondicionado y cuarta válvula; se entrega sin pinzas ni horquillas."
  },
  "6975": {
    "fingerprint": "dfeb0b0ca8704e3fe6fdb5a92d0654175a89e8fe3dd5bc8788898c0b686bfa21",
    "general": "La unidad de ocasión MANITOU MI50D, anunciada como «Carretilla elevadora diésel 5000Kg MANITOU MI50D», figura como fabricada en 2026, con número de serie MAN00000C01170517. Ubicación declarada: VALENCIA, ESPAÑA. Horómetro declarado: 385 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 5000 KG; altura de elevación (mm): 4000 mm; tipo mástil: DUPLEX. Dimensiones y peso publicados: longitud: 3250 mm; anchura: 1490 mm; altura: 3250 mm; peso: 7140 KG. El anuncio especifica cabina con aire acondicionado y cuarta válvula; se entrega sin pinzas ni horquillas."
  },
  "6966": {
    "fingerprint": "869bcb8ec5dee6c2b56bda73a19e2a64b7f9fba998c4d41a269b73b09debd08d",
    "general": "La unidad de ocasión TECNA VTA25, anunciada como «Tractor de arrastre 25TN TECNA VTA25», figura como fabricada en 2015, con número de serie 0125E0515166. Ubicación declarada: VALLADOLID, ESPAÑA. Horómetro declarado: 4000 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 2000 KG. Dimensiones y peso publicados: longitud: 2525 mm; anchura: 1250 mm; altura: 2440 mm; peso: 3165 KG."
  },
  "6391": {
    "fingerprint": "88f7199c60a61db2812b95166f92e1461d17bf789a5a100d5c1d2a870513ae91",
    "general": "La unidad de ocasión JLG 4013, anunciada como «Manipulador telescópico 13M 4000Kg JLG 4013», figura como fabricada en 2006, con número de serie 1160001557. Ubicación declarada: ALICANTE, ESPAÑA. Horómetro declarado: 6627 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 4000 KG; altura de elevación (m): 13 metros. Dimensiones y peso publicados: longitud: 6000 mm; anchura: 2380 mm; altura: 2450 mm; peso: 11710 KG."
  },
  "6858": {
    "fingerprint": "9b5d053021a799ebc8a8c352b5218dc897bbfb09d22360372ed3c5c6e74b2f6d",
    "general": "La unidad de ocasión YALE ERP35VL, anunciada como «Carretilla elevadora eléctrica 3500 Kg YALE ERP35VL», figura como fabricada en 2019, con número de serie A976B08243T. Ubicación declarada: TARRAGONA, ESPAÑA. Horómetro declarado: 1662 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 3500 KG; altura de elevación (mm): 4100 mm; tipo mástil: DUPLEX; desplazador lateral: SI. Dimensiones y peso publicados: longitud: 2600 mm; anchura: 1180 mm; altura: 2750 mm; peso: 5430 KG."
  },
  "6947": {
    "fingerprint": "7a66c4d6040fd3263888a28b1112f3ed0857ddbf5cc78c1c05fed4d7fce0be93",
    "general": "La unidad de ocasión HAULOTTE HA20 RTJ, anunciada como «PLATAFORMA ARTICULADA DIÉSEL 20M HAULOTE HA20 RTJ», figura como fabricada en 2016, con número de serie AD127829. Ubicación declarada: PALENCIA, ESPAÑA. Prestaciones registradas en la ficha: capacidad de carga (kg): 230 KG; altura de elevación (m): 20 metros; pendiente superable: 45%. Dimensiones y peso publicados: longitud: 6160 mm; anchura: 2430 mm; altura: 2980 mm; peso: 9300 KG."
  },
  "5961": {
    "fingerprint": "6e543a8d2cc3fe11cf7c82e37423a6a82f7216cf4a24ae69d079e673bc9f042b",
    "general": "La unidad de ocasión HYSTER P2.0S FBW, anunciada como «Transpaleta eléctrica conductor montado 2000 kg HYSTER P2.0S FBW», figura como fabricada en 2015, con número de serie D439T05114N. Ubicación declarada: MONTIJO, PORTUGAL. Horómetro declarado: 2865 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 2000 KG. Dimensiones y peso publicados: longitud: 1955 mm; anchura: 800 mm; altura: 1565 mm; peso: 1007 KG."
  },
  "6196": {
    "fingerprint": "d9e773296eadde9f4e91834a02fc4c59566a1b3bf11b41809ae646b4f601724c",
    "general": "La unidad de ocasión JLG 1930 ES, anunciada como «Plataforma Tijera Eléctrica 8M JLG 1930ES», figura como fabricada en 2015, con número de serie B200021461. Ubicación declarada: ALICANTE, ESPAÑA. Horómetro declarado: 675 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 230 KG; altura de elevación (m): 8 metros; pendiente superable: 25%. Dimensiones y peso publicados: longitud: 1870 mm; anchura: 760 mm; altura: 1520 mm; peso: 1560 KG."
  },
  "6195": {
    "fingerprint": "a3ab6888af50d1ad923ee9873728a4bf35dc448e2c0a434bf5982e85b09ce919",
    "general": "La unidad de ocasión JLG 1930 ES, anunciada como «Plataforma Tijera Eléctrica 8M JLG 1930ES», figura como fabricada en 2016, con número de serie B200029131. Ubicación declarada: ALICANTE, ESPAÑA. Horómetro declarado: 676 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 230 KG; altura de elevación (m): 8 metros; pendiente superable: 25%. Dimensiones y peso publicados: longitud: 1870 mm; anchura: 760 mm; altura: 1520 mm; peso: 1564 KG."
  },
  "6122": {
    "fingerprint": "a4f494f093ebcf5c0bfd8f917f6a5a83b56b489cfc6f696a2f05548094b4d118",
    "general": "La unidad de ocasión YALE MP20T, anunciada como «Transpaleta eléctrica 2000Kg YALE MP20T», figura como fabricada en 2016, con número de serie C854T01515P. Ubicación declarada: MADRID, ESPAÑA. Horómetro declarado: 2180 horas. Prestaciones registradas en la ficha: capacidad de carga (kg): 2000 KG. Dimensiones y peso publicados: longitud: 1960 mm; anchura: 795 mm; altura: 1350 mm; peso: 1030 KG."
  },
  "4717": {
    "fingerprint": "ddffae4e5335e78f366dc4a96b8e256bfa60ba8728b611ad57a5abccdb76ab46",
    "general": "La ficha del equipo CTE ZED 20.4 HN corresponde al anuncio de maquinaria nueva «Plataforma sobre camión articulada CTE ZED 20.4 HN ISUZU». Prestaciones registradas en la ficha: capacidad de carga (kg): 250 KG; altura de elevación (m): 20 metros."
  },
  "3802": {
    "fingerprint": "b2cb0096a288f87e45321f0b1ef4baf964c9a54896e705f387cfa3168372e663",
    "general": "La ficha del equipo HYSTER J8.0XNL9 corresponde al anuncio de maquinaria nueva «Carretilla elevadora eléctrica Hyster J8.0XNL9». Prestaciones registradas en la ficha: capacidad de carga (kg): 8000 KG; altura de elevación (mm): 2900 mm; tipo motor: Eléctrico. Dimensiones y peso publicados: longitud: 5238 mm; anchura: 2239 mm; altura: 3462 mm; peso: 12265 KG."
  },
  "4814": {
    "fingerprint": "e61100a9b22678dba4d6fd06589b3890434035bab58d215f3cc8269b83d1c8c3",
    "general": "La ficha del equipo XCMG XT3207KH corresponde al anuncio de maquinaria nueva «Manipulador telescópico XCMG XT3207KH». Prestaciones registradas en la ficha: capacidad de carga (kg): 3200 KG; altura de elevación (m): 7 metros."
  },
  "2086": {
    "fingerprint": "617bae353f1b79826ad7fe3a3dec1bfb3717f1f190d1df68ae96135448a1d55d",
    "general": "La ficha del equipo HYSTER H4.0FT6 corresponde al anuncio de maquinaria nueva «Carretilla elevadora diésel 4000Kg Hyster H4.0FT6». Prestaciones registradas en la ficha: capacidad de carga (kg): 4000 KG; altura de elevación (mm): 6000 mm; centro de carga: 500 mm; tipo motor: Kubota 3.8L Diesel / Kubota 3.8L LPG; motorización: Diésel. Dimensiones y peso publicados: longitud: 3977 mm; anchura: 1485 mm; altura: 2171 mm; peso: 7027 KG."
  },
  "2065": {
    "fingerprint": "8cb9ee32ebba956f927c06a9be002452084383ca962c3a4e17dfc4fa9e4963e4",
    "general": "La ficha del equipo HYSTER H16XD-12 corresponde al anuncio de maquinaria nueva «Carretilla elevadora diésel 16400Kg Hyster H16XD-12». Prestaciones registradas en la ficha: capacidad de carga (kg): 16400 KG; altura de elevación (mm): 7000 mm; centro de carga: 1200 mm; motorización: Diésel. Dimensiones y peso publicados: longitud: 7424 mm; anchura: 2541 mm; altura: 4193 mm; peso: 19459 KG."
  },
  "2293": {
    "fingerprint": "19bfa7709d6f9b49c552dc1f79e72c4e59548f5c17583ec984860fe04ea41c55",
    "general": "La ficha del equipo YALE ERP20VF (LWB) corresponde al anuncio de maquinaria nueva «Carretilla elevadora eléctrica 2000Kg Yale ERP20VF». Prestaciones registradas en la ficha: capacidad de carga (kg): 2000 KG; altura de elevación (mm): 5500 mm; centro de carga: 500 mm; motorización: Eléctrico; capacidad de la batería: 48V / 750Ah(V/Ah). Dimensiones y peso publicados: longitud: 3083 mm; anchura: 1116 mm; altura: 2180 mm."
  },
  "157": {
    "fingerprint": "e19c2026a77cf099b94c8ff22b6bd7a67cb1781121067850176396a819ec4e4a",
    "general": "La ficha del equipo BRAVI SPRINT TL corresponde al anuncio de maquinaria nueva «Plataforma elevadora de neumáticos 5,3M BRAVI Sprint TL». Prestaciones registradas en la ficha: capacidad de carga (kg): 130 + 100 KG; altura de elevación (m): 5,35 metros; altura plataforma: 3.35 metros; tipo motor: Eléctrico; capacidad de la batería: 6/245V/Ah; pendiente superable: 35%. Dimensiones y peso publicados: longitud: 2243 mm; anchura: 809 mm; altura: 1601 mm; peso: 660 KG. La capacidad «130 + 100 KG» se conserva tal como aparece en el campo técnico, sin sumar ni reinterpretar sus componentes."
  },
  "4741": {
    "fingerprint": "e5e8df362203a055552bc556e4397d0a28b101e20244f4dd66e10db11bb3797c",
    "general": "La ficha del equipo XCMG XG1012AC-LI corresponde al anuncio de maquinaria nueva «Plataforma elevadora de tijera eléctrica 10M XCMG XG1012AC con batería de litio». Prestaciones registradas en la ficha: capacidad de carga (kg): 450 KG; altura de elevación (m): 10 metros; tipo de batería: Batería de litio; pendiente superable: 25%. Dimensiones y peso publicados: longitud: 2680 mm; anchura: 1170 mm; altura: 2335 mm; peso: 2680 KG."
  },
  "4745": {
    "fingerprint": "a6fff7fa84f77cf6ed46a10e54c4b06cf5770a8e6502993aae361bb604da84a4",
    "general": "La ficha del equipo XCMG XG1412AC-LI corresponde al anuncio de maquinaria nueva «Plataforma elevadora de tijera eléctrica 14M XCMG XG1412AC con batería de litio». Prestaciones registradas en la ficha: capacidad de carga (kg): 320 KG; altura de elevación (m): 14 metros; tipo de batería: Batería de litio; pendiente superable: 25%. Dimensiones y peso publicados: longitud: 2480 mm; anchura: 1190 mm; altura: 2610 mm; peso: 3150 KG."
  },
  "4747": {
    "fingerprint": "4e7a871f098fb8d6e0c4e64ee27b9c502abdbac50d0b415781cdc64eb49f405b",
    "general": "La ficha del equipo XCMG XG1614AC-LI corresponde al anuncio de maquinaria nueva «Plataforma elevadora de tijera eléctrica 16M XCMG XG1614AC con batería de litio». Prestaciones registradas en la ficha: capacidad de carga (kg): 350 KG; altura de elevación (m): 16 metros; tipo de batería: Batería de litio; pendiente superable: 25%. Dimensiones y peso publicados: longitud: 2840 mm; anchura: 1390 mm; altura: 2721 mm; peso: 3680 KG."
  }

};

export const resolveGamVerifiedSourceCondensedGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam" || !record.reference || !record.url.startsWith("https://online.gamrentals.com/")) return null;
  const entry: VerifiedGeneral | undefined = evidence[record.reference];
  if (!entry) return null;
  const fingerprint = createHash("sha256").update(JSON.stringify(record)).digest("hex");
  return fingerprint === entry.fingerprint ? entry.general : null;
};
