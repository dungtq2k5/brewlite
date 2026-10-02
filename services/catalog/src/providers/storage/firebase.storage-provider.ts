import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type AppOptions } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { Env } from '../../config/env.schema.js';

/** The only file that imports `firebase-admin` (conventions §2.3). */
@Injectable()
export class FirebaseStorageProvider {
  constructor(config: ConfigService<Env, true>) {
    if (getApps().length === 0) {
      const credentialsPath = config.get('GOOGLE_APPLICATION_CREDENTIALS', { infer: true });
      const options: AppOptions = {
        projectId: config.get('FIREBASE_PROJECT_ID', { infer: true }),
        storageBucket: config.get('FIREBASE_STORAGE_BUCKET', { infer: true }),
      };
      // Against the emulator neither GOOGLE_APPLICATION_CREDENTIALS nor a real bucket
      // dial is needed — the SDK rejects an explicit `credential: undefined`, so it is
      // omitted entirely rather than passed (found in 03a, mirrored from the Auth provider).
      // Truthy, not `!== undefined`: ConfigService falls back to the raw `process.env` "" when
      // the schema maps an empty value to undefined.
      if (credentialsPath) options.credential = cert(credentialsPath);
      initializeApp(options);
    }
  }

  async save(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await getStorage()
      .bucket()
      .file(path)
      .save(Buffer.from(bytes), { contentType, resumable: false });
  }

  async delete(path: string): Promise<void> {
    await getStorage().bucket().file(path).delete({ ignoreNotFound: true });
  }
}
