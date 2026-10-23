import 'server-only';
import { cache } from 'react';
import { ApiClientError, usersControllerGet, type MeResponseDto } from '@brewlite/api-client';
import './api';
import { hasSession } from './session';
import { withRequestId } from './with-request-id';

/**
 * The signed-in user, or `null` for a guest. One call per request (React `cache()`). A `401`
 * means the session died between the proxy and the render — treated as a guest.
 */
export const getMe = cache(async (): Promise<MeResponseDto | null> => {
  if (!(await hasSession())) return null;
  try {
    const res = await usersControllerGet();
    return res.status === 200 ? (res.data.data ?? null) : null;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null;
    throw withRequestId(error);
  }
});
