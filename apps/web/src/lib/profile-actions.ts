'use server';

import { usersControllerUpdate, type MeResponseDto } from '@brewlite/api-client';
import { FULL_NAME_MAX_LENGTH } from '@brewlite/contracts';
import { revalidatePath } from 'next/cache';
import { actionFailure, type ActionResult } from './action-result';
import { unwrap } from './api-server';

type Locale = 'vi' | 'en';

export async function updateProfileAction(input: {
  fullName: string;
  preferredLocale: Locale;
}): Promise<ActionResult<MeResponseDto>> {
  const fullName = typeof input?.fullName === 'string' ? input.fullName.trim() : '';
  const preferredLocale = input?.preferredLocale;
  if (
    fullName.length === 0 ||
    fullName.length > FULL_NAME_MAX_LENGTH ||
    (preferredLocale !== 'vi' && preferredLocale !== 'en')
  ) {
    return { ok: false, code: 'VALIDATION_FAILED', details: {} };
  }

  try {
    const response = await usersControllerUpdate({ fullName, preferredLocale });
    revalidatePath('/account');
    return { ok: true, data: unwrap<MeResponseDto>(response.data) };
  } catch (error) {
    return actionFailure(error);
  }
}
