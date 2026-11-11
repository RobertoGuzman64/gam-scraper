import type { CommercialPackageSnapshot } from "../../commercial/export/commercial-package-snapshot.js";

const declaredFields = ["reference", "categorySellID",
  "attributes", "price", "companyID", "logoID", "image", "images", "metadata"] as const;

const fieldNotes: Readonly<Record<(typeof declaredFields)[number], string>> = {
  reference: "referencia estable de la unidad en su proveedor",
  categorySellID: "identificador de categoría comercial propuesto",
  attributes: "identificadores y valores de atributos comerciales aceptados",
  price: "precio exportado; null no equivale a cero",
  companyID: "empresa del entorno declarado, cuando está disponible",
  logoID: "identificador del logo acreditado o de Otras Marcas",
  image: "imagen principal exportada",
  images: "galería exportada",
  metadata: "metadatos comerciales del producto"
};

export const renderCommercialIntegrationReport = (snapshot: CommercialPackageSnapshot, day: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day) || new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) !== day) {
    throw new Error("Fecha comercial inválida");
  }
  const totals = snapshot.providers.reduce((acc, provider) => ({
    source: acc.source + provider.sourceProducts,
    exported: acc.exported + provider.summary.exported,
    categorized: acc.categorized + provider.summary.categorized,
    pending: acc.pending + provider.summary.pendingCategory,
    attributes: acc.attributes + provider.summary.attributes,
    exclusions: acc.exclusions + provider.excluded,
    exceptions: acc.exceptions + provider.exceptions,
    prices: acc.prices + provider.summary.withPrice,
    logos: acc.logos + provider.summary.withLogo,
    companies: acc.companies + provider.summary.withCompany,
    repeated: acc.repeated + provider.repeatedReferences
  }), { source: 0, exported: 0, categorized: 0, pending: 0, attributes: 0, exclusions: 0,
    exceptions: 0, prices: 0, logos: 0, companies: 0, repeated: 0 });
  const lines = [
    "# EQUIPZILLA — Informe comercial de integración",
    "",
    `- Fecha del paquete (UTC): ${day}`,
    `- Huella comercial: ${snapshot.manifestSha256}`,
    `- Entorno: ${snapshot.environment ?? "sin companyID"}`,
    `- Proveedores: ${snapshot.providers.map((provider) => provider.providerId.toUpperCase()).join(", ")}`,
    "- Integración en base de datos: NO VERIFICADO EN BD",
    "",
    "## Resumen del corte",
    "",
    `- Fichas técnicas incluidas en las publicaciones: ${totals.source}; elegibles: ${totals.exported}; excluidas: ${totals.exclusions}.`,
    `- Categorizadas: ${totals.categorized}; pendientes de categoría: ${totals.pending}.`,
    `- Atributos aceptados: ${totals.attributes}; con precio: ${totals.prices}; con logo: ${totals.logos}; con companyID: ${totals.companies}.`,
    `- Excepciones registradas: ${totals.exceptions}; grupos de referencias visibles coincidentes entre productos exportados: ${totals.repeated}.`,
    "- El recuento de origen corresponde a las fichas de la publicación técnica incluida; no acredita el total del catálogo original del proveedor.",
    "",
    "## Archivos y trazabilidad por proveedor",
    ""
  ];
  for (const provider of snapshot.providers) {
    const summary = provider.summary;
    lines.push(
      `### ${provider.providerId.toUpperCase()} — ${provider.file}`,
      "",
      `- Publicación técnica SHA256: ${provider.publicationSha256}`,
      `- JSON SHA256: ${provider.sha256}; bytes UTF-8: ${provider.bytes}.`,
      `- Técnicas incluidas: ${provider.sourceProducts}; exportadas: ${summary.exported}; categorizadas: ${summary.categorized}; pendientes: ${summary.pendingCategory}.`,
      `- Exclusiones: ${provider.excluded} (lotes ${summary.excludedLots}, herramientas ${summary.excludedTools}, accesorios ${summary.excludedAccessories}).`,
      `- Atributos aceptados: ${summary.attributes}; con precio: ${summary.withPrice}; con logo: ${summary.withLogo}; con companyID: ${summary.withCompany}.`,
      `- Excepciones: ${provider.exceptions}; grupos de referencias visibles coincidentes: ${provider.repeatedReferences}.`,
      `- Campos comerciales presentes: ${declaredFields.filter((field) => provider.fields.includes(field)).join(", ")}.`,
      ""
    );
    if (provider.exceptionReasons.length > 0) {
      lines.push("Señales y excepciones documentadas:");
      for (const issue of provider.exceptionReasons) lines.push(`- ${issue.reason}: ${issue.count}`);
      lines.push("");
    }
  }
  const usedFields = new Set(snapshot.providers.flatMap((provider) => provider.fields));
  lines.push("## Mapa de campos para la integración", "");
  for (const field of declaredFields) {
    if (usedFields.has(field)) lines.push(`- \`${field}\`: ${fieldNotes[field]}.`);
  }
  lines.push(
    "",
    "## Comprobaciones pendientes en el destino",
    "",
    "- NO VERIFICADO EN BD: validar correspondencia de categorySellID y attributeID con la taxonomía, relaciones, tipos y opciones reales del importador.",
    "- NO VERIFICADO EN BD: comprobar companyID del entorno, unicidad por proveedor y origen, deduplicación de referencias visibles y política de precios null.",
    "- NO VERIFICADO EN BD: confirmar accesibilidad y persistencia de las URLs de imágenes, logos y galerías.",
    "- NO VERIFICADO EN BD: revisar categorías sin relaciones directas de atributos mediante `npm run auditar:comercial -- --atributos-vacios`.",
    "- La procedencia técnica de cada unidad se conserva en sources, por índice, fuera del objeto Product; incluye identidad, URL y referencia externa cuando exista.",
    "- Los grupos de referencias coincidentes solo incluyen productos exportados; la auditoría del catálogo puede detectar además coincidencias en los excluidos.",
    "- Las comprobaciones acreditan integridad y proyección comercial; no garantizan aceptación semántica ni importación efectiva por el backend.",
    "",
    "## Integridad y reproducción",
    "",
    "- Los cuatro JSON exactos y sus huellas SHA256 están dentro del paquete comercial; `commercial-manifest.json` identifica las fuentes, el entorno y cada archivo.",
    "- Exportar el corte vigente: `npm run exportar:comercial -- --entorno develop` (o production según el destino).",
    "- Verificar el paquete: `npm run auditar:comercial -- --verificar=<ruta-zip-comercial> --informe=<ruta-zip-informe>`.",
    "- La verificación compara la exportación con las publicaciones y referencias activas; un corte antiguo no podrá acreditarse como vigente tras su modificación.",
    ""
  );
  return lines.join("\n");
};
