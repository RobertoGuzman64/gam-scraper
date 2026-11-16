const colors = { PASS: "\u001b[32m", WARN: "\u001b[33m", FAIL: "\u001b[31m", RUN: "\u001b[36m" };

export const supportsScriptColor = (stream = process.stdout, env = process.env, platform = process.platform) =>
  env.NO_COLOR === undefined && env.FORCE_COLOR !== "0" &&
  (env.FORCE_COLOR !== undefined || supportsScriptAnimation(stream, platform, env));

export const formatScriptStatus = (status, message, stream = process.stdout) => {
  const label = supportsScriptColor(stream) && colors[status]
    ? `${colors[status]}${status}\u001b[0m` : status;
  return `${label} | ${message}`;
};

export const supportsScriptAnimation = (stream = process.stdout, platform = process.platform, env = process.env) =>
  stream.isTTY === true && env.NO_COLOR === undefined && env.FORCE_COLOR !== "0" &&
  env.CI !== "true" && env.TERM !== "dumb" &&
  (platform !== "win32" || Boolean(env.WT_SESSION) || env.TERM_PROGRAM === "vscode" || env.ConEmuANSI === "ON");
