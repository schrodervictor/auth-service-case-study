import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm/globals';
import { User } from '../../../src/entities/user';
import { RefreshToken } from '../../../src/entities/refresh-token';
import { PasswordResetKey } from '../../../src/entities/password-reset-key';

const storage = getMetadataArgsStorage();

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function getColumn(target: Function, propertyName: string) {
    return storage.columns.find(
        c => c.target === target && c.propertyName === propertyName,
    );
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function getGeneration(target: Function, propertyName: string) {
    return storage.generations.find(
        g => g.target === target && g.propertyName === propertyName,
    );
}

const entities = [
    {
        name: 'User',
        target: User,
        tableName: 'users',
        columns: [
            { property: 'email', dbName: 'email' },
            { property: 'passwordHash', dbName: 'password_hash' },
            { property: 'firstName', dbName: 'first_name' },
            { property: 'lastName', dbName: 'last_name' },
        ],
        dateColumns: [
            { property: 'createdAt', dbName: 'created_at', mode: 'createDate' },
            { property: 'updatedAt', dbName: 'updated_at', mode: 'updateDate' },
        ],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        relation: null as { relatedEntity: Function; joinColumn: string } | null,
    },
    {
        name: 'RefreshToken',
        target: RefreshToken,
        tableName: 'refresh_tokens',
        columns: [
            { property: 'tokenHash', dbName: 'token_hash' },
            { property: 'userId', dbName: 'user_id' },
            { property: 'expiresAt', dbName: 'expires_at' },
        ],
        dateColumns: [
            { property: 'createdAt', dbName: 'created_at', mode: 'createDate' },
        ],
        relation: { relatedEntity: User, joinColumn: 'user_id' },
    },
    {
        name: 'PasswordResetKey',
        target: PasswordResetKey,
        tableName: 'password_reset_keys',
        columns: [
            { property: 'keyHash', dbName: 'key_hash' },
            { property: 'userId', dbName: 'user_id' },
            { property: 'expiresAt', dbName: 'expires_at' },
        ],
        dateColumns: [
            { property: 'createdAt', dbName: 'created_at', mode: 'createDate' },
        ],
        relation: { relatedEntity: User, joinColumn: 'user_id' },
    },
];

describe.each(entities)(
    '$name Entity',
    ({ target, tableName, columns, dateColumns, relation }) => {
        it(`should be registered with table name "${tableName}"`, () => {
            const table = storage.tables.find(t => t.target === target);

            expect(table).toBeDefined();
            expect(table!.name).toBe(tableName);
        });

        it('should have an "id" column with uuid generation strategy', () => {
            expect(getColumn(target, 'id')).toBeDefined();
            expect(getGeneration(target, 'id')?.strategy).toBe('uuid');
        });

        it.each(columns)(
            'should map "$property" to "$dbName"',
            ({ property, dbName }) => {
                const col = getColumn(target, property);

                expect(col).toBeDefined();
                expect(col!.options.name).toBe(dbName);
            },
        );

        it.each(dateColumns)(
            'should have "$property" as $mode mapped to "$dbName"',
            ({ property, dbName, mode }) => {
                const col = getColumn(target, property);

                expect(col).toBeDefined();
                expect(col!.mode).toBe(mode);
                expect(col!.options.name).toBe(dbName);
            },
        );

        if (relation) {
            it('should have a ManyToOne relation to User with correct join column', () => {
                const rel = storage.relations.find(
                    r => r.target === target && r.propertyName === 'user',
                );

                expect(rel).toBeDefined();
                expect(rel!.relationType).toBe('many-to-one');

                const resolvedType =
                    typeof rel!.type === 'function'
                        ? (rel!.type as () => unknown)()
                        : rel!.type;
                expect(resolvedType).toBe(relation.relatedEntity);

                const joinCol = storage.joinColumns.find(
                    j => j.target === target && j.propertyName === 'user',
                );
                expect(joinCol).toBeDefined();
                expect(joinCol!.name).toBe(relation.joinColumn);
            });
        }
    },
);

describe('User Entity — email unique constraint', () => {
    it('should have a unique constraint on email', () => {
        const emailColumn = getColumn(User, 'email');
        const hasUniqueOption =
            emailColumn?.options && emailColumn.options.unique === true;

        const hasUniqueDecorator = storage.uniques.some(
            u =>
                u.target === User &&
                Array.isArray(u.columns) &&
                u.columns.includes('email'),
        );

        expect(hasUniqueOption || hasUniqueDecorator).toBe(true);
    });
});
