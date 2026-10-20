import type { ScraperProvider } from "./contracts.js";
import { gamProvider } from "./gam/adapter.js";
import { gomarizProvider } from "./gomariz/adapter.js";
import { mercaelevaProvider } from "./mercaeleva/adapter.js";

const registeredProviders: readonly ScraperProvider[] = [gamProvider, gomarizProvider, mercaelevaProvider];

export const listProviders = (): readonly string[] => registeredProviders.map((provider) => provider.id);

export const getProvider = (id: string): ScraperProvider => {
  const provider = registeredProviders.find((candidate) => candidate.id === id);
  if (!provider) throw new Error(`Proveedor no registrado: ${id}. Disponibles: ${listProviders().join(", ")}`);
  return provider;
};
