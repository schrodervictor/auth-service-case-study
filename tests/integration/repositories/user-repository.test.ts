import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { UserRepositoryImpl } from '../../../src/repositories/user-repository';
import type { CreateUserData } from '../../../src/repositories/user-repository';
import { User } from '../../../src/entities/user';

/**
 * Integration tests for UserRepository against real PostgreSQL.
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
        "id"         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        "email"      VARCHAR NOT NULL UNIQUE,
        "password"   VARCHAR NOT NULL,
        "first_name" VARCHAR NOT NULL,
        "last_name"  VARCHAR NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    );
`;

const MIGRATION_DOWN = `DROP TABLE IF EXISTS "users";`;

const sampleUser: CreateUserData = {
    email: 'integration@example.com',
    password: 'hashed_password_value',
    firstName: 'Integration',
    lastName: 'Test',
};

describe('UserRepository integration', () => {
    let dataSource: DataSource;
    let repo: UserRepositoryImpl;

    beforeAll(async () => {
        dataSource = new DataSource({ ...pgOptions, entities: [User], synchronize: false });
        await dataSource.initialize();
        await dataSource.query(MIGRATION_DOWN);
        await dataSource.query(MIGRATION_UP);
        repo = new UserRepositoryImpl(dataSource);
    });

    beforeEach(async () => {
        await dataSource.query('TRUNCATE "users" CASCADE');
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.query(MIGRATION_DOWN);
            await dataSource.destroy();
        }
    });

    describe('create', () => {
        it('should insert a user and return it with UUID id and timestamps', async () => {
            const user = await repo.create(sampleUser);

            expect(user.id).toBeDefined();
            expect(user.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            );
            expect(user.email).toBe(sampleUser.email);
            expect(user.password).toBe(sampleUser.password);
            expect(user.firstName).toBe(sampleUser.firstName);
            expect(user.lastName).toBe(sampleUser.lastName);
            expect(user.createdAt).toBeInstanceOf(Date);
            expect(user.updatedAt).toBeInstanceOf(Date);
        });

        it('should throw on duplicate email (unique constraint)', async () => {
            await repo.create(sampleUser);

            await expect(repo.create(sampleUser)).rejects.toThrow();
        });
    });

    describe('findByEmail', () => {
        it('should find a previously created user by email', async () => {
            const created = await repo.create(sampleUser);

            const found = await repo.findByEmail(sampleUser.email);

            expect(found).not.toBeNull();
            expect(found!.id).toBe(created.id);
            expect(found!.email).toBe(sampleUser.email);
        });

        it('should return null for a non-existent email', async () => {
            const found = await repo.findByEmail('nonexistent@example.com');

            expect(found).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find a previously created user by id', async () => {
            const created = await repo.create(sampleUser);

            const found = await repo.findById(created.id);

            expect(found).not.toBeNull();
            expect(found!.id).toBe(created.id);
            expect(found!.email).toBe(sampleUser.email);
        });

        it('should return null for a non-existent id', async () => {
            const found = await repo.findById('00000000-0000-0000-0000-000000000000');

            expect(found).toBeNull();
        });
    });

    describe('update', () => {
        it('should update fields and return updated user with new updatedAt', async () => {
            const created = await repo.create(sampleUser);

            // Small delay to ensure updatedAt differs
            await new Promise((resolve) => setTimeout(resolve, 50));

            const updated = await repo.update(created.id, {
                firstName: 'Updated',
                lastName: 'Name',
            });

            expect(updated).not.toBeNull();
            expect(updated!.firstName).toBe('Updated');
            expect(updated!.lastName).toBe('Name');
            expect(updated!.email).toBe(sampleUser.email); // unchanged
            expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
                created.updatedAt.getTime(),
            );
        });

        it('should return null for a non-existent id', async () => {
            const result = await repo.update('00000000-0000-0000-0000-000000000000', {
                firstName: 'Ghost',
            });

            expect(result).toBeNull();
        });

        it('should preserve other fields on partial update', async () => {
            const created = await repo.create(sampleUser);

            const updated = await repo.update(created.id, { firstName: 'OnlyFirst' });

            expect(updated).not.toBeNull();
            expect(updated!.firstName).toBe('OnlyFirst');
            expect(updated!.lastName).toBe(sampleUser.lastName); // preserved
            expect(updated!.email).toBe(sampleUser.email); // preserved
            expect(updated!.password).toBe(sampleUser.password); // preserved
        });
    });
});
