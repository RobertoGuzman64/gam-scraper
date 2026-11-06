import type { ProductRecord } from "../../contracts/catalog.js";
import type { PreparedProduct } from "../../preparation/contracts.js";
import { decideCommercialCategory } from "../projection/category-decision.js";
import type { CommercialCategoryDecision } from "../projection/category-decision.js";

export type CommercialCategoryAudit = {
  readonly eligible: number;
  readonly proposed: number;
  readonly pending: number;
  readonly excludedLots: number;
  readonly excludedTools: number;
  readonly excludedAccessories: number;
  readonly categories: readonly {
    readonly categorySellID: number;
    readonly name: string;
    readonly proposed: number;
    readonly samples: readonly {
      readonly reference: string | null;
      readonly title: string | null;
      readonly sourceCategory: string;
      readonly sourceUrl: string;
    }[];
  }[];
  readonly decisions: readonly {
    readonly reference: string | null;
    readonly sourceUrl: string;
    readonly sourceCategory: string;
    readonly categorySellID: number | null;
    readonly status: CommercialCategoryDecision["status"];
    readonly reason: CommercialCategoryDecision["reason"];
  }[];
};

type CategoryInput = { readonly source: ProductRecord; readonly mapped: PreparedProduct };
type CategorySample = CommercialCategoryAudit["categories"][number]["samples"][number];

export const analyzeCommercialCategories = (entries: readonly CategoryInput[]): CommercialCategoryAudit => {
  const categories = new Map<number, { name: string; samples: CategorySample[] }>();
  const decisions: CommercialCategoryAudit["decisions"][number][] = [];
  let excludedLots = 0;
  let excludedTools = 0;
  let excludedAccessories = 0;
  let pending = 0;
  let proposed = 0;
  for (const { source, mapped } of entries) {
    const decision = decideCommercialCategory(source, mapped.product.categorySellID);
    decisions.push({
      reference: source.reference, sourceUrl: source.url, sourceCategory: source.categoryKey,
      categorySellID: decision.categorySellID, status: decision.status, reason: decision.reason
    });
    if (decision.status === "excluded") {
      if (decision.reason === "lote") excludedLots += 1;
      else if (decision.reason === "herramienta") excludedTools += 1;
      else excludedAccessories += 1;
    } else if (decision.status === "pending") pending += 1;
    else {
      proposed += 1;
      const group = categories.get(decision.categorySellID) ?? { name: mapped.product.category ?? "", samples: [] };
      group.samples.push({ reference: source.reference, sourceUrl: source.url, title: source.title,
        sourceCategory: source.categoryKey });
      categories.set(decision.categorySellID, group);
    }
  }
  return {
    eligible: proposed + pending, proposed, pending, excludedLots, excludedTools, excludedAccessories,
    categories: [...categories].map(([categorySellID, group]) => {
      const ordered = [...group.samples].sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl, "es"));
      const indices = new Set([0, Math.floor((ordered.length - 1) / 2), ordered.length - 1]);
      return { categorySellID, name: group.name, proposed: ordered.length,
        samples: [...indices].map((index) => ordered[index]).filter((sample) => sample !== undefined) };
    }).sort((a, b) => b.proposed - a.proposed || a.categorySellID - b.categorySellID),
    decisions: decisions.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl, "es"))
  };
};
