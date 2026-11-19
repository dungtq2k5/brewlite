import type { IncomingMessage } from 'node:http';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PARAMS_PROVIDER_TOKEN, type Params } from 'nestjs-pino';
import type { Options } from 'pino-http';
import { describe, expect, it } from 'vitest';
import { runWithRequestId } from '../grpc/request-context.js';
import { BrewliteLoggerModule } from './logger.module.js';

/** The pino-http options `BrewliteLoggerModule` builds from the service's config. */
async function pinoOptions(): Promise<Options> {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), BrewliteLoggerModule],
  }).compile();
  const params = moduleRef.get<Params>(PARAMS_PROVIDER_TOKEN);
  await moduleRef.close();
  return params.pinoHttp as Options;
}

describe('BrewliteLoggerModule', () => {
  it('takes its level from LOG_LEVEL', async () => {
    expect((await pinoOptions()).level).toBe('silent'); // the preset's LOG_LEVEL
  });

  it('REDACTS credentials and secrets', async () => {
    const { redact } = await pinoOptions();
    expect(redact).toMatchObject({ censor: '[redacted]' });
    expect((redact as { paths: string[] }).paths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.refreshToken',
      ]),
    );
  });

  it('uses the request id the middleware already set as the HTTP request id', async () => {
    const { genReqId } = await pinoOptions();
    const req = { id: 'req-123' } as unknown as IncomingMessage;
    expect(genReqId!(req, {} as never)).toBe('req-123');
  });

  it('mixes the bound requestId into every line, and nothing outside a request', async () => {
    const mixin = (await pinoOptions()).mixin as () => object;
    expect(runWithRequestId('rpc-42', () => mixin())).toEqual({ requestId: 'rpc-42' });
    expect(mixin()).toEqual({});
  });
});
