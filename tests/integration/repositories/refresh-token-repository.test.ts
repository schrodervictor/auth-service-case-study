import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { RefreshTokenRepositoryImpl } from '../../../src/repositories/refresh-token-repository';
import { UserRepositoryImpl } from '../../../src/repositories/user-repository';
import { User } from '../../../src/entities/user';
import { RefreshToken } from '../../../src/entities/refresh-token';

/**
 * Integration tests for RefreshTokenRepository against real PostgreSQL.
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

    CREATE TABLE "refresh_tokens" (
        "id"            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        "token_hash"    VARCHAR NOT NULL,
        "user_id"       UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "expires_at"    TIMESTAMP NOT NULL,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now()
    );
`;

const MIGRATION_DOWN = `
    DROP TABLE IF EXISTS "refresh_tokens";
    DROP TABLE IF EXISTS "users";
`;

async function createTestUser(
    dataSource: DataSource,
    overrides: Partial<{
        email: string;
        passwordHash: string;
        firstName: string;
        lastName: string;
    }> = {},
): Promise<User> {
    const userRepo = new UserRepositoryImpl(dataSource);
    return userRepo.create({
        email: overrides.email ?? 'test@example.com',
        passwordHash: overrides.passwordHash ?? 'hashed_password_value',
        firstName: overrides.firstName ?? 'Test',
        lastName: overrides.lastName ?? 'User',
    });
}

describe('RefreshTokenRepository integration', () => {
    let dataSource: DataSource;
    let repo: RefreshTokenRepositoryImpl;

    beforeAll(async () => {
        dataSource = new DataSource({
            ...pgOptions,
            entities: [User, RefreshToken],
            synchronize: false,
        });
        await dataSource.initialize();
        await dataSource.query(MIGRATION_DOWN);
        await dataSource.query(MIGRATION_UP);
        repo = new RefreshTokenRepositoryImpl(dataSource);
    });

    beforeEach(async () => {
        await dataSource.query('TRUNCATE "refresh_tokens" CASCADE');
        await dataSource.query('TRUNCATE "users" CASCADE');
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.query(MIGRATION_DOWN);
            await dataSource.destroy();
        }
    });

    describe('save', () => {
        it('should insert a refresh token and return it with UUID id, correct fields, and auto-generated createdAt', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const token = await repo.save(
                'sha256_hash_value',
                user.id,
                expiresAt,
            );

            expect(token.id).toBeDefined();
            expect(token.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            );
            expect(token.tokenHash).toBe('sha256_hash_value');
            expect(token.userId).toBe(user.id);
            expect(token.expiresAt).toBeInstanceOf(Date);
            expect(token.expiresAt.getTime()).toBe(expiresAt.getTime());
            expect(token.createdAt).toBeInstanceOf(Date);
        });

        it('should throw when userId does not exist in users table (FK constraint)', async () => {
            const fakeUserId = '00000000-0000-0000-0000-000000000000';
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            await expect(
                repo.save('some_hash', fakeUserId, expiresAt),
            ).rejects.toThrow();
        });
    });

    describe('findByTokenHash', () => {
        it('should find a previously saved token by its hash', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const saved = await repo.save(
                'unique_hash_123',
                user.id,
                expiresAt,
            );

            const found = await repo.findByTokenHash('unique_hash_123');

            expect(found).not.toBeNull();
            expect(found!.id).toBe(saved.id);
            expect(found!.tokenHash).toBe('unique_hash_123');
            expect(found!.userId).toBe(user.id);
        });

        it('should return null for a non-existent hash', async () => {
            const found = await repo.findByTokenHash('nonexistent_hash');

            expect(found).toBeNull();
        });
    });

    describe('deleteByTokenHash', () => {
        it('should delete a token by hash so subsequent find returns null', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await repo.save('hash_to_delete', user.id, expiresAt);

            await repo.deleteByTokenHash('hash_to_delete');

            const found = await repo.findByTokenHash('hash_to_delete');
            expect(found).toBeNull();
        });

        it('should not throw when hash does not exist', async () => {
            await expect(
                repo.deleteByTokenHash('nonexistent_hash'),
            ).resolves.not.toThrow();
        });
    });

    describe('deleteAllByUserId', () => {
        it('should delete all tokens for a user', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await repo.save('hash_one', user.id, expiresAt);
            await repo.save('hash_two', user.id, expiresAt);
            await repo.save('hash_three', user.id, expiresAt);

            await repo.deleteAllByUserId(user.id);

            const found1 = await repo.findByTokenHash('hash_one');
            const found2 = await repo.findByTokenHash('hash_two');
            const found3 = await repo.findByTokenHash('hash_three');
            expect(found1).toBeNull();
            expect(found2).toBeNull();
            expect(found3).toBeNull();
        });

        it('should not affect tokens of other users', async () => {
            const user1 = await createTestUser(dataSource, {
                email: 'user1@example.com',
            });
            const user2 = await createTestUser(dataSource, {
                email: 'user2@example.com',
            });
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await repo.save('user1_hash', user1.id, expiresAt);
            await repo.save('user2_hash', user2.id, expiresAt);

            await repo.deleteAllByUserId(user1.id);

            const found1 = await repo.findByTokenHash('user1_hash');
            const found2 = await repo.findByTokenHash('user2_hash');
            expect(found1).toBeNull();
            expect(found2).not.toBeNull();
            expect(found2!.userId).toBe(user2.id);
        });
    });

    describe('cascade delete', () => {
        it('should delete refresh tokens when the owning user is deleted', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await repo.save('cascade_hash_1', user.id, expiresAt);
            await repo.save('cascade_hash_2', user.id, expiresAt);

            // Delete user via raw SQL to trigger DB-level CASCADE
            await dataSource.query('DELETE FROM "users" WHERE "id" = $1', [
                user.id,
            ]);

            const found1 = await repo.findByTokenHash('cascade_hash_1');
            const found2 = await repo.findByTokenHash('cascade_hash_2');
            expect(found1).toBeNull();
            expect(found2).toBeNull();
        });
    });
});
