import { z } from 'zod';

export const secretsSchema = z.object({
    jwtSecret: z.string().min(1),
    databaseUser: z.string().min(1),
    databasePassword: z.string().min(1),
}).strip();

export type AppSecrets = z.infer<typeof secretsSchema>;
