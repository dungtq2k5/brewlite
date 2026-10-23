import { PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES, zEmail } from '@brewlite/contracts';

/** An `auth:validation.<key>` — the form renders it through `t()`. */
export type FieldErrorKey =
  'emailInvalid' | 'passwordEmpty' | 'passwordTooShort' | 'passwordTooLong' | 'fullNameEmpty';

export type FieldErrors = Partial<Record<'email' | 'password' | 'fullName', FieldErrorKey>>;

const bytes = (s: string) => new TextEncoder().encode(s).length;
const orUndefined = (errors: FieldErrors) => (Object.keys(errors).length > 0 ? errors : undefined);

function emailError(email: string): FieldErrorKey | undefined {
  return zEmail.safeParse(email).success ? undefined : 'emailInvalid';
}

/** Sign-in: only shape — whether the password is *right* is the API's `INVALID_CREDENTIALS`. */
export function validateLogin(input: { email: string; password: string }): FieldErrors | undefined {
  const errors: FieldErrors = {};
  const email = emailError(input.email);
  if (email) errors.email = email;
  if (input.password === '') errors.password = 'passwordEmpty';
  return orUndefined(errors);
}

/** Register: the password rule counts **bytes**, as `zPassword` does (bcrypt's limit). */
export function validateRegister(input: {
  email: string;
  password: string;
  fullName: string;
}): FieldErrors | undefined {
  const errors: FieldErrors = {};
  if (input.fullName.trim() === '') errors.fullName = 'fullNameEmpty';
  const email = emailError(input.email);
  if (email) errors.email = email;
  const size = bytes(input.password);
  if (input.password === '') errors.password = 'passwordEmpty';
  else if (size < PASSWORD_MIN_BYTES) errors.password = 'passwordTooShort';
  else if (size > PASSWORD_MAX_BYTES) errors.password = 'passwordTooLong';
  return orUndefined(errors);
}
