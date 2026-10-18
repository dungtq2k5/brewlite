import { baseConfig } from '@brewlite/config/eslint.config.mjs';
import { globalIgnores } from 'eslint/config';

export default [...baseConfig, globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])];
