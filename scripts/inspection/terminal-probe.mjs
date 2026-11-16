const mode = process.argv[2];

if (process.argv.length !== 3 || !["--json", "--streams", "--exception"].includes(mode)) {
  console.error("Uso: node scripts/inspection/terminal-probe.mjs --json|--streams|--exception");
  process.exitCode = 1;
} else if (mode === "--json") {
  process.stdout.write(`${JSON.stringify({
    probe: "EQUIPZILLA",
    text: "á é í ó ú ñ █ ✓",
    stdoutTTY: process.stdout.isTTY === true,
    stderrTTY: process.stderr.isTTY === true,
    stdinTTY: process.stdin.isTTY === true,
    colorDisabled: process.env.NO_COLOR !== undefined,
    windowsTerminal: Boolean(process.env.WT_SESSION),
    vsCode: process.env.TERM_PROGRAM === "vscode",
    platform: process.platform
  })}\n`);
} else if (mode === "--streams") {
  process.stdout.write("SALIDA | á é í ó ú ñ █ ✓\n");
  process.stderr.write("ERROR | á é í ó ú ñ █ ✓\n");
  process.exitCode = 17;
} else {
  try {
    throw new Error("Excepción de diagnóstico: á é í ó ú ñ");
  } catch (error) {
    console.error(`FAIL | ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
