export type Artifact = { readonly path: string; readonly sha256: string };
export type Preparation = Artifact & { readonly preparedAt: string; readonly intervened: boolean };

export type ProviderDiscovery = {
  readonly providerId: string;
  readonly state: "not-started" | "failed" | "invalid" | "catalog" | "prepared";
  readonly catalog?: Artifact;
  readonly preparation?: Preparation;
  readonly message?: string;
};

