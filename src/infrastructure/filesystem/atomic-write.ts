import { rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const atomicWrite = async (filePath: string, content: string): Promise<void> => {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, "utf8");
  try {
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

