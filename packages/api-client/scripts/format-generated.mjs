// Orval's output is not Prettier-formatted; format it with the repo's own config
// (`resolveConfig()` — `filepath` alone would silently use Prettier's built-in defaults).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';

const root = new URL('../src/generated', import.meta.url).pathname;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (path.endsWith('.ts')) yield path;
  }
}

for (const path of files(root)) {
  const config = await resolveConfig(path);
  const source = readFileSync(path, 'utf8');
  const formatted = await format(source, { ...config, filepath: path });
  if (formatted !== source) writeFileSync(path, formatted);
}
