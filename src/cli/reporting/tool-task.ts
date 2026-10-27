import { errorDetail } from "./errors.js";
import { LiveStatus, formatDuration } from "./live-status.js";
import { printStatus } from "./terminal.js";

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
    printStatus(code === 0 ? "PASS" : "WARN", `${name} | código ${code} | ${formatDuration(Date.now() - startedAt)}\n  ${outcome}`);
  } catch (error) {
    status.stop();
    printStatus("FAIL", `${name} | código 1\n  ${errorDetail(error)}`);
    if (error instanceof Error && error.stack) console.error(`  Stack: ${error.stack}`);
    process.exitCode = 1;
  }
};
