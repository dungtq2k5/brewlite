import type { ActionResult } from './action-result';
import type { Locale } from '@/i18n/locale';

export interface AuthUserSummary {
  id: string;
  email: string;
  fullName: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  preferredLocale: Locale;
}

export interface AuthSuccess {
  redirectTo: string;
  user: AuthUserSummary;
}

export interface LoginInput {
  email: string;
  password: string;
  next?: string;
}

export interface RegisterInput extends LoginInput {
  fullName: string;
  preferredLocale?: Locale;
}

export type AuthResult = ActionResult<AuthSuccess>;
