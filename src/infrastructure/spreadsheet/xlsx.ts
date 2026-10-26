import { createZipArchive } from "../archive/zip.js";

export type CellValue = string | number | boolean | null;

const xml = (value: string): string => value.replace(/[&<>"']/g, (character) => {
  if (character === "&") return "&amp;";
  if (character === "<") return "&lt;";
  if (character === ">") return "&gt;";
  if (character === '"') return "&quot;";
  return "&apos;";
}).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const columnName = (index: number): string => {
  let current = index + 1;
  let result = "";
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }
  return result;
};

const cellXml = (value: CellValue, row: number, column: number): string => {
  if (value === null || value === "") return "";
  const ref = `${columnName(column)}${row}`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Número no finito en ${ref}`);
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if (value.length > 32767) throw new Error(`Texto demasiado largo para Excel en ${ref}`);
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
};

export const createProductsXlsx = (headers: readonly string[], rows: readonly (readonly CellValue[])[]): Buffer => {
  if (headers.length === 0 || headers.length > 16384 || new Set(headers).size !== headers.length) {
    throw new Error("Cabeceras Excel vacías, duplicadas o fuera de límite");
  }
  if (rows.length >= 1048576) throw new Error("El Excel excede el máximo de filas");
  for (const row of rows) if (row.length !== headers.length) throw new Error("La fila no coincide con las columnas Excel");
  const data = [headers, ...rows].map((values, index) => `<row r="${index + 1}">${values.map((value, col) => cellXml(value, index + 1, col)).join("")}</row>`).join("");
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(headers.length - 1)}${rows.length + 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${data}</sheetData></worksheet>`;
  return createZipArchive([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Productos" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", data: worksheet }
  ]);
};
