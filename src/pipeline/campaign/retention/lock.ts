import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { acquireBatchLock } from "../../../infrastructure/locking/batch-lock.js";
import { base } from "./journal.js";

export const withCampaignAdmissionLock = async <T>(rootDirectory: string, action: () => Promise<T>): Promise<T> => {
  const root = resolve(rootDirectory);
  await mkdir(base(root), { recursive: true });
  const lock = await acquireBatchLock(base(root), {
    runId: `campaign-admission-${randomUUID()}`, pid: process.pid, startedAt: new Date().toISOString()
  });
  try { return await action(); }
  finally { await lock.release(); }
};

