export type EditorialEvidence = {
  readonly url: string;
  readonly title: string;
  readonly categoryKey: string;
  readonly brand: string;
  readonly model: string;
  readonly sourceHash: string;
  readonly sourceSpecs: Readonly<Record<string, string>>;
  readonly general: string;
  readonly originalShort?: string;
  readonly revisedShort?: string;
};
