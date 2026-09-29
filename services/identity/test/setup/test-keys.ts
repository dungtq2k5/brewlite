import { generateKeyPairSync } from 'node:crypto';

/** A fresh P-256 pair per test run — never a committed key, not even a test one. */
export function generateTestKeyPair(): { privateKeyBase64: string; keyId: string } {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    privateKeyBase64: Buffer.from(privatePem, 'utf8').toString('base64'),
    keyId: 'test-key',
  };
}
