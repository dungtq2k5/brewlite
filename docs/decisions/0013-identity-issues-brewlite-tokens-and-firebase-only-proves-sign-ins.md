# 0013 — Identity issues BrewLite's tokens; Firebase Auth only proves Google and Apple sign-ins

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

The course rubric is explicit: `POST /auth/register` and `POST /auth/login`, passwords hashed with **bcrypt**, a **JWT** issued, and a guard protecting the order routes. The team also wants *Continue with Google* and *Continue with Apple*, through Firebase Authentication.

Firebase could handle everything, email and password included — but then there is no bcrypt of ours, no JWT of ours, and every service would verify Firebase's tokens and depend on Google's key endpoint. Two identity systems side by side, each issuing its own session, would be worse.

## Decision

- **identity is the only issuer of BrewLite sessions**, whatever the sign-in method.
- **Email + password is BrewLite's own.** Passwords are hashed with **bcrypt** (`bcryptjs`, pure JavaScript, cost 12). bcrypt reads at most 72 bytes, so a password is 8–72 **bytes**, checked in bytes. An unknown email still runs one compare against a dummy hash, so timing does not reveal accounts. argon2id was considered and is the stronger KDF; bcrypt is chosen because the rubric names it and it is adequate at cost 12.
- **Google and Apple go through Firebase Auth only to prove identity.** The web app gets a Firebase ID token and calls `POST /auth/firebase`; identity verifies it with `firebase-admin` (`verifyIdToken`), requires provider `google.com` or `apple.com` and a verified email, then finds the user by `firebase_uid`, else by email, else creates a `CUSTOMER`. BrewLite tokens are returned; the web app signs out of Firebase.
- **Linking by email clears an existing password.** If a Google or Apple sign-in matches a password account by email, the account is linked, its **password is removed and its sessions revoked**. BrewLite never verifies email addresses for password accounts, so someone could pre-register a victim's address; the provider's verified email is the stronger proof, and the pre-registered password must not survive it.
- **Access token:** JWT, **ES256**, 15 minutes, signed by identity's private key and verified by the gateway with the public key only. Claims: `sub`, `role`, `sid`, `iss`, `aud`, `exp`.
- **Refresh token:** 32 random bytes, stored only as a SHA-256 hash, 30 days ([0014](./0014-the-web-server-is-the-gateways-only-client.md) on rotation).

## Consequences

- One token format across every service, whatever the sign-in method; Firebase appears in exactly one service and one login page.
- The Firebase Auth emulator gives fake Google and Apple accounts locally; no real Google project is needed to develop.
- **Cost:** two sign-in paths to build and test, and an account-linking rule to get right.
- **Cost:** a password user who later signs in with Google loses their password — stated in the UI, deliberate.
- **Cost:** no email verification and no password reset for password accounts in P0; a forgotten password is recovered by signing in with Google or Apple.
- **Cost:** Apple sign-in needs a paid Apple Developer account; it is P1.

## See also

- [0014](./0014-the-web-server-is-the-gateways-only-client.md) — where the tokens are stored and refreshed.
- [0016](./0016-three-fixed-roles-and-a-compile-time-permission-catalogue.md) — what the `role` claim grants.
