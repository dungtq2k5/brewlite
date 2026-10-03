/**
 * Signs a fake user into the **Auth emulator** and returns a real ID token — used by
 * `firebase:dev-token` (a human at a terminal) and the integration suite (checks 2–5),
 * so both exercise the real `verifyIdToken`, not a mock. Refuses without
 * `FIREBASE_AUTH_EMULATOR_HOST` — this must never run against a real project
 * (architecture §5).
 */
export interface EmulatorTokenOptions {
  provider: 'google.com' | 'apple.com';
  email: string;
  emailVerified?: boolean;
  name?: string | null;
}

export async function getEmulatorIdToken(options: EmulatorTokenOptions): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST must be set to sign in against the emulator');
  }

  const { provider, email, emailVerified = true, name = null } = options;
  const fakeOidcClaims = {
    sub: `dev-${email}`,
    email,
    email_verified: emailVerified,
    ...(name !== null ? { name } : {}),
  };
  const postBody = `id_token=${encodeURIComponent(JSON.stringify(fakeOidcClaims))}&providerId=${provider}`;

  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody,
        requestUri: 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    },
  );

  const data = (await res.json()) as { idToken?: string; error?: { message?: string } };
  if (!res.ok || data.idToken === undefined) {
    throw new Error(`emulator signInWithIdp failed: ${data.error?.message ?? res.statusText}`);
  }
  return data.idToken;
}
