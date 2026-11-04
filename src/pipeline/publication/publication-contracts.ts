export type PublicationDifference = {
  readonly previous: string | null;
  readonly candidate: string;
  readonly previousProducts: number;
  readonly candidateProducts: number;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly modified: readonly string[];
  readonly lostDescriptions: readonly string[];
  readonly removedSpecifications: readonly string[];
  readonly addedSpecifications: readonly string[];
  readonly changedSpecifications: readonly string[];
  readonly lostSpecificationValues: readonly string[];
  readonly changedSources: readonly string[];
};

