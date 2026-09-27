import { ConfigModule, type ConfigModuleOptions } from '@nestjs/config';
import type { ZodType } from 'zod';

/**
 * Validates the environment with the service's zod schema at boot — one line per bad
 * variable, process exits before listening (conventions §12).
 */
export function createConfigModule<Schema extends ZodType>(schema: Schema) {
  return ConfigModule.forRoot({
    isGlobal: true,
    validate: (config: Record<string, unknown>): Record<string, unknown> => {
      const result = schema.safeParse(config);
      if (!result.success) {
        const lines = result.error.issues.map(
          (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
        );
        console.error(`Invalid environment:\n${lines.join('\n')}`);
        process.exit(1);
      }
      return result.data as Record<string, unknown>;
    },
  } satisfies ConfigModuleOptions);
}
