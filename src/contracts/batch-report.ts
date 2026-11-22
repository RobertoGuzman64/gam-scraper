export type ProviderRun = {
  readonly providerId: string;
  readonly status: "complete" | "failed";
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly outputDir: string;
  readonly outputPrefix: string;
  readonly logFile: string;
  readonly summaryFile: string;
  readonly changesFile: string;
  readonly archivedSummaryFile?: string;
  readonly archivedChangesFile?: string;
  readonly archivedErrorsFile?: string;
  readonly archivedPreparationFile?: string;
  readonly archivedPartialPreparationFile?: string;
  readonly products?: number;
  readonly failures?: number;
  readonly added?: number;
  readonly updated?: number;
  readonly suspectedMissing?: number;
  readonly error?: string;
};

export type BatchReport = {
  readonly version: 1;
  readonly runId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly status: "running" | "complete" | "partial" | "failed";
  readonly requestedProviders: readonly string[];
  readonly providers: readonly ProviderRun[];
};

export type PublicationStats = {
  readonly products: number;
  readonly failures: number;
  readonly added: number;
  readonly updated: number;
  readonly suspectedMissing: number;
};

