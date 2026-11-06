import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reuseCampaignTestFixture } from "../campaign-catalog-fixture.js";

const createFixtureCache = () => {
  let initializations = 0;
  const cache = reuseCampaignTestFixture(async () => {
    initializations += 1;
    const root = await mkdtemp(join(tmpdir(), "equipzilla-fixture-regression-"));
    await writeFile(join(root, "base.json"), JSON.stringify({ value: "original" }));
    return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
  });
  return { cache, get initializations() { return initializations; } };
};

const readValue = (root: string, name: string): Promise<string> => readFile(join(root, name), "utf8");

test("la variante preparada se restaura aislada incluso después de mutaciones", async () => {
  const instance = createFixtureCache();
  const { cache } = instance;
  let setups = 0;
  const setup = async (data: { readonly root: string }): Promise<void> => {
    setups += 1;
    await writeFile(join(data.root, "approved.json"), "originalmente-aprobado");
  };
  try {
    const first = await cache.prepared("approved", setup);
    await writeFile(join(first.root, "approved.json"), "alterado");
    await writeFile(join(first.root, "contaminacion.json"), "no debe sobrevivir");
    const second = await cache.prepared("approved", setup);
    assert.equal(await readValue(second.root, "approved.json"), "originalmente-aprobado");
    await assert.rejects(readValue(second.root, "contaminacion.json"), { code: "ENOENT" });
    assert.equal(setups, 1);
    assert.equal(instance.initializations, 1);
  } finally {
    await cache.close();
  }
});

test("las variantes preparadas y la campaña base no comparten modificaciones", async () => {
  const { cache } = createFixtureCache();
  try {
    const first = await cache.prepared("primera", async (data) => {
      await writeFile(join(data.root, "variant.json"), "primera");
    });
    assert.equal(await readValue(first.root, "variant.json"), "primera");
    const base = await cache.fixture();
    assert.equal(await readValue(base.root, "base.json"), JSON.stringify({ value: "original" }));
    await assert.rejects(readValue(base.root, "variant.json"), { code: "ENOENT" });
    const second = await cache.prepared("segunda", async (data) => {
      await writeFile(join(data.root, "variant.json"), "segunda");
    });
    assert.equal(await readValue(second.root, "variant.json"), "segunda");
    const restored = await cache.prepared("primera", async () => {
      throw new Error("No debe regenerar una variante ya preparada");
    });
    assert.equal(await readValue(restored.root, "variant.json"), "primera");
  } finally {
    await cache.close();
  }
});

test("un error preparando una variante no contamina el reintento", async () => {
  const { cache } = createFixtureCache();
  let attempts = 0;
  try {
    await assert.rejects(cache.prepared("interrumpida", async (data) => {
      attempts += 1;
      await writeFile(join(data.root, "interrumpido.txt"), "incompleto");
      throw new Error("Preparación interrumpida");
    }), /Preparación interrumpida/);
    const base = await cache.fixture();
    await assert.rejects(readValue(base.root, "interrumpido.txt"), { code: "ENOENT" });
    const recovered = await cache.prepared("interrumpida", async (data) => {
      attempts += 1;
      await writeFile(join(data.root, "terminado.txt"), "completo");
    });
    assert.equal(attempts, 2);
    assert.equal(await readValue(recovered.root, "terminado.txt"), "completo");
    await assert.rejects(readValue(recovered.root, "interrumpido.txt"), { code: "ENOENT" });
  } finally {
    await cache.close();
  }
});

test("no crea snapshots para nombres inválidos y elimina el workspace al cerrar", async () => {
  const instance = createFixtureCache();
  const { cache } = instance;
  await assert.rejects(cache.prepared("workspace", async () => {}), /inválido/);
  await assert.rejects(cache.prepared("../externo", async () => {}), /inválido/);
  assert.equal(instance.initializations, 0);
  const current = await cache.fixture();
  await cache.close();
  await assert.rejects(readValue(current.root, "base.json"), { code: "ENOENT" });
  await cache.close();
});

test("una variante derivada conserva el trabajo acreditado y restaura el aislamiento", async () => {
  const instance = createFixtureCache();
  const { cache } = instance;
  let baseSetups = 0;
  let derivedSetups = 0;
  const createBase = async (data: { readonly root: string }) => {
    baseSetups += 1;
    await writeFile(join(data.root, "approved.json"), "aprobado");
  };
  const createDerived = async (data: { readonly root: string }) => {
    derivedSetups += 1;
    assert.equal(await readValue(data.root, "approved.json"), "aprobado");
    await writeFile(join(data.root, "delivery.json"), "entregado");
  };
  try {
    await assert.rejects(cache.prepared("delivery", createDerived, "approved"), /no está preparada/);
    const base = await cache.prepared("approved", createBase);
    await writeFile(join(base.root, "approved.json"), "manipulado");
    const delivered = await cache.prepared("delivery", createDerived, "approved");
    await writeFile(join(delivered.root, "approved.json"), "contaminado");
    await writeFile(join(delivered.root, "delivery.json"), "dañado");
    const restored = await cache.prepared("delivery", createDerived, "approved");
    assert.equal(await readValue(restored.root, "approved.json"), "aprobado");
    assert.equal(await readValue(restored.root, "delivery.json"), "entregado");
    const original = await cache.fixture();
    await assert.rejects(readValue(original.root, "approved.json"), { code: "ENOENT" });
    await assert.rejects(readValue(original.root, "delivery.json"), { code: "ENOENT" });
    assert.equal(baseSetups, 1);
    assert.equal(derivedSetups, 1);
    assert.equal(instance.initializations, 1);
  } finally {
    await cache.close();
  }
});

test("una variante derivada fallida conserva intacta su preparación de origen", async () => {
  const { cache } = createFixtureCache();
  try {
    await cache.prepared("approved", async (data) => {
      await writeFile(join(data.root, "approved.json"), "aprobado");
    });
    await assert.rejects(cache.prepared("delivered", async (data) => {
      await writeFile(join(data.root, "incompleto.json"), "parcial");
      throw new Error("Entrega interrumpida");
    }, "approved"), /Entrega interrumpida/);
    const recovered = await cache.prepared("delivered", async (data) => {
      assert.equal(await readValue(data.root, "approved.json"), "aprobado");
      await assert.rejects(readValue(data.root, "incompleto.json"), { code: "ENOENT" });
      await writeFile(join(data.root, "delivery.json"), "entregado");
    }, "approved");
    assert.equal(await readValue(recovered.root, "delivery.json"), "entregado");
    const base = await cache.prepared("approved", async () => {
      throw new Error("No se debe reconstruir la aprobación");
    });
    await assert.rejects(readValue(base.root, "delivery.json"), { code: "ENOENT" });
    await assert.rejects(readValue(base.root, "incompleto.json"), { code: "ENOENT" });
  } finally {
    await cache.close();
  }
});
