import 'reflect-metadata';
import type { DataSource } from 'typeorm';

import { UserRepositoryImpl } from '../../../src/repositories/user-repository';
import type {
    CreateUserData,
    UpdateUserData,
} from '../../../src/repositories/user-repository';
import { User } from '../../../src/entities/user';

const createMockRepository = () => ({
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
});

const createMockDataSource = (
    mockRepository: ReturnType<typeof createMockRepository>,
) =>
    ({
        getRepository: jest.fn().mockReturnValue(mockRepository),
    }) as unknown as DataSource;

describe('UserRepositoryImpl', () => {
    let mockRepository: ReturnType<typeof createMockRepository>;
    let mockDataSource: DataSource;
    let repo: UserRepositoryImpl;

    beforeEach(() => {
        mockRepository = createMockRepository();
        mockDataSource = createMockDataSource(mockRepository);
        repo = new UserRepositoryImpl(mockDataSource);
    });

    describe('constructor', () => {
        it('should call dataSource.getRepository(User) in the constructor', () => {
            expect(mockDataSource.getRepository).toHaveBeenCalledWith(User);
        });
    });

    describe('findByEmail', () => {
        it('should call repository.findOneBy with the given email', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            await repo.findByEmail('test@example.com');

            expect(mockRepository.findOneBy).toHaveBeenCalledWith({
                email: 'test@example.com',
            });
        });

        it('should return the User when found', async () => {
            const user = {
                id: 'uuid-1',
                email: 'test@example.com',
                passwordHash: 'hashed',
                firstName: 'Test',
                lastName: 'User',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as User;
            mockRepository.findOneBy.mockResolvedValue(user);

            const result = await repo.findByEmail('test@example.com');

            expect(result).toBe(user);
        });

        it('should return null when not found', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            const result = await repo.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should call repository.findOneBy with the given id', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            await repo.findById('uuid-1');

            expect(mockRepository.findOneBy).toHaveBeenCalledWith({
                id: 'uuid-1',
            });
        });

        it('should return the User when found', async () => {
            const user = {
                id: 'uuid-1',
                email: 'test@example.com',
                passwordHash: 'hashed',
                firstName: 'Test',
                lastName: 'User',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as User;
            mockRepository.findOneBy.mockResolvedValue(user);

            const result = await repo.findById('uuid-1');

            expect(result).toBe(user);
        });

        it('should return null when not found', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            const result = await repo.findById('nonexistent-uuid');

            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        const createData: CreateUserData = {
            email: 'new@example.com',
            passwordHash: 'hashed_password',
            firstName: 'New',
            lastName: 'User',
        };

        const createdEntity = {
            ...createData,
        } as User;

        const savedEntity = {
            ...createData,
            id: 'uuid-new',
            createdAt: new Date(),
            updatedAt: new Date(),
        } as User;

        it('should call repository.create with the correct fields', async () => {
            mockRepository.create.mockReturnValue(createdEntity);
            mockRepository.save.mockResolvedValue(savedEntity);

            await repo.create(createData);

            expect(mockRepository.create).toHaveBeenCalledWith(createData);
        });

        it('should call repository.save with the created entity', async () => {
            mockRepository.create.mockReturnValue(createdEntity);
            mockRepository.save.mockResolvedValue(savedEntity);

            await repo.create(createData);

            expect(mockRepository.save).toHaveBeenCalledWith(createdEntity);
        });

        it('should return the saved User with id and timestamps', async () => {
            mockRepository.create.mockReturnValue(createdEntity);
            mockRepository.save.mockResolvedValue(savedEntity);

            const result = await repo.create(createData);

            expect(result).toBe(savedEntity);
            expect(result.id).toBe('uuid-new');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('update', () => {
        const existingUser = {
            id: 'uuid-1',
            email: 'test@example.com',
            passwordHash: 'hashed',
            firstName: 'Test',
            lastName: 'User',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
        } as User;

        it('should return null when user not found by id', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            const result = await repo.update('nonexistent-uuid', {
                firstName: 'Updated',
            });

            expect(result).toBeNull();
        });

        it('should call repository.save with merged data when user exists', async () => {
            const updateData: UpdateUserData = {
                firstName: 'Updated',
                lastName: 'Name',
            };
            const mergedUser = { ...existingUser, ...updateData };
            mockRepository.findOneBy.mockResolvedValue({ ...existingUser });
            mockRepository.save.mockResolvedValue(mergedUser);

            await repo.update('uuid-1', updateData);

            expect(mockRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'uuid-1',
                    firstName: 'Updated',
                    lastName: 'Name',
                }),
            );
        });

        it('should return the updated User', async () => {
            const updateData: UpdateUserData = { firstName: 'Updated' };
            const updatedUser = {
                ...existingUser,
                ...updateData,
                updatedAt: new Date(),
            };
            mockRepository.findOneBy.mockResolvedValue({ ...existingUser });
            mockRepository.save.mockResolvedValue(updatedUser);

            const result = await repo.update('uuid-1', updateData);

            expect(result).toBe(updatedUser);
            expect(result!.firstName).toBe('Updated');
        });

        it('should only merge provided fields (partial update)', async () => {
            const updateData: UpdateUserData = { firstName: 'OnlyFirst' };
            mockRepository.findOneBy.mockResolvedValue({ ...existingUser });
            mockRepository.save.mockResolvedValue({
                ...existingUser,
                firstName: 'OnlyFirst',
            });

            await repo.update('uuid-1', updateData);

            expect(mockRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    firstName: 'OnlyFirst',
                    lastName: 'User', // unchanged
                    email: 'test@example.com', // unchanged
                }),
            );
        });
    });

    describe('updatePasswordHash', () => {
        it('should call repository.update with the id and new password hash', async () => {
            mockRepository.update.mockResolvedValue({ affected: 1 });

            await repo.updatePasswordHash('uuid-1', 'new-hashed-password');

            expect(mockRepository.update).toHaveBeenCalledWith('uuid-1', {
                passwordHash: 'new-hashed-password',
            });
        });

        it('should return true when the user exists and hash is updated', async () => {
            mockRepository.update.mockResolvedValue({ affected: 1 });

            const result = await repo.updatePasswordHash(
                'uuid-1',
                'new-hashed-password',
            );

            expect(result).toBe(true);
        });

        it('should return false when the user does not exist', async () => {
            mockRepository.update.mockResolvedValue({ affected: 0 });

            const result = await repo.updatePasswordHash(
                'nonexistent-uuid',
                'new-hashed-password',
            );

            expect(result).toBe(false);
        });
    });
});
