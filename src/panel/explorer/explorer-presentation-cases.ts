import type { PanelProviderId } from "../evidence/types.js";
import type { PanelExplorerProduct, PanelPresentationCase } from "./types.js";

export const selectPresentationCases = (products: readonly PanelExplorerProduct[]): readonly PanelPresentationCase[] => {
  const cases: PanelPresentationCase[] = [];
  const focuses: readonly { providerId: PanelProviderId; focus: PanelPresentationCase["focus"] }[] = [
    { providerId: "gam", focus: "content" },
    { providerId: "gomariz", focus: "technical" },
    { providerId: "mercaeleva", focus: "commercial" }
  ];
  for (const { providerId, focus } of focuses) {
    const ranked = products.filter((item) => item.providerId === providerId && item.stage === "commercial" && item.original !== null)
      .map((item) => {
        const changed = (focus === "commercial" ? item.commercialChanges : item.changes)
          .filter((difference) => (difference.change === "changed" || difference.change === "added") &&
            (focus === "commercial" || difference.group === focus));
        const compatible = item.provenance.filter((entry) => entry.status !== "observed-only" &&
          entry.publicationSha256 === item.evidence.publication?.sha256 &&
          (focus === "commercial" || entry.group === focus) &&
          (focus === "commercial" || changed.some((difference) => difference.field === entry.field)));
        const score = compatible.some((entry) => entry.status === "source-compatible") ? 2 : compatible.length ? 1 : 0;
        return { item, count: changed.length, score };
      })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.score - a.score || b.count - a.count || a.item.identity.localeCompare(b.item.identity));
    const chosen = ranked[0];
    if (chosen) cases.push({ identity: chosen.item.identity, providerId, focus });
  }
  const exclusion = products.filter((item) => item.stage === "editorial-excluded" && item.decision?.stage === "editorial")
    .sort((a, b) => (a.providerId === "gam" ? -1 : 1) - (b.providerId === "gam" ? -1 : 1) ||
      a.identity.localeCompare(b.identity))[0];
  if (exclusion) cases.push({ identity: exclusion.identity, providerId: exclusion.providerId, focus: "exclusion" });
  return cases;
};
