import { injectable, inject } from 'inversify';
import type { DataSource, Repository } from 'typeorm';

import { RefreshToken } from '../entities/refresh-token';
import { TYPES } from '../lib/types';

export interface RefreshTokenRepository {
    save(
        tokenHash: string,
        userId: string,
        expiresAt: Date,
    ): Promise<RefreshToken>;
    findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
    deleteByTokenHash(tokenHash: string): Promise<void>;
    deleteAllByUserId(userId: string): Promise<void>;
}

@injectable()
export class RefreshTokenRepositoryImpl implements RefreshTokenRepository {
    private readonly repository: Repository<RefreshToken>;

    constructor(@inject(TYPES.DataSource) dataSource: DataSource) {
        this.repository = dataSource.getRepository(RefreshToken);
    }

    async save(
        tokenHash: string,
        userId: string,
        expiresAt: Date,
    ): Promise<RefreshToken> {
        const entity = this.repository.create({ tokenHash, userId, expiresAt });
        return this.repository.save(entity);
    }

    async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
        return this.repository.findOneBy({ tokenHash });
    }

    async deleteByTokenHash(tokenHash: string): Promise<void> {
        await this.repository.delete({ tokenHash });
    }

    async deleteAllByUserId(userId: string): Promise<void> {
        await this.repository.delete({ userId });
    }
}
