export const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};

type FetchOpts = {
  readonly timeoutMs: number;
  readonly userAgent: string;
};

const isAbortError = (e: unknown): boolean => {
  if (!(e instanceof Error)) return false;
  return e.name === "AbortError" || /aborted/i.test(e.message);
};

export const fetchHtml = async (url: string, opts: FetchOpts): Promise<string> => {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": opts.userAgent,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
          pragma: "no-cache"
        }
      });

      const text = await res.text();

      if (!res.ok) {
        const msg = `HTTP ${res.status} ${res.statusText} for ${url}`;
        if (res.status === 429 || res.status >= 500) {
          if (attempt < maxAttempts) {
            clearTimeout(t);
            await sleep(500 * attempt);
            continue;
          }
        }
        throw new Error(msg);
      }

      clearTimeout(t);
      return text;
    } catch (e) {
      clearTimeout(t);

      const retryable = isAbortError(e) || e instanceof TypeError;
      if (!retryable || attempt >= maxAttempts) throw e;

      await sleep(500 * attempt);
    }
  }

  throw new Error(`Failed to fetch: ${url}`);
};
