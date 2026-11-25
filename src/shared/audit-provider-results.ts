export type AuditProviderFailure = {
  readonly source: string;
  readonly providerId: string | null;
  readonly category: "INCOMPLETE_SOURCE" | "ERROR";
  readonly detail: string;
};

export type AuditProviderResults<T> = {
  readonly evaluated: readonly T[];
  readonly failures: readonly AuditProviderFailure[];
  readonly requested: number;
};

const missingAccreditedSource = (message: string): boolean =>
  message.startsWith("No se conserva el original acreditado de ") ||
  message.startsWith("Falta el original canónico para ") ||
  message.startsWith("Falta original portátil: ") ||
  message.startsWith("Falta almacén portátil: ") ||
  message.startsWith("Falta registro parcial de ") ||
  message.startsWith("No existe publicación acreditada de ") ||
  message.startsWith("No existe original canónico para comparar ") ||
  (/ENOENT/u.test(message) && /[\\/]original[\\/]|[\\/]\.history[\\/]|[\\/]manain[\\/]records(?:[\\/]|['"]|$)/u.test(message));

export const collectAuditProviderResults = async <T>(
  sources: readonly string[], inspect: (source: string) => Promise<{ readonly providerId: string; readonly value: T }>,
  identifySource: (source: string) => string | null = () => null
): Promise<AuditProviderResults<T>> => {
  const evaluated: T[] = [];
  const failures: AuditProviderFailure[] = [];
  for (const source of sources) {
    try {
      const result = await inspect(source);
      evaluated.push(result.value);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push({ source, providerId: identifySource(source),
        category: missingAccreditedSource(detail) ? "INCOMPLETE_SOURCE" : "ERROR", detail });
    }
  }
  return { evaluated, failures, requested: sources.length };
};

export const auditProviderCoverage = <T>(results: AuditProviderResults<T>): {
  readonly requested: number;
  readonly evaluated: number;
  readonly incompleteSource: number;
  readonly errors: number;
  readonly failures: readonly AuditProviderFailure[];
} => ({ requested: results.requested, evaluated: results.evaluated.length,
  incompleteSource: results.failures.filter((item) => item.category === "INCOMPLETE_SOURCE").length,
  errors: results.failures.filter((item) => item.category === "ERROR").length,
  failures: results.failures });

export const markAuditProviderFailures = (failures: readonly AuditProviderFailure[]): void => {
  if (failures.length === 0) return;
  process.exitCode = 1;
  for (const item of failures) {
    console.error(`${item.category} | ${item.providerId ?? item.source} | ${item.detail}`);
  }
};
