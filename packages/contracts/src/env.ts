import { z } from 'zod';

/** `NODE_ENV` for every env schema — the five services' and the web app's. */
export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];
export const zNodeEnv = z.enum(NODE_ENVS).default('development');
