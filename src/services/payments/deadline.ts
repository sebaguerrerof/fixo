/** Thrown when the total processing budget is exhausted. Nothing may be acknowledged as persisted after this. */
export class DeadlineExceededError extends Error { constructor() { super("Tiempo de procesamiento agotado."); this.name = "DeadlineExceededError"; } }

/**
 * Bounds a promise by an AbortSignal: rejects as soon as the signal aborts, even if the underlying operation ignores it.
 * The operation should also receive the signal so the real request is cancelled.
 */
export function withDeadline<T>(signal: AbortSignal, operation: Promise<T>): Promise<T> {
  if (signal.aborted) { operation.catch(() => undefined); return Promise.reject(new DeadlineExceededError()); }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DeadlineExceededError());
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
