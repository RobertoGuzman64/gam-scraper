import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { spawnRunner, withRunner } from "./test-runner-fixture.js";

test("el runner incluye pruebas TypeScript y MJS en un único informe", () => {
  withRunner((root) => {
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia=2", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(typeof report === "object" && report !== null && "resumen" in report);
    const summary = report.resumen;
    assert.ok(typeof summary === "object" && summary !== null && "archivos" in summary &&
      "correctos" in summary && "fallidos" in summary && "omitidos" in summary);
    assert.equal(summary.archivos, 2);
    assert.equal(summary.correctos, 2);
    assert.equal(summary.fallidos, 0);
    assert.equal(summary.omitidos, 0);
    assert.ok("archivos" in report && Array.isArray(report.archivos));
    assert.equal(report.archivos.length, 2);
    for (const file of report.archivos) {
      assert.ok(typeof file === "object" && file !== null && "inicio_ms" in file &&
        "fin_ms" in file && "tiempo_ms" in file);
      assert.equal(typeof file.inicio_ms, "number");
      assert.equal(typeof file.fin_ms, "number");
      assert.equal(typeof file.tiempo_ms, "number");
      assert.ok("informe_recibido_ms" in file && typeof file.informe_recibido_ms === "number");
      assert.ok("retraso_informe_ms" in file && typeof file.retraso_informe_ms === "number");
      assert.ok(Math.abs(file.fin_ms - file.inicio_ms - file.tiempo_ms) < 0.01);
      assert.ok(file.informe_recibido_ms + 10 >= file.fin_ms);
    }
    assert.ok("diagnostico" in report && typeof report.diagnostico === "object" &&
      report.diagnostico !== null && "cota_inferior_ideal_ms" in report.diagnostico);
    assert.equal(typeof report.diagnostico.cota_inferior_ideal_ms, "number");
    assert.ok("ultimo_fin_estimado_ms" in report.diagnostico &&
      typeof report.diagnostico.ultimo_fin_estimado_ms === "number");
  });
});

test("el runner distribuye las pruebas intensivas sin perder resultados ni superar la concurrencia", () => {
  withRunner((root) => {
    const heavy = ["individual-finish", "individual-accreditation-session"];
    for (const name of heavy) {
      const source = join(root, "src", "publication", "tests", `${name}.test.ts`);
      const compiled = join(root, "dist", "publication", "tests", `${name}.test.js`);
      mkdirSync(dirname(source), { recursive: true });
      mkdirSync(dirname(compiled), { recursive: true });
      writeFileSync(source, "export {};\n");
      writeFileSync(compiled, `import test from "node:test"; test("${name}", () => {});\n`);
    }
    for (let index = 0; index < 18; index += 1) {
      const source = join(root, "src", `ligera-${index}.test.ts`);
      const compiled = join(root, "dist", `ligera-${index}.test.js`);
      writeFileSync(source, "export {};\n");
      writeFileSync(compiled, `import test from "node:test"; test("ligera-${index}", () => {});\n`);
    }
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia=12", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(report !== null && typeof report === "object" &&
      "resumen" in report && "distribucion" in report && Array.isArray(report.distribucion));
    assert.ok(report.resumen !== null && typeof report.resumen === "object" &&
      "archivos" in report.resumen && "correctos" in report.resumen && "fallidos" in report.resumen);
    assert.equal(report.resumen.archivos, 22);
    assert.equal(report.resumen.correctos, 22);
    assert.equal(report.resumen.fallidos, 0);
    assert.equal(report.distribucion.length, 2);
    assert.ok(report.distribucion.every((lane) => lane !== null && typeof lane === "object" &&
      "archivos" in lane && "concurrencia" in lane && typeof lane.archivos === "number" &&
      typeof lane.concurrencia === "number"));
    assert.equal(report.distribucion.reduce((total, lane) => total + lane.concurrencia, 0), 12);
    assert.equal(report.distribucion.reduce((total, lane) => total + lane.archivos, 0), 22);
    rmSync(join(root, "dist", ".test-runner-durations.json"), { force: true });
    writeFileSync(join(root, "dist", "publication", "tests", "individual-finish.test.js"),
      'import test from "node:test"; test("fallo de cola intensiva", () => { throw new Error("fallo controlado"); });\n');
    const failed = spawnRunner(root, ["--concurrencia=12", "--medicion", reportFile]);
    assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}`);
    assert.match(failed.stdout, /fallo de cola intensiva/);
    const failedReport: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(failedReport !== null && typeof failedReport === "object" &&
      "resumen" in failedReport && failedReport.resumen !== null && typeof failedReport.resumen === "object" &&
      "fallidos" in failedReport.resumen && "correctos" in failedReport.resumen &&
      "distribucion" in failedReport && Array.isArray(failedReport.distribucion));
    assert.equal(failedReport.resumen.fallidos, 1);
    assert.equal(failedReport.resumen.correctos, 21);
    assert.equal(failedReport.distribucion.length, 2);
  });
});

test("el runner propaga al comando el error de una prueba MJS", () => {
  withRunner((root) => {
    writeFileSync(join(root, "scripts", "inspection", "tests", "prueba.test.mjs"),
      'import test from "node:test"; test("prueba MJS fallida", () => { throw new Error("fallo controlado"); });\n');
    const result = spawnRunner(root, []);
    assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /prueba MJS fallida/);
    assert.match(result.stdout, /1 fallidos/);
  });
});

test("la consola conserva el motivo de omisión y termina en un resultado inequívoco", () => {
  withRunner((root) => {
    writeFileSync(join(root, "scripts", "inspection", "tests", "prueba.test.mjs"),
      'import test from "node:test"; test("omisión deliberada", { skip: "condición acreditada" }, () => {});\n');
    const result = spawnRunner(root, ["--concurrencia=2"]);
    assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /OMITIDOS \| 1/);
    assert.match(result.stdout, /omisión deliberada.*condición acreditada/);
    assert.match(result.stdout, /TIEMPOS \| Último informe.*Fin del runner.*Intervalo posterior/);
    assert.match(result.stdout, /FAIL \| TESTS \| 2\/2 suites · 1 correctos · 0 fallidos · 1 omitidos/);
  });
});

test("el runner usa la concurrencia adaptativa predeterminada", () => {
  withRunner((root) => {
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(typeof report === "object" && report !== null && "concurrencia" in report);
    assert.equal(report.concurrencia, Math.min(12, Math.max(1, availableParallelism())));
  });
});

test("el runner adelanta las pruebas costosas y no confunde recepción con finalización", () => {
  withRunner((root) => {
    const relativeFile = join("publication", "tests", "individual-editorial.test.js");
    const compiledFile = join(root, "dist", relativeFile);
    const sourceFile = join(root, "src", "publication", "tests", "individual-editorial.test.ts");
    mkdirSync(dirname(compiledFile), { recursive: true });
    mkdirSync(dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, "export {};\n");
    writeFileSync(compiledFile,
      'import test from "node:test"; test("prueba lenta", async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });\n');
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia=2", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(typeof report === "object" && report !== null && "archivos" in report && Array.isArray(report.archivos));
    const entries = report.archivos;
    const priority = entries.find((entry: unknown) =>
      typeof entry === "object" && entry !== null && "archivo" in entry &&
      typeof entry.archivo === "string" && entry.archivo.replaceAll("\\", "/").endsWith(relativeFile.replaceAll("\\", "/")));
    assert.ok(priority && "inicio_ms" in priority && typeof priority.inicio_ms === "number");
    const base = entries.find((entry: unknown) =>
      typeof entry === "object" && entry !== null && "archivo" in entry &&
      typeof entry.archivo === "string" && entry.archivo.endsWith("prueba.test.js"));
    assert.ok(base && "inicio_ms" in base && typeof base.inicio_ms === "number");
    assert.ok(priority.inicio_ms <= base.inicio_ms);
    for (const entry of entries) {
      assert.ok(typeof entry === "object" && entry !== null && "inicio_ms" in entry &&
        "fin_ms" in entry && "tiempo_ms" in entry && "informe_recibido_ms" in entry);
      assert.ok(typeof entry.inicio_ms === "number" && typeof entry.fin_ms === "number" &&
        typeof entry.tiempo_ms === "number" && typeof entry.informe_recibido_ms === "number");
      assert.ok(Math.abs(entry.inicio_ms + entry.tiempo_ms - entry.fin_ms) < 0.01);
    }
  });
});

test("el runner aprende las duraciones sin cambiar el resultado ni publicar artefactos", () => {
  withRunner((root) => {
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const file = join(root, "dist", ".test-runner-durations.json");
    const profile: unknown = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(profile && typeof profile === "object" && "durations" in profile);
    assert.ok(profile.durations && typeof profile.durations === "object" &&
      "dist/prueba.test.js" in profile.durations && "scripts/inspection/tests/prueba.test.mjs" in profile.durations);
    assert.equal(typeof profile.durations["dist/prueba.test.js"], "number");
    assert.equal(typeof profile.durations["scripts/inspection/tests/prueba.test.mjs"], "number");
  });
});

test("el runner prioriza el trabajo más lento según el perfil de la misma concurrencia", () => {
  withRunner((root) => {
    writeFileSync(join(root, "dist", ".test-runner-durations.json"), JSON.stringify({
      version: 1, platform: process.platform, concurrency: 1,
      durations: { "dist/prueba.test.js": 1, "scripts/inspection/tests/prueba.test.mjs": 50000 }
    }));
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia", "1", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(report && typeof report === "object" && "archivos" in report && Array.isArray(report.archivos));
    const file = report.archivos.find((item: unknown) =>
      item !== null && typeof item === "object" && "archivo" in item &&
      typeof item.archivo === "string" && item.archivo.replaceAll("\\", "/").endsWith("scripts/inspection/tests/prueba.test.mjs"));
    const base = report.archivos.find((item: unknown) =>
      item !== null && typeof item === "object" && "archivo" in item &&
      typeof item.archivo === "string" && item.archivo.replaceAll("\\", "/").endsWith("dist/prueba.test.js"));
    assert.ok(file && base && "inicio_ms" in file && "inicio_ms" in base &&
      typeof file.inicio_ms === "number" && typeof base.inicio_ms === "number");
    assert.ok(file.inicio_ms < base.inicio_ms);
  });
});

test("perfiles dañados no impiden los tests ni se sobrescribe un perfil tras un FAIL", () => {
  withRunner((root) => {
    const profileFile = join(root, "dist", ".test-runner-durations.json");
    writeFileSync(profileFile, "INVALID JSON");
    assert.equal(spawnRunner(root, []).status, 0);
    const before = readFileSync(profileFile, "utf8");
    writeFileSync(join(root, "scripts", "inspection", "tests", "prueba.test.mjs"),
      'import test from "node:test"; test("falla", () => { throw new Error("controlado"); });\n');
    const failed = spawnRunner(root, []);
    assert.equal(failed.status, 1, `${failed.stdout}${failed.stderr}`);
    assert.equal(readFileSync(profileFile, "utf8"), before);
  });
});

test("sin perfil previo adelanta FINISH y acreditación antes que las suites ligeras", () => {
  withRunner((root) => {
    const files = [
      "publication/tests/individual-finish.test",
      "publication/tests/individual-accreditation-session.test"
    ];
    for (const path of files) {
      const source = join(root, "src", `${path}.ts`);
      const compiled = join(root, "dist", `${path}.js`);
      mkdirSync(dirname(source), { recursive: true });
      mkdirSync(dirname(compiled), { recursive: true });
      writeFileSync(source, "export {};\n");
      writeFileSync(compiled, 'import test from "node:test"; test("protegida", () => {});\n');
    }
    const reportFile = join(root, "medicion.json");
    const result = spawnRunner(root, ["--concurrencia", "1", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(report && typeof report === "object" && "archivos" in report && Array.isArray(report.archivos));
    const starts = new Map<string, number>();
    for (const item of report.archivos) {
      if (item && typeof item === "object" && "archivo" in item && "inicio_ms" in item &&
        typeof item.archivo === "string" && typeof item.inicio_ms === "number") {
        starts.set(item.archivo.replaceAll("\\", "/"), item.inicio_ms);
      }
    }
    const getStart = (suffix: string): number => {
      const item = [...starts].find(([key]) => key.endsWith(suffix));
      assert.ok(item);
      return item[1];
    };
    assert.ok(getStart("individual-finish.test.js") < getStart("individual-accreditation-session.test.js"));
    assert.ok(getStart("individual-accreditation-session.test.js") < getStart("dist/prueba.test.js"));
  });
});

test("recibe el informe de una suite rápida aunque otra anterior siga ejecutándose", () => {
  withRunner((root) => {
    writeFileSync(join(root, "dist", "prueba.test.js"),
      'import test from "node:test"; test("lenta", async () => { await new Promise((resolve) => setTimeout(resolve, 1400)); });\n');
    const reportFile = join(root, "tiempos-desordenados.json");
    const result = spawnRunner(root, ["--concurrencia=2", "--medicion", reportFile]);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const report: unknown = JSON.parse(readFileSync(reportFile, "utf8"));
    assert.ok(report && typeof report === "object" && "archivos" in report && Array.isArray(report.archivos));
    const slow = report.archivos.find((item: unknown) =>
      item && typeof item === "object" && "archivo" in item &&
      typeof item.archivo === "string" && item.archivo.replaceAll("\\", "/").endsWith("dist/prueba.test.js"));
    const fast = report.archivos.find((item: unknown) =>
      item && typeof item === "object" && "archivo" in item &&
      typeof item.archivo === "string" && item.archivo.replaceAll("\\", "/").endsWith("prueba.test.mjs"));
    assert.ok(slow && fast && "informe_recibido_ms" in slow && "informe_recibido_ms" in fast &&
      typeof slow.informe_recibido_ms === "number" && typeof fast.informe_recibido_ms === "number");
    assert.ok(fast.informe_recibido_ms + 500 < slow.informe_recibido_ms,
      `Los informes deben llegar al finalizar cada suite: ${JSON.stringify(report.archivos)}`);
    assert.ok("resumen" in report && report.resumen && typeof report.resumen === "object" &&
      "correctos" in report.resumen && report.resumen.correctos === 2);
  });
});

test("un error de carga informa el archivo fallido y no simula una suite bloqueada", () => {
  withRunner((root) => {
    writeFileSync(join(root, "dist", "prueba.test.js"), 'import "./no-existe.js";\n');
    const result = spawnRunner(root, ["--concurrencia=2"]);
    assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /FAIL \| TESTS \| 2\/2 suites/);
    assert.match(result.stdout, /1 fallidos/);
    assert.doesNotMatch(result.stdout, /archivos terminaron sin informe recibido/);
  });
});
