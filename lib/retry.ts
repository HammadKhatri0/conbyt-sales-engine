// lib/retry.ts

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

/**
 * Retries an async function with exponential backoff, specifically for
 * transient API errors (like Gemini's occasional 503 "high demand" responses).
 * Does NOT retry on errors that are clearly permanent (e.g. invalid API key,
 * malformed request) — only on errors that look transient/server-side.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 1000 }: RetryOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      const isTransient =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.message?.includes("UNAVAILABLE") ||
        err?.message?.includes("high demand");

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1); // 1s, 2s, 4s...
      console.log(`Transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}