import 'reflect-metadata';
import type { DataSource } from 'typeorm';

import { RefreshTokenRepositoryImpl } from '../../../src/repositories/refresh-token-repository';
import { RefreshToken } from '../../../src/entities/refresh-token';

const createMockRepository = () => ({
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
});

const createMockDataSource = (
    mockRepository: ReturnType<typeof createMockRepository>,
) =>
    ({
        getRepository: jest.fn().mockReturnValue(mockRepository),
    }) as unknown as DataSource;

describe('RefreshTokenRepositoryImpl', () => {
    let mockRepository: ReturnType<typeof createMockRepository>;
    let mockDataSource: DataSource;
    let repo: RefreshTokenRepositoryImpl;

    beforeEach(() => {
        mockRepository = createMockRepository();
        mockDataSource = createMockDataSource(mockRepository);
        repo = new RefreshTokenRepositoryImpl(mockDataSource);
    });

    describe('constructor', () => {
        it('should call dataSource.getRepository(RefreshToken)', () => {
            expect(mockDataSource.getRepository).toHaveBeenCalledWith(
                RefreshToken,
            );
        });
    });

    describe('save', () => {
        const tokenHash = 'hashed-token-value';
        const userId = 'user-uuid-1';
        const expiresAt = new Date('2026-03-01T00:00:00Z');

        const createdEntity = {
            tokenHash,
            userId,
            expiresAt,
        } as RefreshToken;

        const savedEntity = {
            id: 'token-uuid-1',
            tokenHash,
            userId,
            expiresAt,
            createdAt: new Date(),
        } as RefreshToken;

        it('should call repository.create with tokenHash, userId, and expiresAt', async () => {
            mockRepository.create.mockReturnValue(createdEntity);
            mockRepository.save.mockResolvedValue(savedEntity);

            await repo.save(tokenHash, userId, expiresAt);

            expect(mockRepository.create).toHaveBeenCalledWith({
                tokenHash,
                userId,
                expiresAt,
            });
        });

        it('should call repository.save with the created entity', async () => {
            mockRepository.create.mockReturnValue(createdEntity);
            mockRepository.save.mockResolvedValue(savedEntity);

            await repo.save(tokenHash, userId, expiresAt);

            expect(mockRepository.save).toHaveBeenCalledWith(createdEntity);
        });

        it('should return the saved RefreshToken', async () => {
            mockRepository.create.mockReturnValue(createdEntity);
            mockRepository.save.mockResolvedValue(savedEntity);

            const result = await repo.save(tokenHash, userId, expiresAt);

            expect(result).toBe(savedEntity);
            expect(result.id).toBe('token-uuid-1');
        });
    });

    describe('findByTokenHash', () => {
        it('should call repository.findOneBy with the given tokenHash', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            await repo.findByTokenHash('some-hash');

            expect(mockRepository.findOneBy).toHaveBeenCalledWith({
                tokenHash: 'some-hash',
            });
        });

        it('should return the RefreshToken when found', async () => {
            const token = {
                id: 'token-uuid-1',
                tokenHash: 'some-hash',
                userId: 'user-uuid-1',
                expiresAt: new Date('2026-03-01'),
                createdAt: new Date(),
            } as RefreshToken;
            mockRepository.findOneBy.mockResolvedValue(token);

            const result = await repo.findByTokenHash('some-hash');

            expect(result).toBe(token);
        });

        it('should return null when not found', async () => {
            mockRepository.findOneBy.mockResolvedValue(null);

            const result = await repo.findByTokenHash('nonexistent-hash');

            expect(result).toBeNull();
        });
    });

    describe('deleteByTokenHash', () => {
        it('should call repository.delete with the given tokenHash', async () => {
            mockRepository.delete.mockResolvedValue({ affected: 1 });

            await repo.deleteByTokenHash('some-hash');

            expect(mockRepository.delete).toHaveBeenCalledWith({
                tokenHash: 'some-hash',
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
});
