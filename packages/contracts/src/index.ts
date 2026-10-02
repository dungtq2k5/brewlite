// The client-safe barrel — the web app imports this. Generated gRPC code (which pulls in
// @nestjs/microservices and @grpc/grpc-js) is backend-only and is imported by its own path
// (`@brewlite/contracts/generated/...`), never re-exported here (conventions §3.2).
export * from './errors.js';
export * from './error-details.js';
export * from './enums.js';
export * from './access.js';
export * from './rate-limits.js';
export * from './constants.js';
export * from './text.js';
export * from './ids.js';
export * from './localized-text.js';
export * from './paging.js';
export * from './pricing/compute-unit-price.js';
export * from './pricing/compute-order-totals.js';
export * from './order-lifecycle.js';
export * from './events/ordering.events.js';
export * from './events/payment.events.js';
export * from './events/streams.js';
export * from './order-item-toppings.js';
