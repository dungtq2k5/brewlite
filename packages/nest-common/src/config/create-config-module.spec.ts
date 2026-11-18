import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createConfigModule } from './create-config-module.js';

class Exited extends Error {}

describe('createConfigModule', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exposes the PARSED environment (defaults and coercion applied) globally', async () => {
    const schema = z.object({
      LOG_LEVEL: z.string(),
      BREWLITE_CFG_TEST_PORT: z.coerce.number().default(4321),
    });
    const moduleRef = await Test.createTestingModule({
      imports: [createConfigModule(schema)],
    }).compile();
    const config = moduleRef.get(ConfigService);

    expect(config.get('LOG_LEVEL')).toBe('silent');
    expect(config.get('BREWLITE_CFG_TEST_PORT')).toBe(4321);
    await moduleRef.close();
  });

  it('prints one line per bad variable and EXITS with 1', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Exited();
    });
    const schema = z.object({
      BREWLITE_CFG_TEST_MISSING: z.string(),
      LOG_LEVEL: z.enum(['fatal']),
    });

    await expect(createConfigModule(schema)).rejects.toBeInstanceOf(Exited);

    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledOnce();
    const [message] = error.mock.calls[0] as [string];
    const lines = message.split('\n');
    expect(lines[0]).toBe('Invalid environment:');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^ {2}BREWLITE_CFG_TEST_MISSING: /);
    expect(lines[2]).toMatch(/^ {2}LOG_LEVEL: /);
  });
});
