import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';

export const firebaseSignInSchema = z.object({ idToken: z.string().min(1).max(4096) }).strict();
export class FirebaseSignInDto extends createZodDto(firebaseSignInSchema) {}
