import { parseCsv } from "../../../shared/csv-parse.js";

export type ReferenceInventory = { readonly companyID: number; readonly references: ReadonlySet<string> };

export const validText = (input: unknown): input is string => typeof input === "string" && input.trim().length > 0;

export const referenceKey = (value: string): string => value.trim().toLocaleUpperCase("es");

export const readReferenceInventory = (csv: string, companyID: number): ReferenceInventory => {
  const parsed = parseCsv(csv.replace(/^\ufeff/, ""));
  if (!parsed.headers.includes("companyID") || !parsed.headers.includes("reference") ||
    new Set(parsed.headers).size !== parsed.headers.length) {
    throw new Error("El inventario CSV debe incluir las columnas companyID y reference sin duplicados");
  }
  const references = new Set<string>();
  for (const row of parsed.rows) {
    const company = row.companyID?.trim();
    if (!company || !/^\d+$/.test(company) || Number(company) !== companyID) {
      throw new Error("El inventario incluye registros sin companyID válido o de otra empresa");
    }
    if (!validText(row.reference)) throw new Error("El inventario incluye una referencia vacía");
    references.add(referenceKey(row.reference));
  }
  return { companyID, references };
};

