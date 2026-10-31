import type { ProductRecord } from "../../../../../contracts/catalog.js";

const verified: Readonly<Record<string, {
  readonly brand: string;
  readonly model: string;
  readonly category: string;
  readonly sourceStart: string;
}>> = {
  "217": { brand: "LOGITRANS", model: "MDT", category: "otros-nuevos", sourceStart: "Este volteador tiene una capacidad de carga" },
  "215": { brand: "LOGITRANS", model: "RR S", category: "otros-nuevos", sourceStart: "El volteador multifunción es una herramienta" },
  "216": { brand: "LOGITRANS", model: "RL 500", category: "otros-nuevos", sourceStart: "El elevador de bobinas Logitrans es un complemento" },
  "211": { brand: "LOGITRANS", model: "ELFRA/SELFRA", category: "otros-nuevos", sourceStart: "Este volteador puede inclinar cajones y cajas" },
  "212": { brand: "LOGITRANS", model: "ELFR/SELFR", category: "otros-nuevos", sourceStart: "Este volteador tiene un impacto directo sobre" },
  "213": { brand: "LOGITRANS", model: "ELFR", category: "otros-nuevos", sourceStart: "El volteador multifunción es una herramienta" },
  "234": { brand: "LOGITRANS", model: "Mover", category: "marcas-nuevas", sourceStart: "La batería es uno de los componentes estrella" },
  "239": { brand: "LOGITRANS", model: "LogiQ 200/300", category: "marcas-nuevas", sourceStart: "Las transpaletas para cuartos de palé se emplean" },
  "237": { brand: "LOGITRANS", model: "Panther Flex", category: "marcas-nuevas", sourceStart: "Este tipo de elevadores ofrecen la máxima calidad" },
  "243": { brand: "LOGITRANS", model: "HLI", category: "marcas-nuevas", sourceStart: "La transpaleta tiene el timón, la bomba de pistones" },
  "235": { brand: "LOGITRANS", model: "Panther", category: "marcas-nuevas", sourceStart: "Este tipo de elevadores ofrecen la máxima calidad" },
  "6185": { brand: "CTE", model: "DZ 20 AUTO FIB", category: "elevacion-nueva", sourceStart: "La plataforma sobre camión articulado CTE DZ 20 AUTO" },
  "6188": { brand: "CTE", model: "B-LIFT 20 J AUTO FIB", category: "elevacion-nueva", sourceStart: "La plataforma sobre camión telescópico CTE B-LIFT 20 J AUTO" },
  "4765": { brand: "XCMG", model: "XGA16ACK-Li", category: "elevacion-nueva", sourceStart: "La plataforma elevadora articulada eléctrica XCMG XGA16ACK" },
  "4031": { brand: "Tennant", model: "BCS S20 Batería", category: "limpieza-barredoras", sourceStart: "La Barredora TENNANT BCS S20 a batería" },
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

export const resolveGamModelIdentifiedGeneral = (record: ProductRecord, general: string | null): string | null => {
  const reference = record.reference;
  const evidence = reference && Object.hasOwn(verified, reference) ? verified[reference] : undefined;
  const source = record.longDescription?.trim();
  const title = record.title?.trim();
  const short = record.shortDescription?.trim();
  if (record.providerId !== "gam" || !reference || !evidence || !general || !source || !title || !short ||
    record.brand !== evidence.brand || record.model !== evidence.model || record.categoryKey !== evidence.category ||
    !source.startsWith(evidence.sourceStart) ||
    record.condition !== "Nuevo" ||
    record.specs?.Marca !== evidence.brand || record.specs?.Modelo !== evidence.model ||
    (record.externalReference && normalize(record.externalReference) !== normalize(evidence.model)) ||
    !normalize(title).includes(normalize(evidence.brand)) ||
    !normalize(title).includes(normalize(evidence.model)) ||
    !normalize(short).includes(normalize(evidence.brand)) ||
    !normalize(short).includes(normalize(evidence.model)) ||
    normalize(general).includes(normalize(evidence.model))) return null;

  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      parts.length !== 3 || parts[0] !== "es" || !parts[2]?.startsWith(`${reference}-`) ||
      !normalize(parts[2]).includes(normalize(evidence.model)) || url.search || url.hash) return null;
  } catch {
    return null;
  }

  return `Modelo identificado en la ficha: ${evidence.brand} ${evidence.model}.\n\n${general}`;
};
