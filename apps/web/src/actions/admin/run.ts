import 'server-only';
import '@/lib/api';
import { toResult, type ActionResult } from '@/lib/action-result';

/**
 * The admin actions' shared plumbing (not itself an action file): a call to the API becomes an
 * `ActionResult` — a refusal is a value the screen reads, never a throw (conventions §11.1). The
 * generated client throws on every non-2xx, so a response here is always a success whose body is
 * `{ data }`.
 */
export async function run<T>(call: () => Promise<unknown>): Promise<ActionResult<T>> {
  const result = await toResult(call);
  if (!result.ok) return result;
  const data = (result.data as { data?: { data?: T } }).data?.data;
  return data === undefined ? { ok: false, code: 'INTERNAL' } : { ok: true, data };
}

/** For routes that answer with nothing worth reading (a delete). */
export async function runVoid(call: () => Promise<unknown>): Promise<ActionResult> {
  const result = await toResult(call);
  return result.ok ? { ok: true, data: undefined } : result;
}
