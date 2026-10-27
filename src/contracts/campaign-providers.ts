export const LEGACY_CAMPAIGN_PROVIDERS = ["gam", "gomariz", "mercaeleva"] as const;

export const CAMPAIGN_PROVIDERS = [...LEGACY_CAMPAIGN_PROVIDERS, "manain"] as const;

export const isCampaignProvider = (value: unknown): value is typeof CAMPAIGN_PROVIDERS[number] =>
  typeof value === "string" && CAMPAIGN_PROVIDERS.some((id) => id === value);

export const isReferenceProviderSet = (providers: readonly string[]): boolean =>
  (providers.length === LEGACY_CAMPAIGN_PROVIDERS.length &&
    LEGACY_CAMPAIGN_PROVIDERS.every((id) => providers.includes(id)) ||
  providers.length === CAMPAIGN_PROVIDERS.length && CAMPAIGN_PROVIDERS.every((id) => providers.includes(id))) &&
  new Set(providers).size === providers.length;
