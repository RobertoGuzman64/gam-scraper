import type { PanelProviderMetrics, PanelTransformationMetrics } from "./types.js";

export type PanelMetricKey = Exclude<keyof PanelProviderMetrics, "transformations"> | keyof PanelTransformationMetrics;

export type PanelMetricDefinition = {
  readonly key: PanelMetricKey;
  readonly label: string;
  readonly source: "publication-manifest" | "commercial-manifest" | "commercial-json" | "technical-report";
  readonly interpretation: string;
};

export const PANEL_METRIC_DEFINITIONS: readonly PanelMetricDefinition[] = [
  { key: "originals", label: "Originales", source: "publication-manifest", interpretation: "Productos en el original del corte técnico acreditado" },
  { key: "published", label: "Publicadas", source: "publication-manifest", interpretation: "Fichas incluidas en la publicación individual vigente" },
  { key: "excludedEditorial", label: "Excluidas editoriales", source: "publication-manifest", interpretation: "Productos no incluidos en la publicación individual; no sumar con exclusiones comerciales" },
  { key: "exported", label: "Exportadas comerciales", source: "commercial-manifest", interpretation: "Productos elegibles presentes en el JSON comercial" },
  { key: "excludedCommercial", label: "Excluidas comerciales", source: "commercial-manifest", interpretation: "Productos publicados técnicos que no entran en la proyección comercial" },
  { key: "categorized", label: "Categorizadas", source: "commercial-manifest", interpretation: "Productos exportados con categoría comercial asignada" },
  { key: "pendingCategory", label: "Sin categoría", source: "commercial-manifest", interpretation: "Productos exportados sin categoría comercial; pendientes para integración" },
  { key: "attributes", label: "Atributos aceptados", source: "commercial-manifest", interpretation: "Atributos comerciales en productos exportados, no claves técnicas nuevas" },
  { key: "withPrice", label: "Con precio", source: "commercial-json", interpretation: "Precio no nulo en productos comerciales; ausencia no equivale a cero" },
  { key: "exceptions", label: "Excepciones", source: "commercial-manifest", interpretation: "Incidencias comerciales registradas para el corte" },
  { key: "repeatedReferences", label: "Coincidencias de referencia", source: "commercial-json", interpretation: "Grupos de referencias comerciales visibles coincidentes; no implica identidad duplicada" },
  { key: "changedProducts", label: "Fichas transformadas", source: "technical-report", interpretation: "Cada ficha cuenta una vez aunque haya varios cambios; diferencia observada" },
  { key: "changedTitles", label: "Títulos modificados", source: "technical-report", interpretation: "Diferencias observadas entre original y publicación" },
  { key: "createdDescriptions", label: "Descripciones creadas", source: "technical-report", interpretation: "Se cuentan separadamente las descripciones corta y general" },
  { key: "modifiedDescriptions", label: "Descripciones modificadas", source: "technical-report", interpretation: "Se cuentan por campo, no por máquina" },
  { key: "addedTechnicalKeys", label: "Claves técnicas incorporadas", source: "technical-report", interpretation: "Nuevas claves tras normalización; no acredita recuperación ni contraste externo" },
  { key: "renamedTechnicalKeys", label: "Claves técnicas renombradas", source: "technical-report", interpretation: "Renombrados observados, distintos de nuevas claves" },
  { key: "formattedTechnicalValues", label: "Valores técnicos formateados", source: "technical-report", interpretation: "Diferencias de formato sin atribuir una regla aplicada" },
  { key: "changedTechnicalValues", label: "Valores técnicos cambiados", source: "technical-report", interpretation: "Diferencias de valor observadas, sin presumir corrección causal" }
];
