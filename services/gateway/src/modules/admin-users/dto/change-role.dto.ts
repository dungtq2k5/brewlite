import { createZodDto } from '@brewlite/nest-common';
import { ROLES } from '@brewlite/contracts';
import { z } from 'zod';

export const changeRoleSchema = z.object({ role: z.enum(ROLES) }).strict();
export class ChangeRoleDto extends createZodDto(changeRoleSchema) {}
