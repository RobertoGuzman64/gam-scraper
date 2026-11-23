import { CAMPAIGN_PROVIDERS, LEGACY_CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import type { IndividualCatalogProvider, IndividualPreparationProvider } from "../../preparation/workflow/individual-context.js";

type ParsedIndividualCatalogProviders<T extends IndividualPreparationProvider> = {
  readonly providerIds: readonly T[];
  readonly dryRun: boolean;
};

export function parseIndividualCatalogProviders(args: readonly string[]): ParsedIndividualCatalogProviders<IndividualCatalogProvider>;
export function parseIndividualCatalogProviders(args: readonly string[], allowManain: true): ParsedIndividualCatalogProviders<IndividualPreparationProvider>;
export function parseIndividualCatalogProviders(
  args: readonly string[], allowManain: boolean = false
): ParsedIndividualCatalogProviders<IndividualPreparationProvider> {
  let provider: IndividualPreparationProvider | null = null;
  let dryRun = false;
  const permitted = allowManain ? CAMPAIGN_PROVIDERS : LEGACY_CAMPAIGN_PROVIDERS;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run" || arg === "--simular") {
      if (dryRun) throw new Error("--simular repetido");
      dryRun = true;
    } else if (arg === "--proveedor" || arg === "--provider") {
      const value = args[index + 1];
      if (provider !== null || !value || !permitted.some((id) => id === value)) {
        throw new Error(`--proveedor requiere ${permitted.join(", ")}, una sola vez`);
      }
      provider = permitted.find((id) => id === value) ?? null;
      index += 1;
    } else {
      throw new Error(`Opción desconocida: ${arg ?? ""}. Usa --proveedor <id> o --simular`);
    }
  }
  return { providerIds: provider ? [provider] : LEGACY_CAMPAIGN_PROVIDERS, dryRun };
}
