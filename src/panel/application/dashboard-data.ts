import { SPEC_KEY_NORMALIZATION, SPEC_RULES } from "../../catalog/normalization/spec-rules.js";
import type { SpecRuleType } from "../../catalog/normalization/spec-rules.js";
import { PANEL_METRIC_DEFINITIONS } from "../evidence/metric-definitions.js";
import type { PanelMetricDefinition } from "../evidence/metric-definitions.js";
import type { PanelProviderId, PanelSnapshot } from "../evidence/types.js";
import type { PanelExplorerPayload } from "../explorer/types.js";

export type PanelNormalizationEntry = {
  readonly input: string;
  readonly canonical: string;
  readonly ruleType: SpecRuleType | null;
};

export type PanelDashboardPayload = {
  readonly snapshot: PanelSnapshot;
  readonly explorer: PanelExplorerPayload;
  readonly definitions: readonly PanelMetricDefinition[];
  readonly names: Readonly<Record<PanelProviderId, string>>;
  readonly normalizationExamples: readonly PanelNormalizationEntry[];
  readonly normalizationDictionary: readonly PanelNormalizationEntry[];
};

const PANEL_NAMES: Readonly<Record<PanelProviderId, string>> = {
  gam: "GAM",
  gomariz: "Gomariz",
  mercaeleva: "Mercaeleva"
};

const normalizationDictionary = (): readonly PanelNormalizationEntry[] => Object.entries(SPEC_KEY_NORMALIZATION)
  .map(([input, canonical]) => ({ input, canonical, ruleType: SPEC_RULES[canonical] ?? null }))
  .sort((a, b) => a.canonical.localeCompare(b.canonical, "es") || a.input.localeCompare(b.input, "es"));

const normalizationExamples = (dictionary: readonly PanelNormalizationEntry[]): readonly PanelNormalizationEntry[] => {
  const preferred = ["ano", "capacidad carga", "tipo bateria", "traccion 4x4", "dim horquillas", "dim cesta", "localizacion", "serial"];
  const choices = [...preferred.flatMap((input) => dictionary.filter((entry) => entry.input === input)), ...dictionary];
  const examples: PanelNormalizationEntry[] = [];
  const types = new Set<SpecRuleType | null>();
  const canonicals = new Set<string>();
  for (const entry of choices) {
    if (types.has(entry.ruleType) || canonicals.has(entry.canonical)) continue;
    examples.push(entry);
    types.add(entry.ruleType);
    canonicals.add(entry.canonical);
    if (examples.length === 8) return examples;
  }
  for (const entry of dictionary) {
    if (canonicals.has(entry.canonical)) continue;
    examples.push(entry);
    canonicals.add(entry.canonical);
    if (examples.length === 8) break;
  }
  return examples;
};

export const createDashboardPayload = (snapshot: PanelSnapshot, explorer: PanelExplorerPayload): PanelDashboardPayload => {
  const dictionary = normalizationDictionary();
  return {
    snapshot, explorer,
    definitions: PANEL_METRIC_DEFINITIONS,
    names: PANEL_NAMES,
    normalizationExamples: normalizationExamples(dictionary),
    normalizationDictionary: dictionary
  };
};
