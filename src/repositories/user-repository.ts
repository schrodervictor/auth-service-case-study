import { injectable, inject } from 'inversify';
import type { DataSource, Repository } from 'typeorm';

import { User } from '../entities/user';
import { TYPES } from '../lib/types';

export type CreateUserData = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
};

export type UpdateUserData = {
    firstName?: string;
    lastName?: string;
};

export interface UserRepository {
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(data: CreateUserData): Promise<User>;
    update(id: string, data: UpdateUserData): Promise<User | null>;
}

@injectable()
export class UserRepositoryImpl implements UserRepository {
    private readonly repository: Repository<User>;

    constructor(@inject(TYPES.DataSource) dataSource: DataSource) {
        this.repository = dataSource.getRepository(User);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.repository.findOneBy({ email });
    }

    async findById(id: string): Promise<User | null> {
        return this.repository.findOneBy({ id });
    }

    async create(data: CreateUserData): Promise<User> {
        const entity = this.repository.create(data);
        return this.repository.save(entity);
    }

    async update(id: string, data: UpdateUserData): Promise<User | null> {
        const user = await this.repository.findOneBy({ id });
        if (user === null) {
            return null;
        }
        Object.assign(user, data);
        return this.repository.save(user);
    }
}
