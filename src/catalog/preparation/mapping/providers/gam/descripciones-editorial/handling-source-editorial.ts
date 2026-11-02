import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";

type HandlingEditorial = {
  readonly source: string;
  readonly prepared: string;
  readonly general: string;
  readonly short: string | null;
};

const evidence: Readonly<Record<string, HandlingEditorial>> = {
  "2369": {
    "source": "3e63ce327b1e1c6b8e0a0b467cbda45a1c5d0dbb15bb9fed8dcb69927a974069",
    "prepared": "78d9586f07f3201cf5117529667693f9f3c96f3e247471ada782bfd71bee5ccd",
    "general": "La Yale GP90VX es una carretilla elevadora diésel para la manipulación de cargas pesadas en instalaciones industriales y patios logísticos. La ficha de este anuncio identifica una capacidad nominal de 9.000 kg; no publica dimensiones ni altura de elevación verificables para esta referencia. Antes de destinarla a una operación debe comprobarse el diagrama de cargas, el mástil y las condiciones del recorrido.",
    "short": null
  },
  "2260": {
    "source": "06c1fc3636d8b236563f542657e1dd5b740f6076a55d41da4ed6f1b349427f44",
    "prepared": "2f7d0e093d883d604754faf3eae80f6c244935136131f43bfc3a5ecfaac0e7bd",
    "general": "Apilador eléctrico Yale MS12 IL de conducción a pie para apilado y movimiento de mercancía paletizada. Según la ficha, admite 1.200 kg, mide 790 mm de anchura y 1.900 mm de altura, con un peso de 1.191 kg. La alimentación se describe con distintas opciones de batería de 24 V, incluida una variante de litio de 200 Ah. Estas opciones no se atribuyen como equipamiento único de una unidad concreta.",
    "short": null
  },
  "2335": {
    "source": "3ea0ec6b12e760e1b90dfb80191cbe718ebdcad94c5855a01e88f62981704cfb",
    "prepared": "b53e60f20fd5e060a0fb303a95859d2ce5ca173142fa38dfdb62a8f6c020bf23",
    "general": "El Yale MS16X es un apilador eléctrico para labores de almacenamiento y colocación de palés, con capacidad nominal de 1.600 kg. La ficha recoge 2.081 mm de longitud, 790 mm de anchura y 2.100 mm de altura, además de un peso de 1.240 kg. Se anuncian alternativas de batería a 24 V, convencional y de litio, sin especificar cuál se instala en la máquina ofertada.",
    "short": null
  },
  "5988": {
    "source": "578c9333d4368a8c66313b7ae566bee83dbf3f965d0f37042564857728433f68",
    "prepared": "c63fc7ceab8317608468f78c592e037739337126a5b76fa2866e175b1a8fefce",
    "general": "Carretilla elevadora eléctrica Yale ERP2.0MXLG destinada al transporte y apilado de palés, con capacidad nominal declarada de 2.000 kg y centro de carga de 476 mm. La ficha técnica consigna 3.000 mm de elevación, 3.630 mm de longitud, 1.160 mm de anchura, 2.010 mm de altura y 3.640 kg de peso. El resumen comercial menciona 4,4 metros, valor que no coincide con la elevación de la ficha y requiere confirmación del mástil.",
    "short": "Carretilla eléctrica Yale ERP2.0MXLG de 2.000 kg; elevación de 3.000 mm según ficha (resumen original: 4,4 m)."
  },
  "2287": {
    "source": "e88ec9c2f872ff5c8efbba870ea9dbf01d1aae81e70ac6503d844aa8c21e13ef",
    "prepared": "42fa9b9e7add3d52b000ef87dab87c90c4a040247c00a4f44c2e283c7874f90f",
    "general": "La Yale ERP20UX es una carretilla elevadora eléctrica con capacidad nominal de 2.000 kg y centro de carga de 500 mm. La ficha indica elevación de 6.000 mm, batería de 48 V y 600 Ah, y dimensiones de 3.372 × 1.285 × 2.015 mm. El peso declarado es de 4.040 kg. La descripción comercial utiliza también la denominación ERP20UXT; la variante exacta debe verificarse antes de asignarle prestaciones adicionales.",
    "short": null
  },
  "6323": {
    "source": "4d2fc2b581140ccb34e977806266f6ce059d38f445782873a837fb197941f22f",
    "prepared": "39c05b11f4180eb5c2f757b0191ab11ecef6d4f1a5f645fe015513634864ee9d",
    "general": "Carretilla elevadora eléctrica Yale ERP18UX L de 1.800 kg de capacidad nominal para operaciones de carga y apilado. Su ficha consigna una elevación de 3.990 mm, centro de carga de 500 mm y dimensiones de 3.026 × 1.120 × 2.000 mm, con peso de 3.310 kg. El resumen anuncia 5,5 metros, una altura diferente de la ficha técnica; debe confirmarse la configuración de mástil ofrecida.",
    "short": "Carretilla eléctrica Yale ERP18UX L de 1.800 kg; elevación de 3.990 mm según ficha (resumen original: 5,5 m)."
  },
  "5888": {
    "source": "f1a1fc758ef6e81d0b67ea8d68b62459e7d14d2c4f078b9d3ffbec42b77b60c5",
    "prepared": "562de9c5bd36a2b0e1492f1cfeef8da7d928490a9865b368318dc14de7921833",
    "general": "La Hyster J2.2A es una carretilla elevadora eléctrica de 2.200 kg de capacidad nominal, con centro de carga de 500 mm. La ficha declara 3.250 mm de elevación, 3.372 mm de longitud, 1.185 mm de anchura y 2.140 mm de altura. Su peso publicado es de 4.550 kg y el radio de giro figura como 1.955 mm. Es importante contrastar el espacio de maniobra y la configuración real del mástil antes de seleccionar la máquina.",
    "short": null
  },
  "2318": {
    "source": "09a2851766f110a1e4e26275d87b204825e56757e7a9c0ec8d2356afa309c306",
    "prepared": "1cedd39d0792bd44b8974b4dce93532d9b73f857e60915bda7c84524634a6e3b",
    "general": "Carretilla elevadora diésel Yale GP2.5N6 con capacidad nominal de 2.500 kg, centro de carga de 600 mm y elevación publicada de 8.550 mm. La ficha recoge 3.714 × 1.353 × 2.592 mm de dimensiones y 4.292 kg de peso. El apartado de motor también enumera una alternativa GLP y el de transmisión recoge opciones, por lo que no se asigna una configuración concreta distinta del combustible anunciado.",
    "short": null
  },
  "2319": {
    "source": "19c6090fb6c667e923e0b5892d666407ee4e34228317337a18a05169ad8cebcd",
    "prepared": "a631e14b4d03c70000d0dbd4dccaa57e5ea9ef6458f19ffcba519a1aaf0ce97b",
    "general": "La Yale GP3.0N es una carretilla elevadora anunciada con motorización diésel y capacidad nominal de 3.000 kg a 500 mm de centro de carga. La ficha consigna una elevación de 8.000 mm y dimensiones de 3.746 × 1.353 × 2.692 mm, con 4.642 kg de peso. El anuncio agrupa alternativas de motor y transmisión, que deben confirmarse para la unidad elegida sin atribuirlas indistintamente.",
    "short": null
  },
  "2320": {
    "source": "9453bde21b5fc9a65ab45f70bf9e150f6c33819fd503a3bb7ad266591cc63522",
    "prepared": "22ad50eb4f8690b0ac475b6f289f20e33808b2041e042501997756d47342b34e",
    "general": "Carretilla elevadora diésel Yale GP3.5N para manutención de cargas de hasta 3.500 kg a un centro de carga de 500 mm. La ficha publica elevación de 8.000 mm, dimensiones de 3.813 × 1.353 × 2.692 mm y peso de 4.910 kg. Se citan distintas motorizaciones y transmisiones como alternativas de gama; la configuración efectiva de cada unidad debe verificarse por separado.",
    "short": null
  },
  "2139": {
    "source": "4c2b7e279b2337cae718e92b2e8da07f9a99414005aa633c069fb92b0fb32d67",
    "prepared": "e59e788687f1f0d2df799bb8b8f579974c731b4f3d2e06c79336aa31bd4c5741",
    "general": "La Hyster P2.2 es una transpaleta eléctrica para desplazamientos horizontales de mercancía paletizada, con carga nominal de 2.200 kg. Su ficha declara un peso de 632 kg, una elevación de 0,13 m y batería de 24 V, con capacidades ofertadas entre 150 y 375 Ah. El rango de batería describe configuraciones posibles y no identifica la capacidad instalada de una unidad concreta.",
    "short": null
  },
  "2242": {
    "source": "4d9352e09e27fd96cd00b2dd3b5a286dc358be62c3787cf2f2c3c525a31fb0e6",
    "prepared": "58825e387136115df8271223560ebbe3751972054322ba0c61c9775caef35e57",
    "general": "Transpaleta eléctrica de conducción a pie Yale MP16 con capacidad nominal declarada de 1.600 kg. La ficha recoge 1.734 mm de longitud, 712 mm de anchura y un peso de 545 kg. El campo de batería y otro de altura contienen valores mezclados y unidades impropias; no se reproducen como capacidad eléctrica ni elevación acreditadas. La configuración de batería debe confirmarse con el proveedor.",
    "short": null
  },
  "2244": {
    "source": "99b7d87ec0cce7b85e4bfc1e553f2e497fdf8b580122a67cf818c97dde56937b",
    "prepared": "e382741e50abf3f75a7bc1bec4690522aeae37d86663ec39e4cc8fda0140a3ac",
    "general": "La Yale MP20 es una transpaleta eléctrica de conducción a pie para transporte de palés, con carga nominal de 2.000 kg. La ficha indica 1.806 mm de longitud, 712 mm de anchura y 632 kg de peso. Algunos campos de batería y altura incluyen datos con unidades incompatibles, por lo que no se asignan como especificaciones fiables. La descripción original menciona también una MP18; esta ficha corresponde a la MP20.",
    "short": null
  },
  "2137": {
    "source": "ff8f7e5b05d55e9ecc6c0fac3144f64b0b0307ca8b5419311b1020d45a3e3277",
    "prepared": "923a2ec09aeb7712db2785461b00e8b753db825b3b424bb0eb53c47ad801a161",
    "general": "Transpaleta eléctrica Hyster P1.8 de 1.800 kg de capacidad nominal, orientada al transporte horizontal y al posicionamiento de palés. Según la ficha, el peso del equipo es de 545 kg y la elevación se indica como 0,13 m. No se especifica una batería ni un rendimiento autónomo verificables para esta referencia; esos parámetros han de comprobarse en la unidad seleccionada.",
    "short": null
  },
  "3140": {
    "source": "ce307882a7902147a788341bf0dab3c641cdadfa6d3f7595757093a8c44ea0cd",
    "prepared": "55bff3f12b3fb6c3f2cb72361e563d2717085884d52c4d3862428f08e65c7b42",
    "general": "La Yale GP40UX es una carretilla elevadora diésel para operaciones de manipulación y apilado, con capacidad nominal de 4.000 kg a 500 mm de centro de carga. La ficha anuncia 4.200 mm de elevación, dimensiones de 4.280 × 1.924 × 2.250 mm y 6.435 kg de peso. Estos valores permiten comprobar el espacio de acceso, la altura de trabajo y las condiciones de carga antes de la operación.",
    "short": null
  },
  "2238": {
    "source": "73c3c25ccf13919d7064deaa06e27977b61296c81fb7e01f8a90f0e44209ad6b",
    "prepared": "7e2db4e5111e3c024242949816ae3e0b382e712a1f1acf687fa724feabc69102",
    "general": "Preparapedidos eléctrico Yale MO20 destinado a desplazamientos internos y preparación de pedidos de almacén, con capacidad nominal de 2.000 kg. La ficha declara 1.410 mm de longitud, 796 mm de anchura y 1.360 mm de altura, además de alimentación de batería de 24 V y 500 Ah. Se publican varios pesos según la configuración, sin identificar uno único como correspondiente a la unidad.",
    "short": null
  },
  "2240": {
    "source": "879fe67281b52f5ad5e682a0a00309bd269b2bb61342f2ed18738498520b532e",
    "prepared": "30f0bfa8eb9a86a461f0be222fda66bf598eb170e2856581672eba5ce00e8ccc",
    "general": "El Yale MO25 es un preparapedidos eléctrico para operaciones de picking y transporte interno de mercancías, con capacidad nominal de 2.500 kg. La ficha indica dimensiones de 3.909 × 796 × 1.878 mm y una batería de 24 V y 620 Ah. Se recogen dos pesos alternativos según configuración, por lo que la masa real y los accesorios instalados deben comprobarse para cada unidad.",
    "short": null
  },
  "2273": {
    "source": "4fc3254ff289042982fb79b79a9cd9f30833bd02c70df683735bf38fa10a4b40",
    "prepared": "7e0448f92de2a5695e1ef7b5c66cf5a3d58cf031fb089f611627bc8ec3cea9c6",
    "general": "Carretilla elevadora eléctrica Yale ERC16VA para transporte y apilado de palés, con capacidad nominal de 1.600 kg y centro de carga de 500 mm. Su ficha indica 5.500 mm de elevación, batería de 48 V y 690 Ah, y dimensiones de 2.908 × 1.090 × 2.180 mm. Declara 3.719 kg de peso y un radio de giro de 1.692 mm, relevantes para evaluar el espacio disponible de maniobra.",
    "short": null
  },
  "2274": {
    "source": "47934ca5b5ce143f95f27c0f2ee7f0dde6681d0c3c234d9fe94dc142f346ddd5",
    "prepared": "b3b8d8f5835bf722be1e8ed17cf471d018d080622590639a25d88694df001fc1",
    "general": "La Yale ERC18VA es una carretilla elevadora eléctrica con capacidad nominal de 1.800 kg a 500 mm de centro de carga. La ficha consigna elevación de 5.500 mm, alimentación de 48 V y 690 Ah, y dimensiones de 2.929 × 1.090 × 2.180 mm. Declara un peso de 3.414 kg y radio de giro de 1.644 mm. Estas cifras permiten contrastar los requisitos del almacén con los datos de la máquina.",
    "short": null
  },
  "2248": {
    "source": "827f11a6a2e1d68645707b9e7fbb97dabe9d73345bb507368b28f9e5c962a035",
    "prepared": "62711a2faddac81e1ee9b0bc04b7c4467b96f159596462077a307a07041bd954",
    "general": "Transpaleta eléctrica de conducción a pie Yale MP20X para desplazamiento de cargas paletizadas. La ficha técnica acredita 2.000 kg de capacidad nominal, longitud de 1.872 mm, anchura de 750 mm, altura de 1.383 mm y peso de 678 kg. Se indica batería de 24 V y 250 Ah; otro campo mezcla referencias de batería y altura, por lo que no se interpreta como elevación de la plataforma. El texto comercial contiene una alusión a la MP16, que no corresponde al modelo de esta ficha.",
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

export const resolveGamHandlingSourceEditorial = (
  record: ProductRecord, short: string | null, general: string | null
): { readonly short: string | null; readonly general: string } | null => {
  const item = record.reference ? evidence[record.reference] : undefined;
  if (record.providerId !== "gam" || !item || !short || !general ||
    sourceDigest(record) !== item.source ||
    digest(JSON.stringify([short, general])) !== item.prepared) return null;
  return { short: item.short ?? short, general: item.general };
};
