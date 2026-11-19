import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server as NetServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Role } from '@brewlite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BaseGrpcClient } from './base-grpc.client.js';
import type { Caller } from './caller.js';
import { PROTO_LOADER_OPTIONS } from './proto-loader-options.js';

// Everything listens on 127.0.0.1:0 — an ephemeral port, never one a service or a contract spec owns.
const PROTO = `
syntax = "proto3";
package brewlite.test;
message EchoRequest { string text = 1; int32 delay_ms = 2; bool missing = 3; }
message EchoReply { string text = 1; string request_id = 2; string user_id = 3; string user_role = 4; }
service EchoService { rpc Echo (EchoRequest) returns (EchoReply); }
`;

interface EchoRequest {
  text: string;
  delayMs?: number;
  missing?: boolean;
}
interface EchoReply {
  text: string;
  requestId: string;
  userId: string;
  userRole: string;
}

class EchoClient extends BaseGrpcClient {
  echo(req: EchoRequest, opts?: { deadlineMs?: number; requestId?: string; caller?: Caller }) {
    return this.call<EchoRequest, EchoReply>('echo', req, opts);
  }
}

let dir: string;
let server: grpc.Server;
let readyUrl: string;
let silent: NetServer;
let silentUrl: string;
const sockets: Socket[] = [];

const client = (url: string) =>
  new EchoClient({
    serviceName: 'brewlite.test.EchoService',
    protoFiles: ['echo.proto'],
    includeDirs: [dir],
    url,
  });

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'brewlite-grpc-'));
  writeFileSync(join(dir, 'echo.proto'), PROTO);
  const pkg = grpc.loadPackageDefinition(
    protoLoader.loadSync('echo.proto', { ...PROTO_LOADER_OPTIONS, includeDirs: [dir] }),
  ) as unknown as { brewlite: { test: { EchoService: grpc.ServiceClientConstructor } } };

  server = new grpc.Server();
  server.addService(pkg.brewlite.test.EchoService.service, {
    echo: (
      call: grpc.ServerUnaryCall<EchoRequest, EchoReply>,
      callback: grpc.sendUnaryData<EchoReply>,
    ) => {
      if (call.request.missing) {
        callback({ code: grpc.status.NOT_FOUND, details: 'no such thing' });
        return;
      }
      const header = (key: string) => String(call.metadata.get(key)[0] ?? '');
      setTimeout(
        () =>
          callback(null, {
            text: call.request.text,
            requestId: header('x-request-id'),
            userId: header('x-user-id'),
            userRole: header('x-user-role'),
          }),
        call.request.delayMs ?? 0,
      );
    },
  });
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, p) =>
      err ? reject(err) : resolve(p),
    ),
  );
  readyUrl = `127.0.0.1:${port}`;

  // A stopped container: it accepts the TCP connection and then says nothing, ever.
  silent = createServer((socket) => sockets.push(socket));
  await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
  silentUrl = `127.0.0.1:${(silent.address() as { port: number }).port}`;
});

afterAll(async () => {
  server.forceShutdown();
  sockets.forEach((s) => s.destroy());
  await new Promise((resolve) => silent.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

describe('BaseGrpcClient', () => {
  it('sends the request id and a USER caller as metadata', async () => {
    const reply = await client(readyUrl).echo(
      { text: 'hi' },
      {
        requestId: 'req-1',
        caller: { kind: 'USER', userId: '0190b5a0-0000-7000-8000-000000000001', role: Role.STAFF },
      },
    );
    expect(reply).toEqual({
      text: 'hi',
      requestId: 'req-1',
      userId: '0190b5a0-0000-7000-8000-000000000001',
      userRole: 'STAFF',
    });
  });

  it('sends NO user metadata for a non-USER caller', async () => {
    const reply = await client(readyUrl).echo({ text: 'hi' }, { caller: { kind: 'SYSTEM' } });
    expect(reply).toMatchObject({ requestId: '', userId: '', userRole: '' });
  });

  it('passes a peer’s error through unchanged', async () => {
    await expect(client(readyUrl).echo({ text: 'x', missing: true })).rejects.toMatchObject({
      code: grpc.status.NOT_FOUND,
      details: 'no such thing',
    });
  });

  it('keeps DEADLINE_EXCEEDED when the peer is up but SLOW', async () => {
    const c = client(readyUrl);
    await c.echo({ text: 'warm-up' }); // the channel is READY
    await expect(c.echo({ text: 'x', delayMs: 500 }, { deadlineMs: 100 })).rejects.toMatchObject({
      code: grpc.status.DEADLINE_EXCEEDED,
    });
  });

  it('turns a deadline on a channel that never got READY into UNAVAILABLE — the peer is DOWN', async () => {
    const error = await client(silentUrl)
      .echo({ text: 'x' }, { deadlineMs: 200 })
      .catch((e: grpc.ServiceError) => e);
    expect(error).toMatchObject({ code: grpc.status.UNAVAILABLE });
    expect(error).toBeInstanceOf(Error);
  });
});
