export type BackoffOptions<T> = {
  attempt: () => Promise<T | null>;
  delaysMs: number[];
  isCancelled?: () => boolean;
  onAttempt?: (attempt: number, delayMs: number) => void;
  signal?: AbortSignal;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timeout);
        resolve();
      };

      signal.addEventListener("abort", onAbort, { once: true });
    }
  });

/**
 * Executes the provided attempt function with incremental backoff delays until it succeeds
 * (returns a non-null value), exhausts all retries, or a cancellation condition is met.
 */
export async function retryWithBackoff<T>({
  attempt,
  delaysMs,
  isCancelled,
  onAttempt,
  signal,
}: BackoffOptions<T>): Promise<T | null> {
  let attemptCount = 0;

  const runAttempt = async (): Promise<T | null> => {
    if (isCancelled?.() || signal?.aborted) return null;
    attemptCount += 1;
    return attempt();
  };

  const first = await runAttempt();
  if (first !== null) return first;

  for (const delay of delaysMs) {
    if (isCancelled?.() || signal?.aborted) return null;
    onAttempt?.(attemptCount + 1, delay);
    await sleep(delay, signal);
    if (isCancelled?.() || signal?.aborted) return null;
    const result = await runAttempt();
    if (result !== null) return result;
  }

  return null;
}
