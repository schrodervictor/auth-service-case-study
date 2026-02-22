import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { PasswordResetKeyRepositoryImpl } from '../../../src/repositories/password-reset-key-repository';
import { UserRepositoryImpl } from '../../../src/repositories/user-repository';
import { User } from '../../../src/entities/user';
import { PasswordResetKey } from '../../../src/entities/password-reset-key';

/**
 * Integration tests for PasswordResetKeyRepository against real PostgreSQL.
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

    CREATE TABLE "password_reset_keys" (
        "id"         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        "user_id"    UUID NOT NULL,
        "key_hash"   VARCHAR NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_password_reset_keys_user"
            FOREIGN KEY ("user_id")
            REFERENCES "users" ("id")
            ON DELETE CASCADE
    );

    CREATE INDEX "idx_password_reset_keys_key_hash" ON "password_reset_keys" ("key_hash");
    CREATE INDEX "idx_password_reset_keys_user_id" ON "password_reset_keys" ("user_id");
`;

const MIGRATION_DOWN = `
    DROP TABLE IF EXISTS "password_reset_keys";
    DROP TABLE IF EXISTS "users";
`;

async function createTestUser(
    dataSource: DataSource,
    overrides: Partial<{ email: string; passwordHash: string; firstName: string; lastName: string }> = {},
): Promise<User> {
    const userRepo = new UserRepositoryImpl(dataSource);
    return userRepo.create({
        email: overrides.email ?? 'test@example.com',
        passwordHash: overrides.passwordHash ?? 'hashed_password_value',
        firstName: overrides.firstName ?? 'Test',
        lastName: overrides.lastName ?? 'User',
    });
}

describe('PasswordResetKeyRepository integration', () => {
    let dataSource: DataSource;
    let repo: PasswordResetKeyRepositoryImpl;

    beforeAll(async () => {
        dataSource = new DataSource({
            ...pgOptions,
            entities: [User, PasswordResetKey],
            synchronize: false,
        });
        await dataSource.initialize();
        await dataSource.query(MIGRATION_DOWN);
        await dataSource.query(MIGRATION_UP);
        repo = new PasswordResetKeyRepositoryImpl(dataSource);
    });

    beforeEach(async () => {
        await dataSource.query('TRUNCATE "password_reset_keys" CASCADE');
        await dataSource.query('TRUNCATE "users" CASCADE');
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.query(MIGRATION_DOWN);
            await dataSource.destroy();
        }
    });

    describe('save', () => {
        it('should insert a reset key and return it with UUID id, correct fields, and auto-generated createdAt', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            const key = await repo.save('sha256_hash_value', user.id, expiresAt);

            expect(key.id).toBeDefined();
            expect(key.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            );
            expect(key.keyHash).toBe('sha256_hash_value');
            expect(key.userId).toBe(user.id);
            expect(key.expiresAt).toBeInstanceOf(Date);
            expect(key.expiresAt.getTime()).toBe(expiresAt.getTime());
            expect(key.createdAt).toBeInstanceOf(Date);
        });

        it('should throw when userId does not exist in users table (FK constraint)', async () => {
            const fakeUserId = '00000000-0000-0000-0000-000000000000';
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await expect(
                repo.save('some_hash', fakeUserId, expiresAt),
            ).rejects.toThrow();
        });

        it('should delete previous keys for the same user (single-key-per-user)', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await repo.save('first_hash', user.id, expiresAt);
            await repo.save('second_hash', user.id, expiresAt);

            const oldKey = await repo.findByKeyHash('first_hash');
            const newKey = await repo.findByKeyHash('second_hash');
            expect(oldKey).toBeNull();
            expect(newKey).not.toBeNull();
            expect(newKey!.userId).toBe(user.id);
        });

        it('should clean up expired keys from other users on save (lazy deletion)', async () => {
            const user1 = await createTestUser(dataSource, { email: 'user1@example.com' });
            const user2 = await createTestUser(dataSource, { email: 'user2@example.com' });

            // Insert an expired key for user1 directly via raw query
            const expiredDate = new Date(Date.now() - 60 * 1000);
            await dataSource.query(
                `INSERT INTO "password_reset_keys" ("user_id", "key_hash", "expires_at") VALUES ($1, $2, $3)`,
                [user1.id, 'expired_hash', expiredDate],
            );

            // Saving a key for user2 should trigger lazy cleanup
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await repo.save('user2_hash', user2.id, expiresAt);

            const expiredKey = await repo.findByKeyHash('expired_hash');
            expect(expiredKey).toBeNull();
        });
    });

    describe('findByKeyHash', () => {
        it('should find a previously saved key by its hash', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            const saved = await repo.save('unique_hash_123', user.id, expiresAt);

            const found = await repo.findByKeyHash('unique_hash_123');

            expect(found).not.toBeNull();
            expect(found!.id).toBe(saved.id);
            expect(found!.keyHash).toBe('unique_hash_123');
            expect(found!.userId).toBe(user.id);
        });

        it('should return null for a non-existent hash', async () => {
            const found = await repo.findByKeyHash('nonexistent_hash');

            expect(found).toBeNull();
        });
    });

    describe('deleteByKeyHash', () => {
        it('should delete a key by hash so subsequent find returns null', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await repo.save('hash_to_delete', user.id, expiresAt);

            await repo.deleteByKeyHash('hash_to_delete');

            const found = await repo.findByKeyHash('hash_to_delete');
            expect(found).toBeNull();
        });

        it('should not throw when hash does not exist', async () => {
            await expect(
                repo.deleteByKeyHash('nonexistent_hash'),
            ).resolves.not.toThrow();
        });
    });

    describe('deleteAllByUserId', () => {
        it('should delete all keys for a user', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            // Insert multiple keys directly to bypass single-key enforcement in save()
            await dataSource.query(
                `INSERT INTO "password_reset_keys" ("user_id", "key_hash", "expires_at") VALUES ($1, $2, $3)`,
                [user.id, 'hash_one', expiresAt],
            );
            await dataSource.query(
                `INSERT INTO "password_reset_keys" ("user_id", "key_hash", "expires_at") VALUES ($1, $2, $3)`,
                [user.id, 'hash_two', expiresAt],
            );

            await repo.deleteAllByUserId(user.id);

            const found1 = await repo.findByKeyHash('hash_one');
            const found2 = await repo.findByKeyHash('hash_two');
            expect(found1).toBeNull();
            expect(found2).toBeNull();
        });

        it('should not affect keys of other users', async () => {
            const user1 = await createTestUser(dataSource, { email: 'user1@example.com' });
            const user2 = await createTestUser(dataSource, { email: 'user2@example.com' });
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await repo.save('user1_hash', user1.id, expiresAt);
            await repo.save('user2_hash', user2.id, expiresAt);

            await repo.deleteAllByUserId(user1.id);

            const found1 = await repo.findByKeyHash('user1_hash');
            const found2 = await repo.findByKeyHash('user2_hash');
            expect(found1).toBeNull();
            expect(found2).not.toBeNull();
            expect(found2!.userId).toBe(user2.id);
        });
    });

    describe('deleteExpired', () => {
        it('should delete keys that have expired', async () => {
            const user = await createTestUser(dataSource);
            const expiredDate = new Date(Date.now() - 60 * 1000);

            await dataSource.query(
                `INSERT INTO "password_reset_keys" ("user_id", "key_hash", "expires_at") VALUES ($1, $2, $3)`,
                [user.id, 'expired_hash', expiredDate],
            );

            await repo.deleteExpired();

            const found = await repo.findByKeyHash('expired_hash');
            expect(found).toBeNull();
        });

        it('should not delete keys that have not expired', async () => {
            const user = await createTestUser(dataSource);
            const futureDate = new Date(Date.now() + 15 * 60 * 1000);
            await repo.save('valid_hash', user.id, futureDate);

            await repo.deleteExpired();

            const found = await repo.findByKeyHash('valid_hash');
            expect(found).not.toBeNull();
        });
    });

    describe('cascade delete', () => {
        it('should delete reset keys when the owning user is deleted', async () => {
            const user = await createTestUser(dataSource);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            await repo.save('cascade_hash', user.id, expiresAt);

            await dataSource.query('DELETE FROM "users" WHERE "id" = $1', [user.id]);

            const found = await repo.findByKeyHash('cascade_hash');
            expect(found).toBeNull();
        });
    });
});
