import type { PublishedWorkReport, PublishedWorkSummary } from "../../catalog/diagnostics/published-work.js";

const textChanges = (work: PublishedWorkSummary): number =>
  work.descriptionsGenerated + work.descriptionsTransformed;

export const formatPublishedWorkTerminal = (report: PublishedWorkReport): readonly string[] => [
  "◆ EQUIPZILLA / TRABAJO PUBLICADO · ORIGINAL → FINAL",
  ...report.providers.map(({ providerId, work }) =>
    `  ${providerId.toUpperCase()} | ${work.publishedProducts} publicadas / ${work.originalProducts} originales` +
    ` | transformadas ${work.transformedProducts} | specs +${work.specificationsAdded}` +
    ` | valores ${work.specificationValuesChanged} | textos ${textChanges(work)} | títulos ${work.titlesTransformed}`),
  `  TOTAL | ${report.total.publishedProducts} publicadas | ${report.total.excludedProducts} excluidas` +
  ` | transformadas ${report.total.transformedProducts} | specs +${report.total.specificationsAdded}` +
  ` | valores ${report.total.specificationValuesChanged} | textos ${textChanges(report.total)}` +
  ` | títulos ${report.total.titlesTransformed}`
];

const totalsRow = (name: string, work: PublishedWorkSummary): string =>
  `| ${name} | ${work.originalProducts} | ${work.publishedProducts} | ${work.excludedProducts} | ${work.transformedProducts} |`;

const specsRow = (name: string, work: PublishedWorkSummary): string =>
  `| ${name} | ${work.specificationsAdded} | ${work.specificationsRenamed} | ${work.specificationValuesFormatted} | ${work.specificationValuesChanged} |`;

const otherRow = (name: string, work: PublishedWorkSummary): string =>
  `| ${name} | ${work.titlesTransformed} | ${work.descriptionsGenerated} | ${work.descriptionsTransformed} | ${work.pricesChanged} | ${work.categoriesChanged} | ${work.conditionsChanged} | ${work.galleriesChanged} |`;

export const renderPublishedWorkMarkdown = (report: PublishedWorkReport): string => [
  "# EQUIPZILLA — Trabajo acumulado publicado",
  "",
  "Comparación entre el original canónico y la publicación individual acreditada. Solo se contabilizan fichas publicadas.",
  "",
  "## Alcance",
  "",
  "| Proveedor | Originales | Publicadas | Excluidas | Fichas transformadas |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...report.providers.map((provider) => totalsRow(provider.providerId.toUpperCase(), provider.work)),
  totalsRow("TOTAL", report.total),
  "",
  "## Especificaciones técnicas",
  "",
  "| Proveedor | Incorporadas | Claves renombradas | Valores formateados | Valores cambiados |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...report.providers.map((provider) => specsRow(provider.providerId.toUpperCase(), provider.work)),
  specsRow("TOTAL", report.total),
  "",
  "## Contenido y datos comerciales",
  "",
  "| Proveedor | Títulos | Descripciones creadas | Descripciones modificadas | Precios | Categorías | Estados | Galerías |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...report.providers.map((provider) => otherRow(provider.providerId.toUpperCase(), provider.work)),
  otherRow("TOTAL", report.total),
  "",
  "## Trazabilidad de origen y publicación",
  "",
  "| Proveedor | Original | Aprobación | JSON comercial |",
  "| --- | --- | --- | --- |",
  ...report.providers.map(({ providerId, sourceSha256, approvalSha256, publicationSha256 }) =>
    `| ${providerId.toUpperCase()} | \`${sourceSha256.slice(0, 12)}\` | \`${approvalSha256.slice(0, 12)}\` | \`${publicationSha256.slice(0, 12)}\` |`),
  "Huellas SHA-256 abreviadas a 12 caracteres para lectura. Los valores completos constan en los originales y manifiestos acreditados.",
  "",
  "## Cómo interpretar las cifras",
  "",
  "- Cada ficha transformada cuenta una vez, aunque acumule varios cambios.",
  "- Especificaciones incorporadas: claves nuevas respecto al original tras normalizar sus nombres.",
  "- La incorporación de una clave no acredita por sí sola una recuperación técnica documentada.",
  "- Renombrados y formateos se separan de cambios reales de valor.",
  "- Las descripciones breves y generales se cuentan por separado; pueden superar el total de máquinas.",
  "- Se ignoran espacios exteriores en textos; precios y estados se comparan normalizados.",
  "- Las galerías se comparan como conjuntos de URL válidas y por su imagen principal.",
  "- Las diferencias observadas no son automáticamente juicios de calidad.",
  ""
].join("\n");
