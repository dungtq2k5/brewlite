#!/usr/bin/env node
// pnpm keys:dev — writes a local ES256 key pair into identity's and the gateway's .env
// files. Never overwrites a key already set, never touches .env.example (conventions
// §12: secrets are never defaulted).
import { createHash, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDENTITY_ENV = join(REPO_ROOT, 'services/identity/.env');
const GATEWAY_ENV = join(REPO_ROOT, 'services/gateway/.env');

function readEnvFile(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function hasNonEmptyValue(content, key) {
  const match = new RegExp(`^${key}=(.*)$`, 'm').exec(content);
  return Boolean(match && match[1].trim() !== '');
}

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, 'm').test(content)) {
    return content.replace(new RegExp(`^${key}=.*$`, 'm'), line);
  }
  const withNewline = content.length > 0 && !content.endsWith('\n') ? `${content}\n` : content;
  return `${withNewline}${line}\n`;
}

function main() {
  const identityEnv = readEnvFile(IDENTITY_ENV);
  if (hasNonEmptyValue(identityEnv, 'JWT_PRIVATE_KEY')) {
    console.log('keys already present');
    return;
  }

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateB64 = Buffer.from(privatePem, 'utf8').toString('base64');
  const publicB64 = Buffer.from(publicPem, 'utf8').toString('base64');
  const keyId = `dev-${createHash('sha256').update(publicPem).digest('hex').slice(0, 8)}`;

  let nextIdentityEnv = setEnvValue(identityEnv, 'JWT_PRIVATE_KEY', privateB64);
  nextIdentityEnv = setEnvValue(nextIdentityEnv, 'JWT_KEY_ID', keyId);
  writeFileSync(IDENTITY_ENV, nextIdentityEnv);

  const gatewayEnv = readEnvFile(GATEWAY_ENV);
  writeFileSync(GATEWAY_ENV, setEnvValue(gatewayEnv, 'JWT_PUBLIC_KEY', publicB64));

  console.log('wrote JWT_PRIVATE_KEY, JWT_KEY_ID to services/identity/.env');
  console.log('wrote JWT_PUBLIC_KEY to services/gateway/.env');
}

main();
