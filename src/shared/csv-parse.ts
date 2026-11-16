export type ParsedCsv = {
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
};

export type ParsedCsvRows = {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

const scanCsv = (csv: string, strict: boolean): readonly (readonly string[])[] => {
  const rows: string[][] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  let rowStarted = false;

  const finishField = (): void => {
    cells.push(field);
    field = "";
    afterQuote = false;
  };
  const finishRow = (): void => {
    if (rowStarted || cells.length > 0 || field.length > 0) {
      finishField();
      rows.push(cells);
    }
    cells = [];
    rowStarted = false;
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index] ?? "";
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      if (strict && (field.length > 0 || afterQuote)) throw new Error(`CSV inválido: comillas en posición incorrecta (${index})`);
      quoted = true;
      rowStarted = true;
      continue;
    }
    if (character === ",") {
      finishField();
      rowStarted = true;
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      finishRow();
      continue;
    }
    if (strict && afterQuote) throw new Error(`CSV inválido: texto después de comillas (${index})`);
    field += character;
    rowStarted = true;
  }

  if (quoted && strict) throw new Error("CSV inválido: comillas sin cerrar");
  finishRow();
  return rows;
};

export const parseCsvRowsStrict = (csv: string): ParsedCsvRows => {
  const [headers = [], ...rows] = scanCsv(csv, true);
  for (const [index, row] of rows.entries()) {
    if (row.length !== headers.length) {
      throw new Error(`CSV inválido: fila ${index + 2} con ${row.length} columnas; esperadas ${headers.length}`);
    }
  }
  return { headers, rows };
};

export const parseCsv = (csv: string): ParsedCsv => {
  const [headers = [], ...matrix] = scanCsv(csv, false);
  const rows = matrix.map((cells) => {
    const row: Record<string, string> = {};
    for (const [index, header] of headers.entries()) row[header] = cells[index] ?? "";
    return row;
  });
  return { headers, rows };
};
