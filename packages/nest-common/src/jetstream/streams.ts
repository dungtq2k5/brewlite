import { nanos, RetentionPolicy, StorageType, type JetStreamManager } from 'nats';
import { STREAMS, type StreamDefinition } from '@brewlite/contracts';

const COMPARED_FIELDS = ['subjects', 'max_age', 'duplicate_window', 'storage'] as const;

function toStreamConfig(def: StreamDefinition) {
  return {
    name: def.name,
    subjects: [...def.subjects],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    max_age: nanos(def.maxAgeMs),
    duplicate_window: nanos(def.duplicateWindowMs),
  };
}

/**
 * `names` are the `STREAMS` entries this process touches. Missing → create; present →
 * verify `subjects`/`max_age`/`duplicate_window`/`storage` match, throwing at boot on any
 * difference — a changed stream config is a decision made by hand, never a deploy
 * side effect (architecture §2.3).
 */
export async function ensureStreams(jsm: JetStreamManager, names: string[]): Promise<void> {
  for (const name of names) {
    const def = STREAMS.find((s) => s.name === name);
    if (!def) throw new Error(`ensureStreams: unknown stream "${name}" — not in STREAMS`);
    const wanted = toStreamConfig(def);

    let existing;
    try {
      existing = await jsm.streams.info(name);
    } catch (error) {
      if (error instanceof Error && error.message.includes('stream not found')) {
        await jsm.streams.add(wanted);
        continue;
      }
      throw error;
    }

    for (const field of COMPARED_FIELDS) {
      const have = existing.config[field];
      const want = wanted[field];
      const same = Array.isArray(want)
        ? JSON.stringify(have) === JSON.stringify(want)
        : have === want;
      if (!same) {
        throw new Error(
          `ensureStreams: stream "${name}" field "${field}" differs — has ${JSON.stringify(have)}, wants ${JSON.stringify(want)}`,
        );
      }
    }
  }
}
