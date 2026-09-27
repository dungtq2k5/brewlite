/** A dependency the service declares for `/health/ready` — never a gRPC peer (api-endpoints-plan §11). */
export type ReadinessCheck = () => Promise<boolean>;
