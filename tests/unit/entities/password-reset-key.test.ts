import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm/globals';
import { PasswordResetKey } from '../../../src/entities/password-reset-key';
import { User } from '../../../src/entities/user';

const storage = getMetadataArgsStorage();

describe('PasswordResetKey Entity', () => {
    describe('table registration', () => {
        it('should be registered as an entity with table name "password_reset_keys"', () => {
            const tableMetadata = storage.tables.find(
                (t) => t.target === PasswordResetKey,
            );

            expect(tableMetadata).toBeDefined();
            expect(tableMetadata!.name).toBe('password_reset_keys');
        });
    });

    describe('columns', () => {
        const getColumn = (propertyName: string) =>
            storage.columns.find(
                (c) =>
                    c.target === PasswordResetKey &&
                    c.propertyName === propertyName,
            );

        it('should have an "id" column with uuid generation strategy', () => {
            const idColumn = getColumn('id');
            expect(idColumn).toBeDefined();

            const generation = storage.generations.find(
                (g) =>
                    g.target === PasswordResetKey && g.propertyName === 'id',
            );
            expect(generation).toBeDefined();
            expect(generation!.strategy).toBe('uuid');
        });

        it('should have a "keyHash" column mapped to "key_hash"', () => {
            const keyHashColumn = getColumn('keyHash');
            expect(keyHashColumn).toBeDefined();
            expect(keyHashColumn!.options.name).toBe('key_hash');
        });

        it('should have a "userId" column mapped to "user_id"', () => {
            const userIdColumn = getColumn('userId');
            expect(userIdColumn).toBeDefined();
            expect(userIdColumn!.options.name).toBe('user_id');
        });

        it('should have an "expiresAt" column mapped to "expires_at"', () => {
            const expiresAtColumn = getColumn('expiresAt');
            expect(expiresAtColumn).toBeDefined();
            expect(expiresAtColumn!.options.name).toBe('expires_at');
        });

        it('should have "createdAt" as a CreateDateColumn mapped to "created_at"', () => {
            const createdAtColumn = getColumn('createdAt');
            expect(createdAtColumn).toBeDefined();
            expect(createdAtColumn!.mode).toBe('createDate');
            expect(createdAtColumn!.options.name).toBe('created_at');
        });
    });

    describe('relations', () => {
        it('should have a ManyToOne relation to User', () => {
            const relation = storage.relations.find(
                (r) =>
                    r.target === PasswordResetKey &&
                    r.propertyName === 'user',
            );

            expect(relation).toBeDefined();
            expect(relation!.relationType).toBe('many-to-one');

            const resolvedType =
                typeof relation!.type === 'function'
                    ? (relation!.type as () => typeof User)()
                    : relation!.type;
            expect(resolvedType).toBe(User);
        });

        it('should join on "user_id" column', () => {
            const joinColumn = storage.joinColumns.find(
                (j) =>
                    j.target === PasswordResetKey &&
                    j.propertyName === 'user',
            );

            expect(joinColumn).toBeDefined();
            expect(joinColumn!.name).toBe('user_id');
        });
    });
});
