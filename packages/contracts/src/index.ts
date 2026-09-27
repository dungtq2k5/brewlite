// The client-safe barrel — the web app imports this. Generated gRPC code (which pulls in
// @nestjs/microservices and @grpc/grpc-js) is backend-only and is imported by its own path
// (`@brewlite/contracts/generated/...`), never re-exported here (conventions §3.2).
export * from './errors.js';
export * from './ids.js';
export * from './limits.js';
export * from './localized-text.js';
