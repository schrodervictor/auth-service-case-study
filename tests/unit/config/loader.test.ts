import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../../../src/config/loader';
import { makeTestConfig } from '../../helpers/test-config';

function writeTmpConfig(data: unknown): string {
    const filePath = path.join(
        os.tmpdir(),
        `test-config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    return filePath;
}

const VALID_CONFIG = makeTestConfig();

describe('loadConfig', () => {
    let tmpFiles: string[] = [];
    const originalEnv = process.env.CONFIG_PATH;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.CONFIG_PATH;
        } else {
            process.env.CONFIG_PATH = originalEnv;
        }

        for (const f of tmpFiles) {
            try {
                fs.unlinkSync(f);
            } catch {
                // ignore
            }
        }
        tmpFiles = [];
    });

    describe('valid config', () => {
        it('should load a fully-specified config and return a typed object', () => {
            const configPath = writeTmpConfig(VALID_CONFIG);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config).toEqual(VALID_CONFIG);
        });

        it('should load config with custom values', () => {
            const customConfig = makeTestConfig({
                server: { port: 3000 },
                database: { port: 5433 },
            });
            const configPath = writeTmpConfig(customConfig);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config.server.port).toBe(3000);
            expect(config.database.port).toBe(5433);
        });
    });

    describe('missing CONFIG_PATH', () => {
        it('should throw a descriptive error when CONFIG_PATH is not set', () => {
            delete process.env.CONFIG_PATH;

            expect(() => loadConfig()).toThrow(/CONFIG_PATH/);
        });

        it('should throw a descriptive error when CONFIG_PATH is empty string', () => {
            process.env.CONFIG_PATH = '';

            expect(() => loadConfig()).toThrow(/CONFIG_PATH/);
        });
    });

    describe('file not found', () => {
        it('should throw an error when CONFIG_PATH points to a nonexistent file', () => {
            process.env.CONFIG_PATH = '/tmp/nonexistent-config-file.json';

            expect(() => loadConfig()).toThrow();
        });
    });

    describe('malformed JSON', () => {
        it('should throw an error when the file contains invalid JSON', () => {
            const filePath = path.join(
                os.tmpdir(),
                `test-config-bad-${Date.now()}.json`,
            );
            fs.writeFileSync(filePath, '{ invalid json !!!', 'utf-8');
            tmpFiles.push(filePath);
            process.env.CONFIG_PATH = filePath;

            expect(() => loadConfig()).toThrow();
        });
    });

    describe('missing required fields', () => {
        it('should throw when database.host is missing', () => {
            const { host: _, ...dbWithoutHost } = VALID_CONFIG.database;
            const configPath = writeTmpConfig({
                ...VALID_CONFIG,
                database: dbWithoutHost,
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });

        it('should throw when database section is missing entirely', () => {
            const { database: _, ...configWithoutDb } = VALID_CONFIG;
            const configPath = writeTmpConfig(configWithoutDb);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });

        it('should throw when server section is missing', () => {
            const { server: _, ...configWithoutServer } = VALID_CONFIG;
            const configPath = writeTmpConfig(configWithoutServer);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });
    });

    describe('wrong types', () => {
        it('should throw when server.port is a string', () => {
            const configPath = writeTmpConfig({
                ...VALID_CONFIG,
                server: { port: '3000' },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });

        it('should throw when database.port is a string', () => {
            const configPath = writeTmpConfig({
                ...VALID_CONFIG,
                database: { ...VALID_CONFIG.database, port: 'abc' },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });
    });

    describe('immutability', () => {
        function loadValidConfig() {
            const configPath = writeTmpConfig(VALID_CONFIG);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;
            return loadConfig();
        }

        it('should return a frozen top-level object', () => {
            const config = loadValidConfig();

            expect(Object.isFrozen(config)).toBe(true);
        });

        it('should freeze nested objects (server, database, auth)', () => {
            const config = loadValidConfig();

            expect(Object.isFrozen(config.server)).toBe(true);
            expect(Object.isFrozen(config.database)).toBe(true);
            expect(Object.isFrozen(config.auth)).toBe(true);
        });

        it('should freeze deeply nested objects (auth.accessToken, auth.refreshToken)', () => {
            const config = loadValidConfig();

            expect(Object.isFrozen(config.auth.accessToken)).toBe(true);
            expect(Object.isFrozen(config.auth.refreshToken)).toBe(true);
        });

        it('should throw TypeError when mutating a top-level property', () => {
            const config = loadValidConfig();

            expect(() => {
                (config as Record<string, unknown>).server = { port: 9999 };
            }).toThrow(TypeError);
        });

        it('should throw TypeError when mutating a nested property', () => {
            const config = loadValidConfig();

            expect(() => {
                (config.server as Record<string, unknown>).port = 1234;
            }).toThrow(TypeError);
        });

        it('should throw TypeError when mutating a deeply nested property', () => {
            const config = loadValidConfig();

            expect(() => {
                (config.auth.accessToken as Record<string, unknown>).expiresIn =
                    '1h';
            }).toThrow(TypeError);
        });
    });

    describe('extra/unknown fields', () => {
        it('should strip unknown top-level fields', () => {
            const configPath = writeTmpConfig({
                ...VALID_CONFIG,
                extraField: 'should be stripped',
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config).not.toHaveProperty('extraField');
        });

        it('should strip unknown nested fields', () => {
            const configPath = writeTmpConfig({
                ...VALID_CONFIG,
                database: {
                    ...VALID_CONFIG.database,
                    extraNested: true,
                },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config.database).not.toHaveProperty('extraNested');
        });
    });
});
