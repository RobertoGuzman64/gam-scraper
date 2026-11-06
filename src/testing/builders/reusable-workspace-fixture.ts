import { constants } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const reuseWorkspaceTestFixture = <T extends { readonly root: string; readonly cleanup: () => Promise<void> }>(
  initialize: () => Promise<T>
): {
  readonly fixture: () => Promise<T>;
  readonly prepared: (name: string, setup: (data: T) => Promise<void>, from?: string) => Promise<T>;
  readonly close: () => Promise<void>;
} => {
  let data: T | undefined;
  let snapshot: string | undefined;
  const variants = new Set<string>();
  const ensureFixture = async (): Promise<T> => {
    if (!data) {
      const initialized = await initialize();
      const snapshotRoot = await mkdtemp(join(tmpdir(), "equipzilla-workspace-fixture-"));
      try {
        await cp(initialized.root, join(snapshotRoot, "workspace"), { recursive: true, mode: constants.COPYFILE_FICLONE });
      } catch (error) {
        await rm(snapshotRoot, { recursive: true, force: true });
        await initialized.cleanup();
        throw error;
      }
      data = initialized;
      snapshot = snapshotRoot;
    }
    const current = data;
    return { ...current, cleanup: () => rm(current.root, { recursive: true, force: true }) };
  };
  const restore = async (source: string, destination: string): Promise<void> => {
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true, mode: constants.COPYFILE_FICLONE });
  };
  const fixture = async (): Promise<T> => {
    const first = !data;
    const current = await ensureFixture();
    if (!first) {
      if (!snapshot) throw new Error("Falta la copia base del workspace de prueba");
      await restore(join(snapshot, "workspace"), current.root);
    }
    return current;
  };
  return {
    fixture,
    prepared: async (name, setup, from) => {
      if (!/^[a-z][a-z0-9-]*$/.test(name) || name === "workspace") {
        throw new Error("Nombre de fixture preparado inválido");
      }
      if (from !== undefined && !variants.has(from)) {
        throw new Error(`La variante de origen ${from} no está preparada`);
      }
      if (variants.has(name)) {
        const current = await ensureFixture();
        if (!snapshot) throw new Error("Falta la copia base del workspace de prueba");
        await restore(join(snapshot, name), current.root);
        return current;
      }
      const current = from === undefined ? await fixture() : await ensureFixture();
      if (!snapshot) throw new Error("Falta la copia base del workspace de prueba");
      if (from !== undefined) await restore(join(snapshot, from), current.root);
      const destination = join(snapshot, name);
      try {
        await setup(current);
        await cp(current.root, destination, { recursive: true, mode: constants.COPYFILE_FICLONE });
        variants.add(name);
      } catch (error) {
        await rm(destination, { recursive: true, force: true });
        throw error;
      }
      return current;
    },
    close: async () => {
      if (data) await rm(data.root, { recursive: true, force: true });
      if (snapshot) await rm(snapshot, { recursive: true, force: true });
    }
  };
};
