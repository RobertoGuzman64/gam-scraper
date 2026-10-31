import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../../../mapping/providers/mercaeleva/technical.js";

const manitouUnits = {
  "M178-6194": { article: "784", hours: "3233" },
  "M205-2951": { article: "786", hours: "3355" },
  "M572-8190": { article: "774", hours: "3018" }
} as const;

const manitouSource = "https://www.manitou.com/es-ES/nuestras-maquinas/plataformas-elevadoras";
const jlgSource = "https://www.jlg.com/en/equipment/boom-lifts/articulating/electric-hybrid/e300-series/e300ajp";
const lgmgSource = "https://www.lgmglifts.com/es/product/pro-detail-2066.htm";

const verifiedIdentity = (
  record: ProductRecord, reference: string, brand: string, model: string, additional: string,
  year: string, article: string, hours: string | null, condition: string, energy: string, height: string,
  original: string
): boolean =>
  validMercaelevaTechnicalSource(record) && record.categoryKey === "venta" &&
  record.reference === reference && record.url ===
    `https://sales.mercaeleva.com/es/for-sale/machine/${brand}-${model}-${reference}` &&
  record.title === `${brand} ${model} ${additional}` &&
  record.brand === brand && record.model === model && record.year === year &&
  record.horometer === (hours === null ? null : `${hours} h`) && record.condition === condition &&
  record.longDescription?.trim() === original && record.specs?.["Marca"] === brand &&
  record.specs?.["Modelo"] === model && record.specs?.["Título adicional"] === additional &&
  record.specs?.["Año de fabricación"] === year && record.specs?.["Artículo No."] === article &&
  record.specs?.["Horas laborales"] === (hours === null ? undefined : `${hours} h`) &&
  record.specs?.["Tipo de motor"] === energy && record.specs?.["Altura de trabajo"] === height &&
  record.specs?.["Estado"] === (condition === "Nuevo" ? "Nuevo" : "Usado");

export const verifiedPriorityPlatformGeneral = (record: ProductRecord): string | null => {
  if (!record.reference || !record.longDescription) return null;
  const manitou = Object.entries(manitouUnits).find(([reference]) => reference === record.reference);
  if (manitou) {
    const [reference, unit] = manitou;
    const original = `Ref. ${unit.article} PLATAFORMA ARTICULADA DIESEL ALTURA DE TRABAJO 18 MT MANTIOU 180ATJ HORAS ${unit.hours} AÑO DE FABRICACION 2017`;
    if (!verifiedIdentity(record, reference, "Manitou", "180ATJ", "PLATAFORMA ARTICULADA DIESEL 18 MT",
      "2017", unit.article, unit.hours, "Segunda mano", "Diesel", "18 m", original)) return null;
    return `La Manitou 180ATJ es una plataforma articulada diésel para trabajos de elevación de personas en obra y mantenimiento exterior. ` +
      `Su brazo articulado permite acercar la cesta a posiciones elevadas y salvar obstáculos, con un alcance de trabajo documentado por el fabricante para este modelo. ` +
      `El anuncio de esta unidad usada indica 18 m de altura de trabajo, fabricación en 2017 y ${Number(unit.hours).toLocaleString("es-ES")} horas registradas. ` +
      `La referencia comercial ${unit.article} identifica esta máquina entre las unidades 180ATJ disponibles.`;
  }
  if (record.reference === "M030-7485") {
    const original = "Ref.429 ELECTRIC ARTICULATED BOOM WORKING HEIGHT 11 MT JLG E300AJP HOURS 2412 YEAR OF MANUFACTURE 2006";
    if (!verifiedIdentity(record, record.reference, "JLG", "E300AJP", "PLATAFORMA ARTICULADA ELECTRICA 11 MT",
      "2006", "429", "2412", "Segunda mano", "Eléctrico", "11 m", original)) return null;
    return "La JLG E300AJP es una plataforma elevadora articulada eléctrica destinada a intervenciones en altura, instalaciones y mantenimiento. " +
      "El fabricante describe un brazo articulado con plumín que ayuda a acceder a zonas difíciles de alcanzar directamente desde el suelo. " +
      "En esta unidad usada, el vendedor anuncia 11 m de altura de trabajo, año de fabricación 2006 y 2.412 horas registradas. " +
      "La motorización eléctrica la diferencia de las plataformas articuladas diésel para trabajos de exterior. " +
      "Está identificada mediante la referencia comercial 429.";
  }
  if (record.reference === "M005-4474") {
    const original = "Ref. S0808EII PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 10 MT LGMG S0808EII HORAS 0 AÑO DE FABRICACION 2026";
    if (!verifiedIdentity(record, record.reference, "LGMG", "S0808EII", "PLATAFORMA TIJERA ELECTRICA 10 MT",
      "2026", "S0808EII", null, "Nuevo", "Eléctrico", "10 m", original)) return null;
    return "La LGMG S0808EII es una plataforma de tijera eléctrica para elevar personal y herramientas en trabajos de mantenimiento, montaje e instalaciones. " +
      "El sistema de elevación vertical facilita tareas sobre una misma zona de trabajo; la documentación del fabricante describe la versión S0808EII con uso previsto en interiores y exteriores, según sus límites de operación. " +
      "Esta unidad se anuncia como nueva, de fabricación 2026, con altura de trabajo comercial indicada de 10 m. " +
      "Su referencia de vendedor es S0808EII; no se atribuye a la unidad una batería opcional.";
  }
  return null;
};

export const priorityPlatformManufacturerSources = [manitouSource, jlgSource, lgmgSource] as const;
