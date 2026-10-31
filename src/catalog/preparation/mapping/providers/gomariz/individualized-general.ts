import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const sourceText: Readonly<Record<string, string>> = {
  generador: "Contamos con grupos electrógenos desde 8 a 200 kvas, monofásicos y trifásicos insonorizados perfectos para proveer de electricidad su domicilio, trabajo o negocio donde no hay suministro regular de compañía de una manera eficiente.",
  "torre-de-luz": "Las torres de iluminación son remolcables y regulables en altura para optimizar el área de iluminación. Tenemos con generador integrado que son energéticamente autosuficientes. Tenemos que funcionan con gasoil y otras que son mixtas baterías y gasoil. Dependiendo de donde vayas a trabajar, solución a medida.",
  rodillo: "El rodillo compactador en tándem tiene doble tambor vibratorio y no lleva neumático de tracción, como sí ocurre con los rodillos lisos de un solo tambor. Este tipo se utiliza generalmente para compactar capas de asfalto sin dejar marcas."
};

const value = (record: ProductRecord, key: string, units: RegExp): string | null => {
  const spec = record.specs?.[key];
  if (typeof spec !== "string") return null;
  const trimmed = spec.trim();
  const match = /^(\d+(?:[.,]\d{1,2})?)\s*(.*)$/u.exec(trimmed);
  return match?.[1] && Number(match[1].replace(",", ".")) > 0 && units.test(match[2] ?? "") ?
    `${match[1].replace(".", ",")} ${match[2]}`.trim() : null;
};

export const resolveGomarizIndividualizedGeneral = (record: ProductRecord): string | null => {
  const title = record.title?.trim();
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  const general = record.longDescription?.trim();
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference || !title || !brand || !general ||
    !normalize(title).includes(normalize(brand)) ||
    (model && !normalize(title).includes(normalize(model)))) return null;

  let family: string;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "www.gomarizrent.com" ||
      path.length !== 4 || path[0] !== "venta" || !normalize(path[3] ?? "").includes(normalize(brand)) ||
      (model ? !normalize(path[3] ?? "").includes(normalize(model)) :
        normalize(title) !== normalize(path[3] ?? ""))) return null;
    family = path[2] ?? "";
  } catch {
    return null;
  }
  const isWrongFamily = family === "generador" && general === sourceText["torre-de-luz"];
  if (!sourceText[family] || (!isWrongFamily && general !== sourceText[family])) return null;
  const length = value(record, "Longitud", /^(?:m|metros)$/iu);
  const width = value(record, "Anchura", /^(?:m|metros)$/iu);
  const height = value(record, "Altura almacenaje", /^(?:m|metros)$/iu) ??
    value(record, "Altura", /^(?:m|metros)$/iu);
  const weight = value(record, "Peso", /^kg$/iu);
  if (!length || !width || !weight) return null;
  const powerSource = record.specs?.Potencia;
  const lightingPower = typeof powerSource === "string" && /^\d{1,2}x\d{2,4}\s*W$/iu.test(powerSource.trim()) ? powerSource.trim() : null;
  const power = value(record, "Potencia", /^kva$/iu) ?? lightingPower;
  const voltage = value(record, "Voltaje", /^v$/iu);
  const motor = record.specs?.Motor;
  if (motor !== undefined && motor !== "Diésel" && motor !== "Eléctrico") return null;
  const stored = height ? ` y una altura indicada de ${height}` : "";
  const technical = `La ficha del ${title} indica una longitud de ${length}, una anchura de ${width}${stored} y un peso de ${weight}.`;
  const engine = motor ? ` La motorización declarada es ${motor.toLowerCase()}.` : "";
  const characteristics = power ? ` La potencia indicada es ${power}.` : voltage ? ` La tensión declarada es ${voltage}.` : "";
  if (family === "generador" && !power && !voltage) return null;
  if (family === "torre-de-luz" && !power) return null;
  if (family === "rodillo" && motor !== "Diésel") return null;
  const specific = `${technical}${engine}${characteristics}`;
  return isWrongFamily ? specific : `${specific}\n\n${general}`;
};
