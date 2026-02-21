import 'reflect-metadata';
import { Container } from 'inversify';

import { createContainer } from '../../../src/inversify.config';
import { TYPES } from '../../../src/lib/types';
import type { AppConfig } from '../../../src/config/schema';

const VALID_CONFIG: AppConfig = {
    server: { port: 9000 },
    database: { host: 'localhost', port: 5432, name: 'testdb' },
    auth: {
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
    },
};

describe('DI container config integration', () => {
    describe('config binding', () => {
        it('should return a Container instance', () => {
            const container = createContainer(VALID_CONFIG);

            expect(container).toBeInstanceOf(Container);
        });

        it('should bind config under TYPES.Config', () => {
            const container = createContainer(VALID_CONFIG);

            expect(container.isBound(TYPES.Config)).toBe(true);
        });

        it('should retrieve the config object with correct values', () => {
            const container = createContainer(VALID_CONFIG);

            const config = container.get<AppConfig>(TYPES.Config);

            expect(config).toEqual(VALID_CONFIG);
        });

        it('should bind config as a constant (same reference on multiple gets)', () => {
            const container = createContainer(VALID_CONFIG);

            const first = container.get<AppConfig>(TYPES.Config);
            const second = container.get<AppConfig>(TYPES.Config);

            expect(first).toBe(second);
        });
    });

    describe('invalid config', () => {
        it('should throw when config is null', () => {
            expect(() => createContainer(null as unknown as AppConfig)).toThrow();
        });

        it('should throw when config is undefined', () => {
            expect(() => createContainer(undefined as unknown as AppConfig)).toThrow();
        });
    });
});
