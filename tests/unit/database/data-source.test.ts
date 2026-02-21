import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User } from '../../../src/entities/user';
import {
    createDataSource,
    DatabaseCredentials,
} from '../../../src/database/data-source';
import { AppConfig } from '../../../src/config/schema';

const makeConfig = (overrides?: Partial<AppConfig['database']>): AppConfig => ({
    server: { port: 9000 },
    database: {
        host: 'test-host',
        port: 5432,
        name: 'test_db',
        ...overrides,
    },
    auth: {
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
    },
});

const makeCredentials = (
    overrides?: Partial<DatabaseCredentials>,
): DatabaseCredentials => ({
    username: 'test_user',
    password: 'test_pass',
    ...overrides,
});

describe('createDataSource', () => {
    it('should return a DataSource instance', () => {
        const ds = createDataSource(makeConfig(), makeCredentials());
        expect(ds).toBeInstanceOf(DataSource);
    });

    it('should use host, port, and database from config', () => {
        const config = makeConfig({
            host: 'my-host',
            port: 5433,
            name: 'my_db',
        });
        const ds = createDataSource(config, makeCredentials());
        const opts = ds.options as PostgresConnectionOptions;

        expect(opts.host).toBe('my-host');
        expect(opts.port).toBe(5433);
        expect(opts.database).toBe('my_db');
    });

    it('should use username and password from credentials', () => {
        const creds = makeCredentials({
            username: 'admin',
            password: 's3cret',
        });
        const ds = createDataSource(makeConfig(), creds);
        const opts = ds.options as PostgresConnectionOptions;

        expect(opts.username).toBe('admin');
        expect(opts.password).toBe('s3cret');
    });

    it('should set synchronize to false', () => {
        const ds = createDataSource(makeConfig(), makeCredentials());
        const opts = ds.options as PostgresConnectionOptions;

        expect(opts.synchronize).toBe(false);
    });

    it('should include User in entities', () => {
        const ds = createDataSource(makeConfig(), makeCredentials());
        const opts = ds.options as PostgresConnectionOptions;
        const entities = opts.entities as unknown[];

        expect(entities).toContain(User);
    });
});
