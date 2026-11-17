import type { PanelProviderId, PanelTransformationMetrics } from "./types.js";
import { LEGACY_CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";

export type TechnicalReportProvider = {
  readonly providerId: PanelProviderId;
  readonly originalShaPrefix: string;
  readonly approvalShaPrefix: string;
  readonly publicationShaPrefix: string;
  readonly originals: number;
  readonly published: number;
  readonly excludedEditorial: number;
  readonly transformations: PanelTransformationMetrics;
};

const section = (content: string, name: string): string => {
  const heading = `## ${name}\n`;
  const start = content.indexOf(heading);
  if (start < 0 || content.indexOf(heading, start + heading.length) >= 0) {
    throw new Error(`Informe técnico sin sección única: ${name}`);
  }
  const body = content.slice(start + heading.length);
  const end = body.indexOf("\n## ");
  return end < 0 ? body : body.slice(0, end);
};

const table = (body: string): readonly (readonly string[])[] => {
  const lines = body.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  if (lines.length < 3 || !/^\|\s*:?-+:?/.test(lines[1] ?? "")) {
    throw new Error("Tabla del informe técnico incompleta");
  }
  return lines.slice(2).map((line) => line.split("|").slice(1, -1).map((value) => value.trim()));
};

const number = (value: string | undefined): number => {
  if (value === undefined || !/^\d+$/.test(value)) throw new Error(`Métrica técnica inválida: ${String(value)}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Métrica técnica fuera de rango: ${value}`);
  return parsed;
};

const rows = (content: string, name: string, length: number): ReadonlyMap<string, readonly string[]> => {
  const result = new Map<string, readonly string[]>();
  for (const cells of table(section(content, name))) {
    if (cells.length !== length || !cells[0] || result.has(cells[0])) {
      throw new Error(`Filas inválidas en el informe técnico: ${name}`);
    }
    result.set(cells[0], cells);
  }
  if (result.size !== LEGACY_CAMPAIGN_PROVIDERS.length + 1 || !result.has("TOTAL") ||
    LEGACY_CAMPAIGN_PROVIDERS.some((providerId) => !result.has(providerId.toUpperCase()))) {
    throw new Error(`Proveedores incompletos en el informe técnico: ${name}`);
  }
  for (let column = 1; column < length; column += 1) {
    const sum = LEGACY_CAMPAIGN_PROVIDERS.reduce((total, providerId) =>
      total + number(result.get(providerId.toUpperCase())?.[column]), 0);
    if (sum !== number(result.get("TOTAL")?.[column])) {
      throw new Error(`Total discordante en informe técnico: ${name}, columna ${column}`);
    }
  }
  return result;
};

const cell = (values: ReadonlyMap<string, readonly string[]>, providerId: string, index: number): number =>
  number(values.get(providerId.toUpperCase())?.[index]);

export const parseTechnicalReport = (content: string): readonly TechnicalReportProvider[] => {
  const scope = rows(content, "Alcance", 5);
  const technical = rows(content, "Especificaciones técnicas", 5);
  const editorial = rows(content, "Contenido y datos comerciales", 8);
  const lineage = new Map<string, readonly string[]>();
  for (const fields of table(section(content, "Trazabilidad de origen y publicación"))) {
    if (fields.length !== 4 || !fields[0] || lineage.has(fields[0])) {
      throw new Error("Trazabilidad técnica inválida");
    }
    lineage.set(fields[0], fields);
  }
  if (lineage.size !== LEGACY_CAMPAIGN_PROVIDERS.length) {
    throw new Error("Trazabilidad técnica incompleta");
  }
  return LEGACY_CAMPAIGN_PROVIDERS.map((providerId) => {
    const fingerprints = lineage.get(providerId.toUpperCase());
    if (!fingerprints || fingerprints.slice(1).some((value) => !/^`[a-f0-9]{12}`$/.test(value))) {
      throw new Error(`Huellas técnicas inválidas: ${providerId}`);
    }
    const [original, approval, published] = fingerprints.slice(1).map((value) => value.slice(1, -1));
    if (!original || !approval || !published) throw new Error(`Trazabilidad incompleta: ${providerId}`);
    return {
      providerId,
      originalShaPrefix: original,
      approvalShaPrefix: approval,
      publicationShaPrefix: published,
      originals: cell(scope, providerId, 1),
      published: cell(scope, providerId, 2),
      excludedEditorial: cell(scope, providerId, 3),
      transformations: {
        changedProducts: cell(scope, providerId, 4),
        changedTitles: cell(editorial, providerId, 1),
        createdDescriptions: cell(editorial, providerId, 2),
        modifiedDescriptions: cell(editorial, providerId, 3),
        addedTechnicalKeys: cell(technical, providerId, 1),
        renamedTechnicalKeys: cell(technical, providerId, 2),
        formattedTechnicalValues: cell(technical, providerId, 3),
        changedTechnicalValues: cell(technical, providerId, 4)
      }
    };
  });
};
