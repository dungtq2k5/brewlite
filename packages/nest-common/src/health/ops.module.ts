import {
  Controller,
  type DynamicModule,
  Get,
  Inject,
  type InjectionToken,
  Module,
  Res,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SkipEnvelope } from '../http/skip-envelope.decorator.js';
import type { ReadinessCheck } from './readiness.js';

const READINESS_CHECKS = 'BREWLITE_READINESS_CHECKS';
const PACKAGE_JSON_DIR = 'BREWLITE_PACKAGE_JSON_DIR';

/**
 * Walks up from `startDir` to find the nearest `package.json` — depth-agnostic, so it
 * works the same regardless of how many directories separate the compiled entry point
 * from the service root.
 */
function findPackageJson(startDir: string): { name?: string; version?: string } {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, 'utf8'));
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No package.json found above ${startDir}`);
    dir = parent;
  }
}

/**
 * `GET /health`, `GET /health/ready`, `GET /version` — all `VERSION_NEUTRAL`,
 * `@SkipEnvelope()`, excluded from the global prefix. Backend services serve them on
 * `OPS_PORT`; the gateway serves them on its own `PORT` and opens no second listener
 * (impl doc 01 §6.5).
 */
@ApiExcludeController()
@Controller()
class OpsController {
  private readonly pkg: { name?: string; version?: string };

  constructor(
    @Inject(READINESS_CHECKS) private readonly checks: ReadinessCheck[],
    @Inject(PACKAGE_JSON_DIR) packageJsonDir: string,
    private readonly config: ConfigService,
  ) {
    this.pkg = findPackageJson(packageJsonDir);
  }

  @Get('health')
  @Version(VERSION_NEUTRAL)
  @SkipEnvelope()
  health() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  @Version(VERSION_NEUTRAL)
  @SkipEnvelope()
  async ready(@Res({ passthrough: true }) res: Response) {
    const results = await Promise.all(this.checks.map((check) => check()));
    const ok = results.every(Boolean);
    res.status(ok ? 200 : 503);
    return { status: ok ? 'ok' : 'unavailable' };
  }

  @Get('version')
  @Version(VERSION_NEUTRAL)
  @SkipEnvelope()
  version() {
    return {
      service: this.pkg.name ?? 'unknown',
      version: this.pkg.version ?? 'unknown',
      gitSha: this.config.get<string>('GIT_SHA', 'unknown'),
      builtAt: this.config.get<string>('BUILT_AT', 'unknown'),
    };
  }
}

/**
 * `packageJsonDir` — pass the calling service's own `__dirname` (from `app.module.ts`);
 * CJS output has `__dirname` natively (architecture §1, ADR 0012). `findPackageJson`
 * walks up from there, so the caller never has to count directory levels.
 */
@Module({})
export class OpsModule {
  static forRoot(options: {
    packageJsonDir: string;
    readinessChecks?: ReadinessCheck[];
  }): DynamicModule {
    return {
      module: OpsModule,
      controllers: [OpsController],
      providers: [
        { provide: READINESS_CHECKS, useValue: options.readinessChecks ?? [] },
        { provide: PACKAGE_JSON_DIR, useValue: options.packageJsonDir },
      ],
    };
  }

  /** For a service whose readiness checks need DI (e.g. a Prisma `SELECT 1`). */
  static forRootAsync(options: {
    packageJsonDir: string;
    inject?: InjectionToken[];
    useFactory: (...args: never[]) => ReadinessCheck[] | Promise<ReadinessCheck[]>;
  }): DynamicModule {
    return {
      module: OpsModule,
      controllers: [OpsController],
      providers: [
        { provide: READINESS_CHECKS, useFactory: options.useFactory, inject: options.inject ?? [] },
        { provide: PACKAGE_JSON_DIR, useValue: options.packageJsonDir },
      ],
    };
  }
}
