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

const redisSchema = z.object({
    host: z.string().default('redis'),
    port: z.number().default(6379),
    password: z.string().optional(),
});

const rateLimitEndpointSchema = z.object({
    maxAttempts: z.number(),
    windowSeconds: z.number(),
});

const rateLimitSchema = z.object({
    login: rateLimitEndpointSchema.default({
        maxAttempts: 5,
        windowSeconds: 900,
    }),
    refresh: rateLimitEndpointSchema.default({
        maxAttempts: 10,
        windowSeconds: 900,
    }),
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

const eventbusSchema = z.object({
    mode: z.enum(['real', 'emulated']).default('real'),
    outputPath: z.string().optional(),
});

export const configSchema = z.object({
    server: serverSchema.default({ port: 9000 }),
    database: databaseSchema,
    auth: authSchema.default({
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
    }),
    redis: redisSchema.default({ host: 'redis', port: 6379 }),
    rateLimit: rateLimitSchema.default({
        login: { maxAttempts: 5, windowSeconds: 900 },
        refresh: { maxAttempts: 10, windowSeconds: 900 },
    }),
    ssm: ssmSchema.optional(),
    eventbus: eventbusSchema.default({ mode: 'real' }),
});

export type AppConfig = z.infer<typeof configSchema>;
