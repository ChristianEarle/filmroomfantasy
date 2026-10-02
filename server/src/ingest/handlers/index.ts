import type { JobHandler } from '../types';
import { oddsLinesHandler } from './oddsLines';

function byKind(handlers: JobHandler[]): Record<string, JobHandler> {
  return Object.fromEntries(handlers.map((handler) => [handler.kind, handler]));
}

/** Every job kind the ingest Worker can run. */
export const HANDLERS: Record<string, JobHandler> = byKind([oddsLinesHandler]);

// `kind` comes from queue messages and job rows, so inherited keys such as
// 'constructor' must not resolve to a handler.
export function getHandler(kind: string): JobHandler | undefined {
  return Object.hasOwn(HANDLERS, kind) ? HANDLERS[kind] : undefined;
}

/**
 * Registers `handler` under its kind, replacing any handler already there,
 * and returns a function that restores the previous registration. Lets tests
 * inject fake handlers.
 */
export function registerHandler(handler: JobHandler): () => void {
  const previous = getHandler(handler.kind);
  HANDLERS[handler.kind] = handler;
  return () => {
    if (previous) HANDLERS[handler.kind] = previous;
    else delete HANDLERS[handler.kind];
  };
}
