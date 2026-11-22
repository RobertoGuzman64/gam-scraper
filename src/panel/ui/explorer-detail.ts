import type { PanelProviderId } from "../evidence/types.js";
import type { PanelExplorerProduct, PanelSpecAddition } from "../explorer/types.js";
import { find, create, append, verifiedUrl, linkTo } from "./dom.js";
import { stages } from "./explorer-labels.js";
import { renderStageCards } from "./explorer-stage-cards.js";
import { renderSpecifications } from "./explorer-specifications.js";
import { compareSection, comparisonState, contentDifference, commercialDifference, renderTitle, renderDescriptions, renderCommercialData, renderTechnicalContribution } from "./explorer-detail-sections.js";

export const renderExplorerDetail = (
  item: PanelExplorerProduct | null, names: Readonly<Record<PanelProviderId, string>>,
  additionKind: PanelSpecAddition["kind"] | "todos", normalizedFields: ReadonlyMap<string, string>
): void => {
  const target = find("explorer-detail");
  target.replaceChildren();
  if (!item) {
    append(target, create("div", "explorer-empty", "Selecciona una máquina del listado o uno de los casos reales."));
    return;
  }
  const heading = create("div", "detail-header");
  const metadata = create("div", "detail-metadata");
  append(metadata, create("p", "", `Referencia: ${item.reference ?? "No consta"}`),
    create("p", "", `Categoría: ${item.category ?? "No consta"}`));
  append(heading, create("span", "section-kicker", `${names[item.providerId]} · ${stages[item.stage]}`),
    create("h2", "", item.published?.title ?? item.original?.title ?? "Máquina sin título"), metadata);
  if (verifiedUrl(item.sourceUrl)) append(heading, linkTo(item.sourceUrl, "Abrir ficha del proveedor"));

  append(target, heading);
  if (item.decision) {
    const excluded = create("section", "explorer-decision-summary");
    append(excluded, create("strong", "", item.decision.stage === "editorial" ?
      "Excluida de FINISH" : "Excluida de la proyección comercial"), create("p", "", item.decision.reason));
    if (item.decision.issues.length) {
      const issues = create("ul");
      for (const issue of item.decision.issues) append(issues, create("li", "", issue));
      append(excluded, issues);
    }
    for (const url of item.decision.evidenceUrls) {
      if (verifiedUrl(url)) append(excluded, linkTo(url, "Consultar evidencia de la exclusión"));
    }
    append(target, excluded);
  }
  append(target, renderStageCards(item, normalizedFields));
  const contribution = renderTechnicalContribution(item);
  if (contribution) append(target, contribution);
  const comparison = create("section", "record-comparison");
  append(comparison, create("span", "section-kicker", "CONTENIDO POR ETAPA"),
    create("h3", "", "Comparar contenido de la ficha"));
  if (!item.original && item.published) append(comparison, create("p", "evidence-warning",
    "No existe original verificable para este corte. No se muestran diferencias imaginadas."));
  append(comparison,
    compareSection("Título", comparisonState(item, contentDifference(item, "Título"), commercialDifference(item, "Título")),
      renderTitle(item), true),
    compareSection("Descripción corta", comparisonState(item, contentDifference(item, "Descripción corta"), []),
      renderDescriptions(item, "shortDescription")),
    compareSection("Especificaciones técnicas", comparisonState(item,
      item.changes.filter((entry) => entry.group === "technical"), item.commercialTechnicalChanges),
      renderSpecifications(item, additionKind)),
    compareSection("Descripción general", comparisonState(item, contentDifference(item, "Descripción general"), []),
      renderDescriptions(item, "generalDescription")),
    compareSection("Categoría y datos comerciales", comparisonState(item,
      [...contentDifference(item, "Categoría de origen / técnica"), ...contentDifference(item, "Precio declarado")],
      [...commercialDifference(item, "Categoría técnica / comercial"), ...commercialDifference(item, "Precio"),
        ...commercialDifference(item, "Identificador de categoría comercial"),
        ...item.commercialChanges.filter((entry) => entry.field.startsWith("Atributo comercial #"))]),
      renderCommercialData(item)));
  append(target, comparison);
};
