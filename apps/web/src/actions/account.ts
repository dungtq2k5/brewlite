'use server';

import { usersControllerUpdate } from '@brewlite/api-client';
import { FULL_NAME_MAX_LENGTH } from '@brewlite/contracts';
import { toResult, type ActionResult } from '@/lib/action-result';
import '@/lib/api';

/** Saves the profile's name. The email is read-only; the language is saved by the header's switch. */
export async function updateProfile(fullName: string): Promise<ActionResult> {
  const name = fullName.trim();
  if (name === '' || name.length > FULL_NAME_MAX_LENGTH) {
    return { ok: false, code: 'VALIDATION_FAILED' };
  }
  const result = await toResult(() => usersControllerUpdate({ fullName: name }));
  return result.ok ? { ok: true, data: undefined } : result;
}
