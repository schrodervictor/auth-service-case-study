import { readFileSync } from 'node:fs';

import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';

import type { AppConfig } from './schema';
import { secretsSchema, type AppSecrets } from './secrets-schema';

async function loadFromFile(path: string): Promise<AppSecrets> {
    const raw = readFileSync(path, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const secrets = secretsSchema.parse(parsed);
    return Object.freeze(secrets);
}

async function loadFromSSM(config: NonNullable<AppConfig['ssm']>): Promise<AppSecrets> {
    const client = new SSMClient({ region: config.region });

    const parameterNames = Object.values(config.parameters);
    const command = new GetParametersCommand({
        Names: parameterNames,
        WithDecryption: true,
    });

    const response = await client.send(command);

    // Build reverse map: SSM parameter name → AppSecrets key
    const nameToKey = new Map<string, keyof AppSecrets>();
    for (const [key, name] of Object.entries(config.parameters)) {
        nameToKey.set(name, key as keyof AppSecrets);
    }

    const result: Record<string, string> = {};
    for (const param of response.Parameters ?? []) {
        const key = nameToKey.get(param.Name!);
        if (key) {
            result[key] = param.Value!;
        }
    }

    const secrets = secretsSchema.parse(result);
    return Object.freeze(secrets);
}

export async function loadSecrets(config: AppConfig): Promise<AppSecrets> {
    if (config.ssm) {
        return loadFromSSM(config.ssm);
    }

    const secretsPath = process.env.SECRETS_PATH;
    if (secretsPath) {
        return loadFromFile(secretsPath);
    }

    throw new Error(
        'No secrets backend configured: provide either "ssm" in config or set SECRETS_PATH env var',
    );
}
