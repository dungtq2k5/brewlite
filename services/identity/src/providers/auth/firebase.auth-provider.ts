import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type AppOptions } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { normalizeEmail } from '@brewlite/contracts';
import { rpcError } from '@brewlite/nest-common';
import type { Env } from '../../config/env.schema.js';

export interface VerifiedFirebaseToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  provider: string;
  name: string | null;
}

/** The only file that imports `firebase-admin` (conventions §2.3). */
@Injectable()
export class FirebaseAuthProvider {
  private readonly logger = new Logger(FirebaseAuthProvider.name);

  constructor(config: ConfigService<Env, true>) {
    if (getApps().length === 0) {
      const credentialsPath = config.get('GOOGLE_APPLICATION_CREDENTIALS', { infer: true });
      const options: AppOptions = { projectId: config.get('FIREBASE_PROJECT_ID', { infer: true }) };
      // `cert()` reads the file itself; against the emulator neither is set, and the SDK
      // rejects an explicit `credential: undefined` as an invalid option — omitted
      // entirely, it never dials a real Google service (conventions §9.3).
      if (credentialsPath !== undefined) options.credential = cert(credentialsPath);
      initializeApp(options);
    }
  }

  async verify(idToken: string): Promise<VerifiedFirebaseToken> {
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      // Never log the token itself — only that verification failed (conventions §9.3).
      this.logger.warn(`Firebase token verification failed: ${(error as Error).message}`);
      throw rpcError('FIREBASE_TOKEN_INVALID', { reason: 'INVALID' });
    }
    return {
      uid: decoded.uid,
      email: normalizeEmail(decoded.email ?? ''),
      emailVerified: decoded.email_verified ?? false,
      provider: (decoded.firebase as { sign_in_provider: string }).sign_in_provider,
      name: typeof decoded.name === 'string' ? decoded.name : null,
    };
  }
}
