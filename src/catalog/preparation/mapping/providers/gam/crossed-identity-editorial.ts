import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";

type VerifiedEditorial = {
  readonly sourceDigest: string;
  readonly short: string;
  readonly general?: string;
};

const verified: Readonly<Record<string, VerifiedEditorial>> = {
  "6650": { sourceDigest: "7510b42acc11c4c1939db36d267f9438ce56eb38f2d08f0c7850ad950b701fdc", short: "Plataforma articulada eléctrica JLG E300AJP de segunda mano, con altura de elevación declarada de 11 metros y capacidad de cesta de 230 kg." },
  "5730": { sourceDigest: "4e8168b9ea6099ec977d8d5517ad9d2ce42706b0bcaa1ba6f97db8f238a00b8c", short: "Plataforma articulada eléctrica JLG E300AJP de segunda mano, con altura de elevación declarada de 11 metros y capacidad de cesta de 230 kg." },
  "6998": { sourceDigest: "7976c0aceb003285742641672ea9273250b7008dd2641a0c528e591d97c47601", short: "Plataforma articulada eléctrica JLG E300AJP de segunda mano, con altura de elevación declarada de 11 metros y capacidad de cesta de 230 kg." },
  "6849": { sourceDigest: "a9ea32e077ee6c2d4ac8f9626c08c03608314df8dd1b0da26eb52e6d747e197d", short: "Carretilla elevadora eléctrica Yale ERP16VT MWB de segunda mano, con capacidad de carga de 1.600 kg y altura de elevación de 5.500 mm declaradas en la ficha." },
  "6915": { sourceDigest: "a3665035cbf3877851588d06e822e99d915e0747c766d4658067115c6c19f1fb", short: "Carretilla elevadora diésel MORA M160C de segunda mano, con capacidad de carga de 16.000 kg y altura de elevación de 4.000 mm según la ficha de esta unidad." },
  "6857": { sourceDigest: "f5893c4237c08b79e0ef6cb08eec89888f4305e1bf9ea9378d961da7b918cb49", short: "Manipulador telescópico JLG 3512 de segunda mano, anunciado con capacidad de carga de 3.500 kg y altura de elevación de 11,5 metros. El texto del proveedor advierte que el equipo carece de placa identificativa." },
  "6164": { sourceDigest: "4ce42a5dec47c9b83df835efd7a3dc593261cff8a79c63fba4e6fc1ac352a6e2", short: "Plataforma telescópica sobre camión CTE B-LIFT 18 AUTO, con altura de elevación declarada de 17,7 metros y capacidad de cesta de 230 kg." },
  "1894": { sourceDigest: "879714d63127a686de45b375f10c1bceb6b3d208a2d60dd2ee452a018a580af8", short: "Tractor eléctrico de arrastre Tecnacar VTA 450, con una capacidad de carga declarada de 50.000 kg y un tiro nominal a la barra de 9.000 N según la ficha." },
  "4023": { sourceDigest: "abb5035fc045cbeb018bd377bb7b92b7ee65f56f6f227dec98fb627e2ba23f78", short: "Barredora a batería Tennant BCA S7, con una anchura de trabajo de 0,7 metros declarada en la ficha técnica." },
  "2242": { sourceDigest: "9054585e02dd956345200b5013bbf812435bcd78b3c8efe019e73e7254eabe99", short: "Transpaleta eléctrica a pie Yale MP16, con capacidad de carga de 1.600 kg y motorización eléctrica según la ficha técnica." },
  "1936": { sourceDigest: "d48cb162b5d457059ebea2288cd28640a593d42086ed66c53931f59e5a0e4340", short: "Tractor eléctrico de carga Tecnacar VCA 430, con capacidad de carga de 1.500 kg y tiro nominal a la barra de 4.000 N declarados en la ficha técnica." },
  "3442": { sourceDigest: "2549774fbaf1c045e384b75e10a6b9266f1a0d1f7b06234901747b4b953fe18b", short: "Minicargadora eléctrica First Green ELISE 700, con capacidad de carga de 700 kg, peso declarado de 2.800 kg y altura de elevación de 3,6 metros." },
  "5949": { sourceDigest: "7d2b022670d4cfb68ea0bfb06a1ca3d297da982e467efb13b401ee74f352ea6f", short: "Bicicleta eléctrica Littium Ibiza Titanium de segunda mano, anunciada con 955 km y ubicación en Madrid según la ficha de esta unidad.", general: "La ficha del proveedor identifica una bicicleta eléctrica Littium Ibiza Titanium de segunda mano, ubicada en Madrid y con 955 km registrados. Las especificaciones del motor, la batería y la autonomía no se atribuyen a esta unidad porque la descripción comercial de origen no identifica de manera inequívoca esta variante." },
  "2305": { sourceDigest: "f666b434eaa05fdf7a9354bdb00b83086585a5a6b4c37a589a0d6b6acd08bf6a", short: "Carretilla para pasillos estrechos Hyster C1.5L, con capacidad de carga de 1.500 kg y altura de elevación declarada de 16.900 mm.", general: "La Hyster C1.5L es una carretilla para pasillos estrechos. Su ficha técnica declara 1.500 kg de capacidad de carga, 16.900 mm de altura de elevación, 7.921 kg de peso y batería indicada como 80 V / 840 Ah. Las dimensiones y condiciones de uso deben comprobarse según la configuración de la unidad." },
  "4029": { sourceDigest: "d51c84aef6bf538967f1762ec2934807f3fd2db4aed6773c36b9db786dad3a8e", short: "Barredora Tennant BCS S16H con descarga alta, identificada por la ficha técnica y el título del proveedor.", general: "La ficha identifica una barredora Tennant BCS S16H con sistema de descarga alta. No figuran medidas ni rendimientos específicos de esta variante en las especificaciones técnicas del anuncio, por lo que es necesario confirmar esos datos en la documentación del equipo." },
  "2794": { sourceDigest: "3d4d39fd8b540c760e64593776b9421d8097f6714c184b4af36fcc06e391bb42", short: "Transpaleta eléctrica Hyster PC1.5 DOBLE BATERÍA, con capacidad de carga de 1.500 kg declarada en la ficha." },
  "2795": { sourceDigest: "2bd1f79d55e455fb3a968ec99113294402fdccf6d6baa3f1d74d560380a9cc7b", short: "Transpaleta eléctrica Hyster PC1.5 ANCHO FRUTERO, con capacidad de carga de 1.500 kg y altura de elevación de 115 mm según la ficha." },
  "2796": { sourceDigest: "3b4dffe613fb06368981666fb1bc1dbf9e8c84eb028f8ba3722109efe49c22a9", short: "Transpaleta eléctrica a pie Yale MPC15 DOBLE BATERÍA, con capacidad de carga de 1.500 kg publicada en la ficha." },
  "2797": { sourceDigest: "804e1fb558513167a31b9ef680e21d492f7d4ad4f9837fdb3d512a1240b3af20", short: "Transpaleta eléctrica a pie Yale MPC15 ANCHO FRUTERO, con capacidad de carga de 1.500 kg publicada en la ficha." },
  "1144": { sourceDigest: "4b17d718ab516dd043a80361cb1529884e5ee7bf69f727677dd0824f07119d86", short: "Transpaleta compacta Yale MPC15, con capacidad de carga de 1.500 kg y altura de elevación declarada de 0,115 metros." },
  "6666": { sourceDigest: "b29aee912d358c9b6c9c782603000cff79a4fb9c320087b4f4fed5bfd99e22f3", short: "Carretilla GLP Hyster de ocasión, 4.500 kg y 4.800 mm de elevación. Modelo discrepante entre título y ficha técnica: pendiente de confirmar." },
  "5258": { sourceDigest: "1fd68ad81cfad731b39308debcce252798ef58c140b8d5ad10812c19f672fcd8", short: "Carretilla GLP Hyster de ocasión, 4.500 kg, mástil tríplex y 4.145 mm de elevación. Variante del modelo pendiente de confirmar." },
  "6863": { sourceDigest: "57802f8c8e4f1ff4d9f87a520c853319ce444447a55a5d2918251c523aed4cfb", short: "Carretilla eléctrica Yale usada, 1.600 kg y 5.500 mm de elevación. El modelo difiere entre título y ficha técnica." },
  "6865": { sourceDigest: "c72d345dc5647ba767633562227aab6b6d2ebff32084293c2fd8a6b1ad4e0192", short: "Carretilla eléctrica Unicarriers G1Q2L30Q de segunda mano, 3.000 kg y 4.750 mm de elevación." },
  "6852": { sourceDigest: "7ea3e2749f4e92baef7022bfe85d92876e3c42e9d23097359267ea625bf5ab46", short: "Apilador eléctrico S1.2 usado, con 1.200 kg y 3.690 mm de elevación; marca contradictoria entre título y ficha técnica." },
  "6103": { sourceDigest: "da894d640b20ef483abb6f3fdb3d3d6dbb705fea92cf9bd41899221a61b87f3f", short: "Transpaleta eléctrica P2.5S de ocasión, 2.500 kg; marca pendiente de confirmar por discrepancia entre título y ficha." },
  "6584": { sourceDigest: "9f4aade275cd5828578db5f7ec2518955eff450464188bab42bebbae1a91d5f7", short: "Carretilla trilateral eléctrica Yale MTC13MWB de ocasión, 1.300 kg de capacidad y 8.240 mm de elevación declarada." }
};

const sourceDigest = (record: ProductRecord): string => createHash("sha256")
  .update(JSON.stringify({
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
  })).digest("hex");

export const resolveGamCrossedIdentityEditorial = (record: ProductRecord): {
  readonly short: string;
  readonly general: string | null;
} | null => {
  const match = record.reference ? verified[record.reference] : undefined;
  if (record.providerId !== "gam" || !match || sourceDigest(record) !== match.sourceDigest) return null;
  return { short: match.short, general: match.general ?? null };
};
