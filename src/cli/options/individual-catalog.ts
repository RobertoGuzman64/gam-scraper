import { LEGACY_CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import type { IndividualCatalogProvider } from "../../pipeline/preparation/individual-context.js";

export const parseIndividualCatalogProviders = (args: readonly string[]): {
  readonly providerIds: readonly IndividualCatalogProvider[];
  readonly dryRun: boolean;
} => {
  let provider: IndividualCatalogProvider | null = null;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run" || arg === "--simular") {
      if (dryRun) throw new Error("--simular repetido");
      dryRun = true;
    } else if (arg === "--proveedor" || arg === "--provider") {
      const value = args[index + 1];
      if (provider !== null || !value || !LEGACY_CAMPAIGN_PROVIDERS.some((id) => id === value)) {
        throw new Error("--proveedor requiere gam, gomariz o mercaeleva, una sola vez");
      }
      provider = LEGACY_CAMPAIGN_PROVIDERS.find((id) => id === value) ?? null;
      index += 1;
    } else {
      throw new Error(`Opción desconocida: ${arg ?? ""}. Usa --proveedor <id> o --simular`);
    }
  }
  return { providerIds: provider ? [provider] : LEGACY_CAMPAIGN_PROVIDERS, dryRun };
};

