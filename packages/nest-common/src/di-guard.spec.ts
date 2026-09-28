import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

/**
 * The DI trap guard (conventions §2): a class injected through a
 * constructor must not become `import type`, or its metadata becomes `Object` and Nest
 * injects `undefined`. This boots a real module and checks the dependency actually
 * arrived — a config regression here fails this test, not a production boot.
 */
@Injectable()
class Dependency {
  readonly value = 'real-instance';
}

@Injectable()
class Consumer {
  constructor(readonly dependency: Dependency) {}
}

@Module({ providers: [Dependency, Consumer] })
class DiGuardModule {}

describe('Nest DI (constructor injection of a class)', () => {
  it('resolves the injected class, not undefined', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DiGuardModule] }).compile();
    const consumer = moduleRef.get(Consumer);
    expect(consumer.dependency).toBeInstanceOf(Dependency);
    expect(consumer.dependency.value).toBe('real-instance');
  });
});
