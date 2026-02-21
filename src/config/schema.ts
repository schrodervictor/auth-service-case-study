import { z } from 'zod';

const serverSchema = z.object({
    port: z.number().default(9000),
});

const databaseSchema = z.object({
    host: z.string(),
    port: z.number().default(5432),
    name: z.string(),
});

const accessTokenSchema = z.object({
    expiresIn: z.string().default('15m'),
});

const refreshTokenSchema = z.object({
    expiresIn: z.string().default('7d'),
});

const authSchema = z.object({
    accessToken: accessTokenSchema.default({ expiresIn: '15m' }),
    refreshToken: refreshTokenSchema.default({ expiresIn: '7d' }),
});

const ssmParametersSchema = z.object({
    jwtSecret: z.string(),
    databaseUser: z.string(),
    databasePassword: z.string(),
});

const ssmSchema = z.object({
    region: z.string(),
    parameters: ssmParametersSchema,
});

export const configSchema = z.object({
    server: serverSchema.default({ port: 9000 }),
    database: databaseSchema,
    auth: authSchema.default({
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
    }),
    ssm: ssmSchema.optional(),
});

export type AppConfig = z.infer<typeof configSchema>;
