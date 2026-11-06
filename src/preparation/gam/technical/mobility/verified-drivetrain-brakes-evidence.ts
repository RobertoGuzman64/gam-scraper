import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "../../identity/evidence/source-variant-identity.js";

type VerifiedKey = "Freno electromagnético" | "Frenos en baño de aceite" | "Transmisión" | "Desplazamiento lateral" | "Neumáticos" | "Tipo motor" | "Frenado automático";

type Evidence = Readonly<{
  reference: string;
  brand: string;
  model: string;
  category: string;
  key: VerifiedKey;
  value: string | boolean;
  pattern: RegExp;
}>;

const electromagnetic = /\bfren[oa] electromagn[eé]tic[oa]\b/iu;
const oilBath = /\bfrenos (?:en )?ba[nñ]o de aceite\b/iu;
const automatic = /\btransmisi[oó]n autom[aá]tica\b/iu;

const evidence: readonly Evidence[] = [
  { reference: "2239", brand: "YALE", model: "MO20P", category: "carretillas-nuevas", key: "Freno electromagnético", value: true, pattern: electromagnetic },
  { reference: "2099", brand: "HYSTER", model: "S1.2E", category: "apiladores-nuevos", key: "Freno electromagnético", value: true, pattern: electromagnetic },
  { reference: "2106", brand: "HYSTER", model: "S1.6", category: "apiladores-nuevos", key: "Freno electromagnético", value: true, pattern: electromagnetic },
  { reference: "2136", brand: "HYSTER", model: "P1.6", category: "marcas-nuevas", key: "Freno electromagnético", value: true, pattern: electromagnetic },
  { reference: "2137", brand: "HYSTER", model: "P1.8", category: "marcas-nuevas", key: "Freno electromagnético", value: true, pattern: electromagnetic },
  { reference: "2140", brand: "HYSTER", model: "P2.0S", category: "marcas-nuevas", key: "Freno electromagnético", value: true, pattern: electromagnetic },
  { reference: "2144", brand: "HYSTER", model: "P2.0UTS", category: "marcas-nuevas", key: "Freno electromagnético", value: true, pattern: electromagnetic },
  { reference: "2090", brand: "HYSTER", model: "H5.5FT", category: "carretillas-nuevas", key: "Frenos en baño de aceite", value: true, pattern: oilBath },
  { reference: "2049", brand: "HYSTER", model: "H32XD-12", category: "carretillas-nuevas", key: "Frenos en baño de aceite", value: true, pattern: oilBath },
  { reference: "2045", brand: "HYSTER", model: "H25XD-9", category: "carretillas-nuevas", key: "Frenos en baño de aceite", value: true, pattern: oilBath },
  { reference: "2044", brand: "HYSTER", model: "H25XD-12", category: "carretillas-nuevas", key: "Frenos en baño de aceite", value: true, pattern: oilBath },
  { reference: "30", brand: "HYSTER", model: "J4.5XN", category: "carretillas-nuevas", key: "Frenos en baño de aceite", value: true, pattern: oilBath },
  { reference: "2065", brand: "HYSTER", model: "H16XD-12", category: "carretillas-nuevas", key: "Transmisión", value: "Automática", pattern: automatic },
  { reference: "2041", brand: "HYSTER", model: "H18XDS-9", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "2046", brand: "HYSTER", model: "H28XD-12", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "2048", brand: "HYSTER", model: "H30XD-9", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "2047", brand: "HYSTER", model: "H30XD-12", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "31", brand: "HYSTER", model: "J5.0XN", category: "carretillas-nuevas", key: "Desplazamiento lateral", value: true, pattern: /\bcuenta con un tablero de Clase IV y desplazamiento lateral\b/iu },
  { reference: "3130", brand: "HYSTER", model: "H2.0AS", category: "carretillas-nuevas", key: "Neumáticos", value: "Superelásticos", pattern: /\bneum[aá]ticos superel[aá]sticos\b/iu },
  { reference: "2011", brand: "HYSTER", model: "J1.5XNT", category: "carretillas-nuevas", key: "Tipo motor", value: "Eléctrico de corriente alterna", pattern: /\bmotor de corriente alterna\b/iu },
  { reference: "6743", brand: "YALE", model: "MO20X", category: "carretillas-nuevas", key: "Freno electromagnético", value: true, pattern: /\bfreno electromagn[eé]tico\b/iu },
  { reference: "6744", brand: "YALE", model: "MO25X", category: "carretillas-nuevas", key: "Freno electromagnético", value: true, pattern: /\bfreno electromagn[eé]tico\b/iu },
  { reference: "1713", brand: "HYSTER", model: "S2.0SD", category: "apiladores-nuevos", key: "Freno electromagnético", value: true, pattern: /\bfreno electromagn[eé]tico\b/iu },
  { reference: "4748", brand: "XCMG", model: "XG1218RT", category: "elevacion-nueva", key: "Neumáticos", value: "Sólidos", pattern: /\bneum[aá]ticos s[oó]lidos\b/iu },
  { reference: "4749", brand: "XCMG", model: "XG1418RT", category: "elevacion-nueva", key: "Neumáticos", value: "Sólidos", pattern: /\bneum[aá]ticos s[oó]lidos\b/iu },
  { reference: "4755", brand: "XCMG", model: "XGA18E", category: "elevacion-nueva", key: "Neumáticos", value: "Sólidos anti-marcado", pattern: /\bneum[aá]ticos s[oó]lidos anti-marcado\b/iu },
  { reference: "4791", brand: "XCMG", model: "XGS50E", category: "elevacion-nueva", key: "Neumáticos", value: "Sólidos", pattern: /\bneum[aá]ticos s[oó]lidos\b/iu },
  { reference: "2042", brand: "HYSTER", model: "H20XD-9", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "2049", brand: "HYSTER", model: "H32XD-12", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "2045", brand: "HYSTER", model: "H25XD-9", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "2044", brand: "HYSTER", model: "H25XD-12", category: "carretillas-nuevas", key: "Transmisión", value: "Automática ZF 5WG211, 5 marchas adelante y 3 atrás", pattern: /\btransmisi[oó]n autom[aá]tica ZF 5WG211\b/iu },
  { reference: "2096", brand: "HYSTER", model: "H8.0FT-9", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales 8.25x15 de doble banda (opciones: radiales, superelásticas o sin huella)", pattern: /\bneum[aá]ticos industriales 8\.25x15 de doble banda, disponibles en versiones radiales, superel[aá]sticas o sin huella\b/iu },
  { reference: "4988", brand: "HYSTER", model: "J2.0XTLG", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran perfil", pattern: /\bneum[aá]ticos industriales de gran perfil\b/iu },
  { reference: "4989", brand: "HYSTER", model: "J2.5XTLG", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran perfil", pattern: /\bneum[aá]ticos industriales de gran perfil\b/iu },
  { reference: "4990", brand: "HYSTER", model: "J3.0XTLG", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran perfil", pattern: /\bneum[aá]ticos industriales de gran perfil\b/iu },
  { reference: "4991", brand: "HYSTER", model: "J3.5XTLG", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran perfil", pattern: /\bneum[aá]ticos industriales de gran perfil\b/iu },
  { reference: "5998", brand: "HYSTER", model: "J4.0XTLG", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran tamaño", pattern: /\bneum[aá]ticos industriales de gran tama[nñ]o\b/iu },
  { reference: "5999", brand: "HYSTER", model: "J4.5XTLG", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran tamaño", pattern: /\bneum[aá]ticos industriales de gran tama[nñ]o\b/iu },
  { reference: "6000", brand: "HYSTER", model: "J5.0XTLG", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran tamaño", pattern: /\bneum[aá]ticos industriales de gran tama[nñ]o\b/iu },
  { reference: "6001", brand: "HYSTER", model: "J5.0XTLGS6", category: "carretillas-nuevas", key: "Neumáticos", value: "Industriales de gran tamaño", pattern: /\bneum[aá]ticos industriales de gran tama[nñ]o\b/iu },
  { reference: "4733", brand: "XCMG", model: "XG0807AC", category: "elevacion-nueva", key: "Frenado automático", value: true, pattern: /\bfrenos de disco autom[aá]ticos\b/iu },
];

const byReference = new Map<string, Evidence[]>();
for (const entry of evidence) {
  const entries = byReference.get(entry.reference) ?? [];
  entries.push(entry);
  byReference.set(entry.reference, entries);
}

export const recoverGamVerifiedDrivetrainBrakes = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entries = byReference.get(record.reference ?? "");
  if (!entries || record.condition !== "Nuevo" || !verifiedGamSourceVariant(record)) return source;
  let result = source;
  for (const entry of entries) {
    if (record.brand !== entry.brand || record.model !== entry.model || record.categoryKey !== entry.category ||
      Object.keys(result).some((key) => key.toLocaleLowerCase("es") === entry.key.toLocaleLowerCase("es")) ||
      !entry.pattern.test(record.longDescription ?? "")) continue;
    result = { ...result, [entry.key]: entry.value };
  }
  return result;
};
