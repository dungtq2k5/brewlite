import 'server-only';

// Server-only: a Client Component importing this fails the Next build, so a bearer token
// can never reach browser code (architecture §4.2). Forms use `@brewlite/api-client/zod`.
export * from './generated/endpoints/index.js';
export * from './generated/model/index.js';
export { configureApiClient, type ApiClientConfig } from './configure.js';
export { ApiClientError } from './api-client-error.js';
