import 'reflect-metadata';
import type { DataSource } from 'typeorm';

import { PasswordResetKeyRepositoryImpl } from '../../../src/repositories/password-reset-key-repository';
import { PasswordResetKey } from '../../../src/entities/password-reset-key';

const createMockRepository = () => ({
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
});

const createMockDataSource = (
    mockRepository: ReturnType<typeof createMockRepository>,
) =>
    ({
        getRepository: jest.fn().mockReturnValue(mockRepository),
    }) as unknown as DataSource;

describe('PasswordResetKeyRepositoryImpl', () => {
    let mockRepository: ReturnType<typeof createMockRepository>;
    let mockDataSource: DataSource;
    let repo: PasswordResetKeyRepositoryImpl;

    beforeEach(() => {
        mockRepository = createMockRepository();
        mockDataSource = createMockDataSource(mockRepository);
        repo = new PasswordResetKeyRepositoryImpl(mockDataSource);
    });

    describe('constructor', () => {
        it('should call dataSource.getRepository(PasswordResetKey)', () => {
            expect(mockDataSource.getRepository).toHaveBeenCalledWith(
                PasswordResetKey,
            );
        });
    });

    describe('save', () => {
        const keyHash = 'hashed-reset-key-value';
        const userId = 'user-uuid-1';
        const expiresAt = new Date('2026-03-01T00:00:00Z');

        const createdEntity = {
            keyHash,
            userId,
            expiresAt,
        } as PasswordResetKey;

        const savedEntity = {
            id: 'reset-key-uuid-1',
            keyHash,
            userId,
            expiresAt,
            createdAt: new Date(),
        } as PasswordResetKey;

        beforeEach(() => {
            mockRepository.create.mockReturnValue(createdEntity);
            mockRepository.save.mockResolvedValue(savedEntity);
            mockRepository.delete.mockResolvedValue({ affected: 0 });
        });

        it('should call deleteAllByUserId before inserting (single key per user)', async () => {
            await repo.save(keyHash, userId, expiresAt);

            expect(mockRepository.delete).toHaveBeenCalledWith({ userId });
        });

        it('should call deleteExpired for lazy cleanup before inserting', async () => {
            const mockQueryBuilder = {
                delete: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 0 }),
            };
            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await repo.save(keyHash, userId, expiresAt);

            expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
        });

        it('should call deleteAllByUserId before deleteExpired', async () => {
            const callOrder: string[] = [];

            mockRepository.delete.mockImplementation(async () => {
                callOrder.push('deleteAllByUserId');
                return { affected: 0 };
            });

            const mockQueryBuilder = {
                delete: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockImplementation(async () => {
                    callOrder.push('deleteExpired');
                    return { affected: 0 };
                }),
            };
            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await repo.save(keyHash, userId, expiresAt);

            expect(callOrder.indexOf('deleteAllByUserId')).toBeLessThan(
                callOrder.indexOf('deleteExpired'),
            );
        });

        it('should call repository.create with keyHash, userId, and expiresAt', async () => {
            await repo.save(keyHash, userId, expiresAt);

            expect(mockRepository.create).toHaveBeenCalledWith({
                keyHash,
                userId,
                expiresAt,
            });
        });

        it('should call repository.save with the created entity', async () => {
            await repo.save(keyHash, userId, expiresAt);

            expect(mockRepository.save).toHaveBeenCalledWith(createdEntity);
        });

        it('should return the saved PasswordResetKey', async () => {
            await repo.save(keyHash, userId, expiresAt);

            const result = await repo.save(keyHash, userId, expiresAt);

            expect(result).toBe(savedEntity);
            expect(result.id).toBe('reset-key-uuid-1');
        });
    });

    describe('findByKeyHash', () => {
        it('should call repository.findOneBy with the given keyHash', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            await repo.findByKeyHash('some-hash');

            expect(mockRepository.findOneBy).toHaveBeenCalledWith({
                keyHash: 'some-hash',
            });
        });

        it('should return the PasswordResetKey when found', async () => {
            const key = {
                id: 'reset-key-uuid-1',
                keyHash: 'some-hash',
                userId: 'user-uuid-1',
                expiresAt: new Date('2026-03-01'),
                createdAt: new Date(),
            } as PasswordResetKey;
            mockRepository.findOneBy.mockResolvedValue(key);

            const result = await repo.findByKeyHash('some-hash');

            expect(result).toBe(key);
        });

        it('should return null when not found', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            const result = await repo.findByKeyHash('nonexistent-hash');

            expect(result).toBeNull();
        });
    });

    describe('deleteByKeyHash', () => {
        it('should call repository.delete with the given keyHash', async () => {
            mockRepository.delete.mockResolvedValue({ affected: 1 });

            await repo.deleteByKeyHash('some-hash');

            expect(mockRepository.delete).toHaveBeenCalledWith({
                keyHash: 'some-hash',
            });
        });
    });

    describe('deleteAllByUserId', () => {
        it('should call repository.delete with the given userId', async () => {
            mockRepository.delete.mockResolvedValue({ affected: 3 });

            await repo.deleteAllByUserId('user-uuid-1');

            expect(mockRepository.delete).toHaveBeenCalledWith({
                userId: 'user-uuid-1',
            });
        });
    });

    describe('deleteExpired', () => {
        it('should delete records where expires_at is in the past', async () => {
            const mockQueryBuilder = {
                delete: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 2 }),
            };
            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await repo.deleteExpired();

            expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
            expect(mockQueryBuilder.delete).toHaveBeenCalled();
            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'expires_at < NOW()',
            );
            expect(mockQueryBuilder.execute).toHaveBeenCalled();
        });
    });
});
