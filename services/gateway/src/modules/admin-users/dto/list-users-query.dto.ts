import { createZodDto } from '@brewlite/nest-common';
import { ROLES, zBooleanParam, zPageQuery, zText } from '@brewlite/contracts';
import { z } from 'zod';

export const listUsersQuerySchema = zPageQuery(['createdAt', 'email'], '-createdAt')
  .extend({
    q: zText(100).optional(),
    role: z.enum(ROLES).optional(),
    locked: zBooleanParam.optional(),
    deleted: zBooleanParam.optional(),
  })
  .strict();
export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}
