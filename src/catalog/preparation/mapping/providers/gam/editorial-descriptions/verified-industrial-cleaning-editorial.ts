import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";

type CleaningEditorialEvidence = {
  readonly sourceDigest: string;
  readonly preparedDigest: string;
  readonly general: string;
  readonly originalPreparedShort?: string;
  readonly revisedShort?: string;
};

const evidence: Readonly<Record<string, CleaningEditorialEvidence>> = {
  "4031": {
    sourceDigest: "fe5d2085743b67f19fa4143468614aae8457f2af53ffaf474af3e34fcb67076a",
    preparedDigest: "1953956847d48d3f666882cecc2671fcaeddc489875491cbd1928b2995688fe7",
    general: "La barredora Tennant BCS S20 Batería es un equipo de conductor sentado para recoger residuos secos en superficies industriales. El proveedor indica 1.270 mm de anchura de barrido con un cepillo lateral y hasta 1.570 mm con dos cepillos; no son una única configuración. La fuente anuncia filtración del 99 % para partículas de 0,5 micras. Incorpora una tolva de 310 litros, control de polvo SweepMax y limpieza del filtro ShakeMax 360. La alimentación por batería permite trabajar sin emisiones directas de escape. Para planificar su uso conviene confirmar el número de cepillos, la autonomía de la batería y las condiciones de vaciado de la tolva.",
    originalPreparedShort: "➨ TENNANT BCS S20 Batería Nueva ➨ Venta de barredora industrial",
    revisedShort: "Barredora a batería Tennant BCS S20 de conductor sentado, con tolva anunciada de 310 litros.",
  },
  "4018": {
    sourceDigest: "558a4c77bbff6405abef018a562b66af027e5f4f11d3a475b4a61cfc383b5516",
    preparedDigest: "9e4d2f6df00a94501e42b8ab569901ba775bbb45f8fd94fddb355285ad77ef58",
    general: "La fregadora industrial Tennant FCS T20 C es un equipo de operario sentado destinado al mantenimiento de suelos en instalaciones de gran superficie. La descripción original distingue cabezales cilíndricos y de disco, con velocidades de cepillo anunciadas de 480 y 230 rpm respectivamente; estas prestaciones no deben sumarse como si fueran una misma configuración. Cita una anchura de fregado de hasta 1370 mm con accesorio lateral, un depósito de solución de 303 litros, recuperación de 360 litros y una bandeja de residuos de 31 litros. El texto contempla motorizaciones de combustión sin identificar de forma inequívoca el combustible de esta unidad. Deben verificarse cabezal, anchura equipada y requisitos de ventilación antes del uso.",
    originalPreparedShort: "La fregadora TENNANT FCS T20 C es una potente máquina de operador sentado diseñada para tareas de limpieza intensiva en entornos industriales y comerciales.",
    revisedShort: "Fregadora Tennant FCS T20 C de conductor sentado, con cabezales de fregado alternativos.",
  },
  "4021": {
    sourceDigest: "1b3d61957b04552a83b68629bff5073e51c3f31c6fc66d3f290250f910c98044",
    preparedDigest: "743ee9ce3ead9463b986b78759ae7ef03347fb60312d3fcf6ab2708c7cd784a8",
    general: "La Tennant BF M20 combina barrido y fregado en un equipo industrial de conductor sentado. La ficha comercial anuncia rendimientos teóricos de hasta 17.560 m²/h al barrer y 8.190 m²/h al fregar, sujetos a las condiciones de circulación y suciedad. Declara un cepillo principal de 1.020 mm, laterales de 410 mm para fregado y 530 mm para barrido, tolva de 110 litros, depósito de solución de hasta 530 litros y recuperación de 276 litros. El texto cita variantes de motorización de gasolina, GLP o diésel, sin acreditar cuál equipa esta referencia. Es necesario comprobar el combustible, el ancho efectivo y las condiciones de ventilación de la instalación.",
    originalPreparedShort: "La barredora fregadora TENNANT BF M20 es una máquina de conductor sentado diseñada para la limpieza eficiente de grandes superficies tanto en interiores como en exteriores.",
    revisedShort: "Barredora-fregadora Tennant BF M20 de conductor sentado para limpieza combinada industrial.",
  },
  "4023": {
    sourceDigest: "abb5035fc045cbeb018bd377bb7b92b7ee65f56f6f227dec98fb627e2ba23f78",
    preparedDigest: "1ffee526d8baa63e87dc8d97f37956a95a89dd9f92ab06d5cec13ded929a75e9",
    general: "La Tennant BCA S7 es una barredora a batería de conductor acompañante para recoger polvo y residuos en superficies duras y, según el proveedor, determinadas alfombras. La ficha técnica indica una anchura de trabajo de 0,7 m. El texto comercial describe una tolva de 45 litros, cepillo principal y lateral, filtro autolimpiante y sistema alzaflap para residuos de mayor tamaño. También anuncia batería de gel de 12 V y 105 Ah, autonomía de hasta tres horas y sonoridad de 70 dBA; la autonomía efectiva dependerá del estado de la batería y las condiciones de limpieza. ",
  },
  "3999": {
    sourceDigest: "2d15b66b55e6dbb6e2a3b82d4a95632e2d24d7ad7bd76f8a6318fe731947d76f",
    preparedDigest: "86d8fba47b3b030bff2f55192926f681d0defe4b20cc68bdd516607286b5eed8",
    general: "La fregadora Tennant FCA T291 Tracción es un equipo de conductor acompañante para limpiar suelos duros en comercios, almacenes y otras áreas interiores. La ficha técnica identifica una anchura de trabajo de 0,55 m, una velocidad de cepillo de 150 rpm y un peso de 150 kg para esta referencia. La descripción del proveedor cita depósitos de solución y recuperación de 50 litros y un nivel sonoro de 56 dBA. La productividad teórica de hasta 2.468 m²/h se refiere a la versión autopropulsada. Expone autonomías de 2,5 y 3,5 horas para configuraciones distintas de tracción asistida y autopropulsión; no corresponde asignar ambas a esta unidad. Antes de organizar los recorridos deben comprobarse batería y modo de tracción equipado.",
    originalPreparedShort: "➨ TENNANT FCA T291 Tracción Nueva ➨ Venta de fregadora industrial",
    revisedShort: "Fregadora Tennant FCA T291 Tracción de conductor acompañante, con 0,55 m de trabajo.",
  },
  "4026": {
    sourceDigest: "7de18dc3644963c76a5ef9070c32c3529f8a94c8b10283263ef5b7931e9d485c",
    preparedDigest: "20e18404b08d88d04481aac32d2b06a641d2a979241e780f9608119b480f5bb6",
    general: "La barredora Tennant BCS S780 es una máquina a batería de conductor sentado para recoger polvo y residuos en almacenes, aparcamientos y zonas industriales pavimentadas. La descripción del proveedor detalla un cepillo principal de 680 mm y uno lateral de 520 mm, con una trayectoria combinada anunciada de hasta 1.200 mm y productividad teórica de hasta 7.440 m²/h. Cuenta con tolva de 67 litros y vaciado manual, junto con filtro de panel para el control de polvo seco. El tiempo de funcionamiento publicado llega a 180 minutos en las condiciones descritas por el proveedor, sin garantizar esa duración en cualquier entorno. Para seleccionarla deben verificarse el ancho de paso, la autonomía de la batería y las necesidades de vaciado.",
    originalPreparedShort: "La barredora TENNANT BCS S780 es una solución de limpieza avanzada para grandes superficies, diseñada para maximizar la eficiencia en entornos industriales y comerciales.",
    revisedShort: "Barredora a batería Tennant BCS S780 de conductor sentado, con tolva de 67 litros.",
  },
  "171": {
    sourceDigest: "ce1f8cf73d9682f537be5dd5c61043b350133393160f4da25767a390b615afdb",
    preparedDigest: "da720a4d779d788481a2f5493cf36be59b3f4b7a100763b62b1c645c72c542de",
    general: "La fregadora Tennant T16 es un equipo a batería de operario sentado para limpieza de mantenimiento en grandes instalaciones. La ficha técnica del anuncio indica una longitud de 1.815 mm y un peso de 880 kg. El texto del proveedor declara un nivel sonoro de 68 dBA y destaca el uso en zonas donde interesa limitar las molestias acústicas. Las afirmaciones comerciales sobre ahorro de costes o superioridad frente a otros equipos no permiten acreditar un rendimiento concreto. Para planificar su utilización deben comprobarse el ancho del cabezal, el tipo de batería, los depósitos y la configuración efectiva de la unidad.",
    originalPreparedShort: "➨ Tennant T16 Nueva ➨ Venta fregadora conductor sentado",
    revisedShort: "Fregadora a batería Tennant T16 de conductor sentado; peso declarado de 880 kg.",
  },
  "4040": {
    sourceDigest: "a4a0750dbf00c8f11d326d1ac9c90c98e01e9553ac39e431196c4303ae3d86b3",
    preparedDigest: "1d6151af89dfe1c35f82288ee4cb0053555d1542bdf70d284991b16c820309b3",
    general: "La aspiradora Tennant APL V-WD-72 está destinada a recoger polvo y líquidos en tareas de mantenimiento de instalaciones. El texto original identifica un peso de 23,4 kg y un nivel sonoro anunciado de 76 dBA. La descripción del proveedor está truncada y no permite acreditar en esta ficha la potencia, la capacidad de los depósitos o la longitud del cable. Esas características deben consultarse en la documentación técnica correspondiente antes de seleccionar el equipo.",
    originalPreparedShort: "La aspiradora TENNANT APL V-WD-72 es una potente y versátil máquina diseñada para la recolección de polvo y líquidos en entornos industriales y comerciales.",
    revisedShort: "Aspiradora Tennant APL V-WD-72 para polvo y líquidos, con peso anunciado de 23,4 kg.",
  },
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

const verified = (record: ProductRecord): CleaningEditorialEvidence | null => {
  const entry = record.reference ? evidence[record.reference] : undefined;
  return record.providerId === "gam" && entry && sourceDigest(record) === entry.sourceDigest ? entry : null;
};

export const resolveGamVerifiedIndustrialCleaningGeneral = (record: ProductRecord, current: string | null): string | null => {
  const entry = verified(record);
  return entry && current && digest(current) === entry.preparedDigest ? entry.general : null;
};

export const resolveGamVerifiedIndustrialCleaningShort = (record: ProductRecord, current: string | null): string | null => {
  const entry = verified(record);
  return entry?.originalPreparedShort === current ? entry?.revisedShort ?? null : null;
};
