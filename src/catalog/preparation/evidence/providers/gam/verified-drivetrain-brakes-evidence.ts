import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { verifiedGamSourceVariant } from "./source-variant-identity.js";

type VerifiedKey = "Freno electromagnético" | "Frenos en baño de aceite" | "Transmisión" | "Desplazamiento lateral" | "Neumáticos" | "Tipo motor";

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
  { reference: "2011", brand: "HYSTER", model: "J1.5XNT", category: "carretillas-nuevas", key: "Tipo motor", value: "Eléctrico de corriente alterna", pattern: /\bmotor de corriente alterna\b/iu }
];

const byReference = new Map(evidence.map((entry) => [entry.reference, entry]));

export const recoverGamVerifiedDrivetrainBrakes = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const entry = byReference.get(record.reference ?? "");
  if (!entry || record.condition !== "Nuevo" || record.brand !== entry.brand ||
    record.model !== entry.model || record.categoryKey !== entry.category ||
    !verifiedGamSourceVariant(record) ||
    Object.keys(source).some((key) => key.toLocaleLowerCase("es") === entry.key.toLocaleLowerCase("es")) ||
    !entry.pattern.test(record.longDescription ?? "")) return source;
  return { ...source, [entry.key]: entry.value };
};
