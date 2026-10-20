import type { ScraperProvider } from "./provider.js";
import { gamProvider } from "./providers/gam/adapter.js";
import { gomarizProvider } from "./providers/gomariz/adapter.js";
import { mercaelevaProvider } from "./providers/mercaeleva/adapter.js";

const registeredProviders: readonly ScraperProvider[] = [gamProvider, gomarizProvider, mercaelevaProvider];

export const listProviders = (): readonly string[] => registeredProviders.map((provider) => provider.id);

export const getProvider = (id: string): ScraperProvider => {
  const provider = registeredProviders.find((candidate) => candidate.id === id);
  if (!provider) throw new Error(`Proveedor no registrado: ${id}. Disponibles: ${listProviders().join(", ")}`);
  return provider;
};
