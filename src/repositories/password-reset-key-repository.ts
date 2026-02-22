import { injectable, inject } from 'inversify';
import type { DataSource, Repository } from 'typeorm';

import { PasswordResetKey } from '../entities/password-reset-key';
import { TYPES } from '../lib/types';

export interface PasswordResetKeyRepository {
    save(keyHash: string, userId: string, expiresAt: Date): Promise<PasswordResetKey>;
    findByKeyHash(keyHash: string): Promise<PasswordResetKey | null>;
    deleteByKeyHash(keyHash: string): Promise<void>;
    deleteAllByUserId(userId: string): Promise<void>;
    deleteExpired(): Promise<void>;
}

@injectable()
export class PasswordResetKeyRepositoryImpl implements PasswordResetKeyRepository {
    private readonly repository: Repository<PasswordResetKey>;

    constructor(@inject(TYPES.DataSource) dataSource: DataSource) {
        this.repository = dataSource.getRepository(PasswordResetKey);
    }

    async save(keyHash: string, userId: string, expiresAt: Date): Promise<PasswordResetKey> {
        await this.deleteAllByUserId(userId);
        try {
            await this.deleteExpired();
        } catch {
            // Best-effort cleanup of expired keys — don't fail the save
        }
        const entity = this.repository.create({ keyHash, userId, expiresAt });
        return this.repository.save(entity);
    }

    async findByKeyHash(keyHash: string): Promise<PasswordResetKey | null> {
        return this.repository.findOneBy({ keyHash });
    }

    async deleteByKeyHash(keyHash: string): Promise<void> {
        await this.repository.delete({ keyHash });
    }

    async deleteAllByUserId(userId: string): Promise<void> {
        await this.repository.delete({ userId });
    }

    async deleteExpired(): Promise<void> {
        await this.repository
            .createQueryBuilder()
            .delete()
            .where('expires_at < NOW()')
            .execute();
    }
}
