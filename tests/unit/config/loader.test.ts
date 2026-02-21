import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from '../../../src/config/loader';

function writeTmpConfig(data: unknown): string {
    const filePath = path.join(
        os.tmpdir(),
        `test-config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    return filePath;
}

const VALID_FULL_CONFIG = {
    server: { port: 3000 },
    database: { host: 'localhost', port: 5433, name: 'mydb' },
    auth: {
        accessToken: { expiresIn: '30m' },
        refreshToken: { expiresIn: '14d' },
    },
};

const MINIMAL_CONFIG = {
    database: { host: 'localhost', name: 'mydb' },
};

describe('loadConfig', () => {
    let tmpFiles: string[] = [];
    const originalEnv = process.env.CONFIG_PATH;

    afterEach(() => {
        // Restore CONFIG_PATH
        if (originalEnv === undefined) {
            delete process.env.CONFIG_PATH;
        } else {
            process.env.CONFIG_PATH = originalEnv;
        }

        // Clean up temp files
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
            const configPath = writeTmpConfig(VALID_FULL_CONFIG);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config).toEqual({
                server: { port: 3000 },
                database: { host: 'localhost', port: 5433, name: 'mydb' },
                auth: {
                    accessToken: { expiresIn: '30m' },
                    refreshToken: { expiresIn: '14d' },
                },
            });
        });
    });

    describe('default values', () => {
        it('should apply default server.port of 9000 when omitted', () => {
            const configPath = writeTmpConfig(MINIMAL_CONFIG);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config.server.port).toBe(9000);
        });

        it('should apply default database.port of 5432 when omitted', () => {
            const configPath = writeTmpConfig(MINIMAL_CONFIG);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config.database.port).toBe(5432);
        });

        it('should apply default auth.accessToken.expiresIn of "15m" when omitted', () => {
            const configPath = writeTmpConfig(MINIMAL_CONFIG);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config.auth.accessToken.expiresIn).toBe('15m');
        });

        it('should apply default auth.refreshToken.expiresIn of "7d" when omitted', () => {
            const configPath = writeTmpConfig(MINIMAL_CONFIG);
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config.auth.refreshToken.expiresIn).toBe('7d');
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
        it('should throw a validation error when database.host is missing', () => {
            const configPath = writeTmpConfig({
                database: { name: 'mydb' },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });

        it('should throw a validation error when database.name is missing', () => {
            const configPath = writeTmpConfig({
                database: { host: 'localhost' },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });

        it('should throw a validation error when database section is missing entirely', () => {
            const configPath = writeTmpConfig({
                server: { port: 3000 },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });
    });

    describe('wrong types', () => {
        it('should throw a validation error when server.port is a string', () => {
            const configPath = writeTmpConfig({
                server: { port: '3000' },
                database: { host: 'localhost', name: 'mydb' },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });

        it('should throw a validation error when database.port is a string', () => {
            const configPath = writeTmpConfig({
                database: { host: 'localhost', port: 'abc', name: 'mydb' },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });

        it('should throw a validation error when database.host is a number', () => {
            const configPath = writeTmpConfig({
                database: { host: 123, name: 'mydb' },
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            expect(() => loadConfig()).toThrow();
        });
    });

    describe('immutability', () => {
        function loadValidConfig() {
            const configPath = writeTmpConfig(VALID_FULL_CONFIG);
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
                (config.auth.accessToken as Record<string, unknown>).expiresIn = '1h';
            }).toThrow(TypeError);
        });
    });

    describe('extra/unknown fields', () => {
        it('should strip unknown top-level fields', () => {
            const configPath = writeTmpConfig({
                ...VALID_FULL_CONFIG,
                extraField: 'should be stripped',
            });
            tmpFiles.push(configPath);
            process.env.CONFIG_PATH = configPath;

            const config = loadConfig();

            expect(config).not.toHaveProperty('extraField');
        });

        it('should strip unknown nested fields', () => {
            const configPath = writeTmpConfig({
                ...VALID_FULL_CONFIG,
                database: {
                    ...VALID_FULL_CONFIG.database,
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
