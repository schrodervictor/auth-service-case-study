import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../../../src/entities/user';

/**
 * Integration tests for database connectivity and migrations.
 *
 * These tests require a running PostgreSQL instance (via docker-compose).
 * Run with: make test-integration
 */

const pgOptions = {
    type: 'postgres' as const,
    host: 'postgres',
    port: 5432,
    database: 'case_study_db',
    username: 'postgres',
    password: 'postgres',
};

const MIGRATION_UP = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE "users" (
        "id"            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        "email"         VARCHAR NOT NULL UNIQUE,
        "password_hash" VARCHAR NOT NULL,
        "first_name"    VARCHAR NOT NULL,
        "last_name"     VARCHAR NOT NULL,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP NOT NULL DEFAULT now()
    );
`;

const MIGRATION_DOWN = `DROP TABLE IF EXISTS "users";`;

describe('Database connectivity', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = new DataSource({
            ...pgOptions,
            entities: [],
            synchronize: false,
        });
        await dataSource.initialize();
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should initialize the DataSource successfully', () => {
        expect(dataSource.isInitialized).toBe(true);
    });

    it('should execute a raw SQL query (SELECT 1)', async () => {
        const result = await dataSource.query('SELECT 1 AS value');
        expect(result).toEqual([{ value: 1 }]);
    });
});

describe('Migrations', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = new DataSource({
            ...pgOptions,
            entities: [User],
            synchronize: false,
        });
        await dataSource.initialize();
        // Clean up any leftover state from previous runs
        await dataSource.query(MIGRATION_DOWN);
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.query(MIGRATION_DOWN);
            await dataSource.destroy();
        }
    });

    it('should create the "users" table via up migration', async () => {
        await dataSource.query(MIGRATION_UP);

        const result = await dataSource.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'users'`,
        );
        expect(result).toHaveLength(1);
        expect(result[0].table_name).toBe('users');
    });

    it('should drop the "users" table via down migration', async () => {
        await dataSource.query(MIGRATION_DOWN);

        const result = await dataSource.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'users'`,
        );
        expect(result).toHaveLength(0);
    });
});

describe('User entity roundtrip', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = new DataSource({
            ...pgOptions,
            entities: [User],
            synchronize: false,
        });
        await dataSource.initialize();
        // Ensure clean state, then apply migration
        await dataSource.query(MIGRATION_DOWN);
        await dataSource.query(MIGRATION_UP);
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.query(MIGRATION_DOWN);
            await dataSource.destroy();
        }
    });

    it('should insert and read back a User entity with correct fields', async () => {
        const userRepo = dataSource.getRepository(User);

        const user = userRepo.create({
            email: 'test@example.com',
            passwordHash: 'hashed_password_value',
            firstName: 'Test',
            lastName: 'User',
        });

        const saved = await userRepo.save(user);

        expect(saved.id).toBeDefined();
        expect(saved.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
        expect(saved.email).toBe('test@example.com');
        expect(saved.passwordHash).toBe('hashed_password_value');
        expect(saved.firstName).toBe('Test');
        expect(saved.lastName).toBe('User');
        expect(saved.createdAt).toBeInstanceOf(Date);
        expect(saved.updatedAt).toBeInstanceOf(Date);

        // Read back from DB to verify persistence
        const found = await userRepo.findOneBy({ id: saved.id });
        expect(found).not.toBeNull();
        expect(found!.email).toBe('test@example.com');
        expect(found!.firstName).toBe('Test');
        expect(found!.lastName).toBe('User');
    });
});
