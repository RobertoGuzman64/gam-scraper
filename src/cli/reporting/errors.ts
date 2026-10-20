export const errorDetail = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const parts: string[] = [];
  const visited = new Set<Error>();
  let current: unknown = error;
  while (current instanceof Error && !visited.has(current)) {
    visited.add(current);
    parts.push(`${current.name}: ${current.message}`);
    current = current.cause;
  }
  if (current !== undefined && current !== null) parts.push(`Causa: ${String(current)}`);
  return parts.join("\n  Causado por: ");
};

export const printCommandError = (command: string, error: unknown): void => {
  console.error(`[ERROR] ${command} | código 1\n  ${errorDetail(error)}`);
  if (error instanceof Error && error.stack) console.error(`  Stack: ${error.stack}`);
};
