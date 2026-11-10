import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../contracts/catalog.js";

type CommercialShortEvidence = {
  readonly sourceDigest: string;
  readonly short: string;
};

const verified: Readonly<Record<string, CommercialShortEvidence>> = {
  "1218": { sourceDigest: "d546fb2bff048a45fb6dd61a81a946c2e78d921cc3034f7b780769d4caf65358", short: "Grupo electrógeno nuevo PRAMAC GSW1270M. El título comercial anuncia 1.270 kVA; la potencia y configuración del motor deben comprobarse con la documentación técnica del equipo ofertado." },
  "1219": { sourceDigest: "96ffdf4184c3654e1d2e74d36af151c29459b0e550e35cf505d052394e7761ec", short: "Grupo electrógeno nuevo PRAMAC GSW3365M. El título comercial anuncia 3.365 kVA; la potencia y configuración del motor deben comprobarse con la documentación técnica del equipo ofertado." },
  "1022": { sourceDigest: "8c03e406223b847df029e307a92b736c2d3e2ad8e8dc43ed5fccf0957eaaf0c6", short: "Transpaleta eléctrica a pie Hyster PC1.5 nueva, con batería de litio y capacidad de carga declarada de 1.500 kg." },
  "1884": { sourceDigest: "939f25d0c540292c92f889f64e9fb18c139b74aa53e76ecdf4db638a42340faa", short: "Grúa eléctrica Ormig 15iE nueva, con capacidad máxima declarada de 15.000 kg y tracción delantera." },
  "1885": { sourceDigest: "cfa9edac9d617f69e982379693e2cf89b04b77762faeab1f67aa78b1176dee2f", short: "Grúa eléctrica Ormig 35iE nueva, con capacidad máxima declarada de 35.000 kg y tracción delantera." },
  "1886": { sourceDigest: "18c8e697e1c636498d08d7660321808b2af064232bd6dc4f33ed434e2b14f928", short: "Grúa eléctrica Ormig 40iE nueva, con capacidad máxima declarada de 40.000 kg y tracción delantera." },
  "2104": { sourceDigest: "d0e6be137f717c9645ef89a8d9bbc8944f67d6b2ef4bab2b5c452cb8f3d44c37", short: "Apilador eléctrico Hyster S1.2 nuevo, de 1.200 kg de capacidad y altura de elevación publicada de 4,9 m." },
  "2138": { sourceDigest: "cbe7fcee2a2e528add269e33913a6f2c43c3d6cb7cc1a8a80ccb686e09fb11d8", short: "Transpaleta eléctrica Hyster P2.0 nueva para transporte horizontal de palés, con 2.000 kg de capacidad nominal." },
  "2260": { sourceDigest: "53162f9199b01a2fbe79bae9fd79735e47e8a9222ae1b6239951276255dd0220", short: "Apilador eléctrico Yale MS12 IL nuevo, con capacidad nominal de 1.200 kg para manutención y apilado de palés." },
  "2335": { sourceDigest: "d324800eff4ad0575cac5f58aa42e8d0c11edbde9f24a53df2f0d3da5e3f07ca", short: "Apilador eléctrico Yale MS16X nuevo, con capacidad nominal de 1.600 kg para movimiento y apilado de cargas." },
  "4388": { sourceDigest: "a35d4e8452eacd835196a9e1ee84a4e43e07cdc1f5e0fa4ea60bf0c3bb96de53", short: "Apilador eléctrico a pie Hyster SC1.0 nuevo, de 1.000 kg de capacidad y elevación declarada de 1,9 m." },
  "5227": { sourceDigest: "980e478071acfe0c60827f35af658405540dc5c6199c08dd0fc119196b1d0d2c", short: "Carretilla GLP Hyster H2.5FT de segunda mano (2020), con 2.500 kg de capacidad y elevación declarada de 3.290 mm." },
  "6139": { sourceDigest: "6ab9d3dd8dd02813b9c2acac371aa8ea0d0c3042fa5ee0a1d4c63f64dbc124ce", short: "Plataforma articulada diésel JLG 450AJ de segunda mano, con elevación publicada de 16 m y capacidad de cesta de 230 kg." },
  "6391": { sourceDigest: "f68f3deab3601f1757325777a8616ad4973b90e194e86ee25df568fa3edc0dfc", short: "Manipulador telescópico JLG 4013 de segunda mano, con capacidad de 4.000 kg y elevación indicada de 13 m." },
  "6502": { sourceDigest: "0b4d8c5aad71b78b81326383ebf20cddaa22cc60497003051ce9b1e1e26d1432", short: "Manipulador telescópico Magni TH 5,5.15 de segunda mano, con 5.500 kg de capacidad y elevación declarada de 15 m." },
  "6644": { sourceDigest: "1df0aa8ad85978eaa23beb26307f5bac9652c9a75cdf4a63151bf52a7cae6fd5", short: "Carretilla GLP Hyster H1.6FT de segunda mano (2022), con 1.600 kg de capacidad y elevación declarada de 4.900 mm." },
  "6679": { sourceDigest: "1057f4a8e1f5a5c47768ffd13065c64c4c1c14d04887a6b8bc091f722b080d42", short: "Carretilla GLP Hyster H3.5FT de segunda mano (2019), con 3.500 kg de capacidad y elevación declarada de 3.600 mm." },
  "6704": { sourceDigest: "c36f7cea03a33f29c4da09f35b1a6ed024c4a7b33b7bfe827b1384d45d668186", short: "Carretilla GLP Hyster H2.0FT de segunda mano (2020), con 2.000 kg de capacidad y elevación indicada de 4.910 mm." },
  "6846": { sourceDigest: "fed075819d6e7449bd69acba22efee28b97a6c440351feb8cd7537f9083dfd54", short: "Plataforma articulada diésel JLG 510AJ de segunda mano, con elevación indicada de 18 m y capacidad de cesta de 230 kg." },
  "6893": { sourceDigest: "838f85c2ecdb915e4b8c1a59ec77182a1e3b7644831ba89c375648384e6a8070", short: "Manipulador telescópico Haulotte HTL 4014 de segunda mano, con 4.000 kg de capacidad y elevación de 14 m. El anuncio advierte que se ha extraviado la documentación original." },
  "6901": { sourceDigest: "182e22e33d84660c97f77b612b7f7eb142f68b76d1c5e96e5eceadf8d55d9dff", short: "Plataforma articulada diésel Snorkel A46JRT de segunda mano, con elevación declarada de 16 m y capacidad de cesta de 227 kg." },
  "6984": { sourceDigest: "a13747ddb0e22e219c8b4c0116f823a69a2114925b7619212904377833b69b7f", short: "Plataforma articulada diésel Genie Z45/25J de segunda mano, con elevación declarada de 16 m y cesta de hasta 230 kg." },
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

export const resolveGamVerifiedCommercialShort = (record: ProductRecord): string | null => {
  const evidence = record.reference ? verified[record.reference] : undefined;
  if (record.providerId !== "gam" || !evidence || sourceDigest(record) !== evidence.sourceDigest) return null;
  return evidence.short;
};
