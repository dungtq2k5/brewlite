import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PROTO_LOADER_OPTIONS } from './proto-loader-options.js';
import type { Caller } from './caller.js';

export interface GrpcClientOptions {
  /** Dot-separated, e.g. `brewlite.catalog.MenuService`. */
  serviceName: string;
  protoFiles: string[];
  includeDirs: string[];
  url: string;
}

const DEFAULT_DEADLINE_MS = 2000;

function resolveServiceCtor(
  definition: grpc.GrpcObject,
  dottedName: string,
): grpc.ServiceClientConstructor {
  const parts = dottedName.split('.');
  let current: unknown = definition;
  for (const part of parts) {
    current = (current as Record<string, unknown>)[part];
  }
  return current as grpc.ServiceClientConstructor;
}

/**
 * Every gRPC peer call goes through `.call()` — the **2 s deadline** (override per call,
 * never remove), the caller's `x-request-id` as metadata, and the returned generated proto
 * type only, never a DTO (conventions §2.2, §5.2).
 */
export abstract class BaseGrpcClient {
  private readonly client: grpc.Client;

  constructor(options: GrpcClientOptions) {
    const packageDefinition = protoLoader.loadSync(options.protoFiles, {
      ...PROTO_LOADER_OPTIONS,
      includeDirs: options.includeDirs,
    });
    const loaded = grpc.loadPackageDefinition(packageDefinition);
    const ServiceCtor = resolveServiceCtor(loaded, options.serviceName);
    this.client = new ServiceCtor(options.url, grpc.credentials.createInsecure());
  }

  protected call<Req, Res>(
    method: string,
    request: Req,
    opts?: { deadlineMs?: number; requestId?: string; caller?: Caller },
  ): Promise<Res> {
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      if (opts?.requestId) metadata.set('x-request-id', opts.requestId);
      if (opts?.caller?.kind === 'USER') {
        metadata.set('x-user-id', opts.caller.userId);
        metadata.set('x-user-role', opts.caller.role);
      }
      const deadline = new Date(Date.now() + (opts?.deadlineMs ?? DEFAULT_DEADLINE_MS));

      const callable = (
        this.client as unknown as Record<
          string,
          (
            req: Req,
            metadata: grpc.Metadata,
            options: grpc.CallOptions,
            callback: (error: grpc.ServiceError | null, response: Res) => void,
          ) => void
        >
      )[method];

      callable.call(this.client, request, metadata, { deadline }, (error, response) => {
        if (error) {
          reject(this.normalizeDeadlineError(error));
          return;
        }
        resolve(response);
      });
    });
  }

  /**
   * A stopped container does not refuse a connection; it goes silent until the deadline
   * (architecture §2.2). A call whose deadline passes on a channel that never reached
   * `READY` is rethrown as `UNAVAILABLE`, not `DEADLINE_EXCEEDED` — the peer is down, not slow.
   */
  private normalizeDeadlineError(error: grpc.ServiceError): grpc.ServiceError {
    if (error.code !== grpc.status.DEADLINE_EXCEEDED) return error;
    const state = this.client.getChannel().getConnectivityState(false);
    if (state === grpc.connectivityState.READY) return error;
    const rewritten = Object.create(error) as grpc.ServiceError;
    Object.assign(rewritten, { code: grpc.status.UNAVAILABLE });
    return rewritten;
  }
}
