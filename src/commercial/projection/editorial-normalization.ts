const descriptions: Readonly<Record<string, string>> = {
  AIRE: "aire", ALTURA: "altura", ALUMINIO: "aluminio", APILADOR: "apilador", ARTICULADA: "articulada",
  ARTICULADO: "articulado", AUTÓNOMA: "autónoma", AUTOPROPULSADA: "autopropulsada",
  BAÑO: "baño", CABRIO: "cabrio", CABRIOLET: "cabriolet", CAMION: "camión", CAMIÓN: "camión",
  CARRETILLA: "carretilla", CASETA: "caseta", CESTA: "cesta", COMPACTADOR: "compactador",
  CON: "con", DE: "de", DEL: "del", DIAFANA: "diáfana", DIÁFANA: "diáfana",
  DIESEL: "diésel", DIÉSEL: "diésel", DOBLE: "doble", DUPLEX: "dúplex", DÚPLEX: "dúplex",
  ELECTRICA: "eléctrica", ELÉCTRICA: "eléctrica", ELECTRICO: "eléctrico", ELÉCTRICO: "eléctrico",
  ELEVACION: "elevación", ELEVACIÓN: "elevación", ELEVADORA: "elevadora", ELEVADOR: "elevador",
  EN: "en", FREGADORA: "fregadora", FURGON: "furgón", FURGÓN: "furgón", GASOLINA: "gasolina",
  HIDRAULICA: "hidráulica", HIDRÁULICA: "hidráulica", LA: "la", MANIPULADOR: "manipulador",
  MASTIL: "mástil", MÁSTIL: "mástil", MINIEXCAVADORA: "miniexcavadora", MODULO: "módulo",
  MÓDULO: "módulo", MOVIL: "móvil", MÓVIL: "móvil", ORUGA: "oruga", ORUGAS: "orugas",
  PARA: "para", PIE: "pie", PLATAFORMA: "plataforma", RETRACTIL: "retráctil", RETRÁCTIL: "retráctil",
  RESIDUOS: "residuos", RODILLO: "rodillo", SOBRE: "sobre", TANDEM: "tándem", TÁNDEM: "tándem",
  TELESCOPICA: "telescópica", TELESCÓPICA: "telescópica", TELESCOPICO: "telescópico",
  TELESCÓPICO: "telescópico", TIJERA: "tijera", TRABAJO: "trabajo", TRIPLEX: "tríplex",
  TRÍPLEX: "tríplex", UNIPERSONAL: "unipersonal", UNITARIO: "unitario", VENTA: "venta",
  VERTICAL: "vertical"
};

const removeBranding = (value: string, providerId: string): string => {
  const withoutPrefix = value.replace(/^(?:compra\s+)+/iu, "");
  return providerId === "gam" ? withoutPrefix.replace(/\s*\|\s*GAM Online$/iu, "").trim() : withoutPrefix;
};

const titleCaseStart = (word: string): string => word.charAt(0).toLocaleUpperCase("es") + word.slice(1);

const normalizeUppercaseDescriptions = (value: string): string => {
  const letters = [...value].filter((letter) => /\p{L}/u.test(letter));
  if (letters.length < 5 || letters.filter((letter) => letter === letter.toLocaleUpperCase("es")).length / letters.length < 0.8 ||
    !/(?<![\p{L}\p{N}])(?:PLATAFORMA|CARRETILLA|APILADOR|CAMION|CAMIÓN|MODULO|MÓDULO|RODILLO|ELEVADORA|ELEVADOR|MINIEXCAVADORA|MANIPULADOR|FREGADORA|CASETA|MASTIL|MÁSTIL|ALTURA DE TRABAJO)(?![\p{L}\p{N}])/u.test(value)) {
    return value;
  }
  let firstWord = true;
  return value.replace(/\p{L}+/gu, (word) => {
    const replacement = word === word.toLocaleUpperCase("es") ? descriptions[word] : undefined;
    if (!replacement) return word;
    const normalized = firstWord ? titleCaseStart(replacement) : replacement;
    firstWord = false;
    return normalized;
  });
};

const normalizeUnits = (value: string): string => {
  const meterContext = /\b(?:altura|elevaci[oó]n|alcance|trabajo|plataforma|tijera|articulada|cesta|telesc[oó]pic[oa])\b/iu.test(value);
  return value.replace(/(?<![\p{L}\p{N}/._-])(\d+(?:[.,]\d+)?)[ \t]*(kg|kgs|mts|mt|m)(?![\p{L}\p{N}])/giu,
    (original, quantity: string, unit: string) => {
      const type = unit.toLocaleLowerCase("es");
      if ((type === "mt" || type === "mts") && !meterContext) return original;
      return `${quantity} ${type === "kg" || type === "kgs" ? "kg" : "m"}`;
    });
};

const outsideModel = (value: string, model: string | null, transform: (part: string) => string): string => {
  const identity = model?.trim();
  if (!identity) return transform(value);
  const matcher = new RegExp(identity.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu");
  let index = 0;
  let output = "";
  for (const match of value.matchAll(matcher)) {
    const position = match.index;
    output += transform(value.slice(index, position));
    output += match[0];
    index = position + match[0].length;
  }
  return output + transform(value.slice(index));
};

const editorialText = (value: string, model: string | null): string => {
  const cased = outsideModel(value, model, normalizeUppercaseDescriptions);
  return outsideModel(cased, model, normalizeUnits).replace(/\s+/gu, " ").trim();
};

export const normalizeCommercialTitle = (
  value: string | null, providerId: string, model: string | null
): string | null => {
  const trimmed = value?.replace(/\s+/gu, " ").trim();
  if (!trimmed) return null;
  return editorialText(removeBranding(trimmed, providerId), model) || trimmed;
};

export const normalizeCommercialSummary = (value: string | null, model: string | null): string | null => {
  if (value === null) return null;
  const withoutPromotions = value.replace(/\s*[➨⭐★☆]+\s*/gu, ". ")
    .replace(/^(?:\.\s*)+/gu, "").replace(/(?:\.\s*){2,}/gu, ". ");
  return editorialText(withoutPromotions, model);
};
