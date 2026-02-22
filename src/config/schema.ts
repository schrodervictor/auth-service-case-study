import { z } from 'zod';

const serverSchema = z.object({
    port: z.number(),
});

const databaseSchema = z.object({
    host: z.string(),
    port: z.number(),
    name: z.string(),
});

const accessTokenSchema = z.object({
    expiresIn: z.string(),
});

const refreshTokenSchema = z.object({
    expiresIn: z.string(),
});

const resetKeySchema = z.object({
    expiresIn: z.string(),
});

const authSchema = z.object({
    accessToken: accessTokenSchema,
    refreshToken: refreshTokenSchema,
    resetKey: resetKeySchema,
});

const redisSchema = z.object({
    host: z.string(),
    port: z.number(),
    password: z.string().optional(),
});

const rateLimitEndpointSchema = z.object({
    maxAttempts: z.number(),
    windowSeconds: z.number(),
});

const rateLimitSchema = z.object({
    login: rateLimitEndpointSchema,
    refresh: rateLimitEndpointSchema,
    resetKey: rateLimitEndpointSchema,
    validateResetKey: rateLimitEndpointSchema,
    resetPassword: rateLimitEndpointSchema,
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

const emulatedEventbusSchema = z.object({
    mode: z.literal('emulated'),
    outputPath: z.string().optional(),
});

const realEventbusSchema = z.object({
    mode: z.literal('real'),
    kafka: z.record(z.string(), z.unknown()),
});

const eventbusSchema = z.union([emulatedEventbusSchema, realEventbusSchema]);

export const configSchema = z.object({
    server: serverSchema,
    database: databaseSchema,
    auth: authSchema,
    redis: redisSchema,
    rateLimit: rateLimitSchema,
    ssm: ssmSchema.optional(),
    eventbus: eventbusSchema,
});

export type AppConfig = z.infer<typeof configSchema>;
