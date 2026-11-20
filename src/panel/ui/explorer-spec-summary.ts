import type { PanelProviderId } from "../evidence/types.js";
import type { PanelExplorerProduct, PanelSpecAddition } from "../explorer/types.js";
import { create, append, find } from "./dom.js";
import { additionLabels, formatNumber } from "./explorer-labels.js";

export const renderSpecBreakdown = (products: readonly PanelExplorerProduct[], names: Readonly<Record<PanelProviderId, string>>, providerId: PanelProviderId | "todos"): void => {
  const summary = find("explorer-spec-breakdown");
  summary.replaceChildren();
  const included = products.filter((item) => providerId === "todos" || item.providerId === providerId);
  const all = included.flatMap((item) => item.specAdditions);
  const counts: Record<PanelSpecAddition["kind"], number> = { own: 0, reused: 0, pending: 0 };
  for (const entry of all) counts[entry.kind]++;
  const intro = create("p", "explorer-spec-breakdown-title",
    `${formatNumber.format(all.length)} specs nuevas · ${providerId === "todos" ? "Corte completo" : names[providerId]}`);
  append(summary, intro);
  for (const kind of ["own", "reused", "pending"] as const) {
    const counter = create("span", `spec-count spec-kind-${kind}`);
    append(counter, create("strong", "", formatNumber.format(counts[kind])),
      create("span", "", additionLabels[kind]));
    append(summary, counter);
  }
};
