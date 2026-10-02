import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';

export const setAvailabilitySchema = z.object({ isAvailable: z.boolean() }).strict();
export class SetAvailabilityDto extends createZodDto(setAvailabilitySchema) {}
