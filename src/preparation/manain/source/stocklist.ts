import { buildProductIdentity } from "../../../catalog/identity.js";

export type ManainStocklistSource = {
  readonly archivo: string;
  readonly sha256: string;
  readonly paginas: number;
  readonly tipo: string;
  readonly proveedor: "Manain";
  readonly registros_declarados: number;
};

export type ManainStocklistProduct = {
  readonly referencia: string;
  readonly familia: string;
  readonly marca: string;
  readonly modelo: string;
  readonly anio: number | null;
  readonly horas: number;
  readonly precio_eur: number | null;
  readonly estado: "Usada" | "Nueva";
  readonly observaciones: string | null;
  readonly foto: string;
  readonly url: string;
  readonly pagina_pdf: number;
};

export type ManainStocklist = {
  readonly fuente: ManainStocklistSource;
  readonly productos: readonly ManainStocklistProduct[];
};

const sourceFields = [
  "archivo", "sha256", "paginas", "tipo", "proveedor", "registros_declarados"
] as const;

const productFields = [
  "referencia", "familia", "marca", "modelo", "anio", "horas", "precio_eur", "estado",
  "observaciones", "foto", "url", "pagina_pdf"
] as const;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const exactFields = (value: JsonRecord, fields: readonly string[]): boolean =>
  Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const positiveInteger = (value: unknown): value is number =>
  nonNegativeInteger(value) && value > 0;

const sha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);

const nullableText = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const nullablePrice = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);

const nullableYear = (value: unknown): value is number | null =>
  value === null || positiveInteger(value);

const isSource = (value: unknown): value is ManainStocklistSource =>
  isRecord(value) && exactFields(value, sourceFields) &&
  nonBlank(value.archivo) && /^[^/\\]+\.pdf$/iu.test(value.archivo) &&
  sha256(value.sha256) && positiveInteger(value.paginas) &&
  nonBlank(value.tipo) && value.proveedor === "Manain" &&
  positiveInteger(value.registros_declarados);

const validLink = (value: unknown, reference: string): boolean => {
  if (!nonBlank(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "manain.com" || url.hostname === "www.manain.com") &&
      url.searchParams.getAll("sku").length === 1 && url.searchParams.get("sku") === reference;
  } catch {
    return false;
  }
};

const isProduct = (value: unknown, pages: number): value is ManainStocklistProduct =>
  isRecord(value) && exactFields(value, productFields) &&
  nonBlank(value.referencia) && nonBlank(value.familia) &&
  nonBlank(value.marca) && nonBlank(value.modelo) &&
  nullableYear(value.anio) && nonNegativeInteger(value.horas) &&
  nullablePrice(value.precio_eur) &&
  (value.estado === "Usada" || value.estado === "Nueva") &&
  nullableText(value.observaciones) && nonBlank(value.foto) &&
  positiveInteger(value.pagina_pdf) && value.pagina_pdf <= pages &&
  validLink(value.url, value.referencia);

export const parseManainStocklist = (value: unknown): ManainStocklist => {
  if (!isRecord(value) || !exactFields(value, ["fuente", "productos"]) || !isSource(value.fuente) ||
    !Array.isArray(value.productos)) {
    throw new Error("Stocklist Manain: estructura o procedencia declarada inválida");
  }
  const { fuente, productos } = value;
  if (productos.length !== fuente.registros_declarados) {
    throw new Error("Stocklist Manain: número de filas distinto del declarado por la fuente");
  }
  const identities = new Set<string>();
  const validated: ManainStocklistProduct[] = [];
  for (const [index, entry] of productos.entries()) {
    if (!isProduct(entry, fuente.paginas)) {
      throw new Error(`Stocklist Manain: fila ${index + 1} con datos o enlace inválidos`);
    }
    const identity = buildProductIdentity({
      providerId: "manain", reference: entry.referencia, serialNumber: null, url: entry.url
    }).key;
    if (identities.has(identity)) {
      throw new Error(`Stocklist Manain: referencia duplicada ${entry.referencia}`);
    }
    identities.add(identity);
    validated.push(entry);
  }
  return { fuente, productos: validated };
};
