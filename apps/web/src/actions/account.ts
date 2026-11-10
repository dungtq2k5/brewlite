'use server';

import { usersControllerChangePassword, usersControllerUpdate } from '@brewlite/api-client';
import { FULL_NAME_MAX_LENGTH } from '@brewlite/contracts';
import { validateNewPassword } from '@/lib/validate-auth';
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

/**
 * Sets the caller's password (api §1.2) — `currentPassword` when the account has one, none for a
 * Google-only account's first. `204` → ok; every other session is signed out by identity, this one
 * stays. `CURRENT_PASSWORD_INCORRECT` and `RATE_LIMITED` come back as codes for the form.
 */
export async function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
}): Promise<ActionResult> {
  if (validateNewPassword(input.newPassword)) return { ok: false, code: 'VALIDATION_FAILED' };
  const result = await toResult(() =>
    usersControllerChangePassword({
      ...(input.currentPassword !== undefined && { currentPassword: input.currentPassword }),
      newPassword: input.newPassword,
    }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}
