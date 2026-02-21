import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm/globals';
import { User } from '../../../src/entities/user';

const storage = getMetadataArgsStorage();

describe('User Entity', () => {
    describe('table registration', () => {
        it('should be registered as an entity with table name "users"', () => {
            const tableMetadata = storage.tables.find(
                (t) => t.target === User,
            );

            expect(tableMetadata).toBeDefined();
            expect(tableMetadata!.name).toBe('users');
        });
    });

    describe('columns', () => {
        const getColumn = (propertyName: string) =>
            storage.columns.find(
                (c) => c.target === User && c.propertyName === propertyName,
            );

        it('should have an "id" column with uuid generation strategy', () => {
            const idColumn = getColumn('id');
            expect(idColumn).toBeDefined();

            const generation = storage.generations.find(
                (g) => g.target === User && g.propertyName === 'id',
            );
            expect(generation).toBeDefined();
            expect(generation!.strategy).toBe('uuid');
        });

        it('should have an "email" column with unique constraint', () => {
            const emailColumn = getColumn('email');
            expect(emailColumn).toBeDefined();

            // Check for unique via column options or uniques storage
            const hasUniqueOption =
                emailColumn!.options && emailColumn!.options.unique === true;

            const hasUniqueDecorator = storage.uniques.some(
                (u) =>
                    u.target === User &&
                    Array.isArray(u.columns) &&
                    u.columns.includes('email'),
            );

            expect(hasUniqueOption || hasUniqueDecorator).toBe(true);
        });

        it('should have a "password" column', () => {
            const passwordColumn = getColumn('password');
            expect(passwordColumn).toBeDefined();
        });

        it('should have a "firstName" column mapped to "first_name"', () => {
            const firstNameColumn = getColumn('firstName');
            expect(firstNameColumn).toBeDefined();
            expect(firstNameColumn!.options.name).toBe('first_name');
        });

        it('should have a "lastName" column mapped to "last_name"', () => {
            const lastNameColumn = getColumn('lastName');
            expect(lastNameColumn).toBeDefined();
            expect(lastNameColumn!.options.name).toBe('last_name');
        });

        it('should have "createdAt" as a CreateDateColumn mapped to "created_at"', () => {
            const createdAtColumn = getColumn('createdAt');
            expect(createdAtColumn).toBeDefined();
            expect(createdAtColumn!.mode).toBe('createDate');
            expect(createdAtColumn!.options.name).toBe('created_at');
        });

        it('should have "updatedAt" as an UpdateDateColumn mapped to "updated_at"', () => {
            const updatedAtColumn = getColumn('updatedAt');
            expect(updatedAtColumn).toBeDefined();
            expect(updatedAtColumn!.mode).toBe('updateDate');
            expect(updatedAtColumn!.options.name).toBe('updated_at');
        });
    });
});
