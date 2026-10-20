import { errorDetail } from "./errors.js";
import { LiveStatus, formatDuration } from "./live-status.js";

export const runToolTask = async (
  name: string, task: (status: LiveStatus) => Promise<string>
): Promise<void> => {
  const startedAt = Date.now();
  const status = new LiveStatus();
  status.update(`${name} | preparando`);
  try {
    const outcome = await task(status);
    status.stop();
    const code = process.exitCode ?? 0;
    console.log(`[FIN] ${name} | ${code === 0 ? "OK" : "REVISIÓN"} | código ${code} | ${formatDuration(Date.now() - startedAt)}\n  ${outcome}`);
  } catch (error) {
    status.stop();
    console.error(`[ERROR] ${name} | código 1\n  ${errorDetail(error)}`);
    if (error instanceof Error && error.stack) console.error(`  Stack: ${error.stack}`);
    process.exitCode = 1;
  }
};
