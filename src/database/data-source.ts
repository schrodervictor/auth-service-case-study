import { DataSource } from 'typeorm';
import { AppConfig } from '../config/schema';
import { User } from '../entities/user';
import { CreateUser1 } from '../migrations/1-CreateUser';

export interface DatabaseCredentials {
    username: string;
    password: string;
}

export function createDataSource(
    config: AppConfig,
    credentials: DatabaseCredentials,
): DataSource {
    return new DataSource({
        type: 'postgres',
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        username: credentials.username,
        password: credentials.password,
        synchronize: false,
        entities: [User],
        migrations: [CreateUser1],
    });
}

export function loadDatabaseCredentials(): DatabaseCredentials {
    const username = process.env.DATABASE_USER;
    const password = process.env.DATABASE_PASSWORD;

    if (!username) {
        throw new Error('Missing required environment variable: DATABASE_USER');
    }

    if (!password) {
        throw new Error('Missing required environment variable: DATABASE_PASSWORD');
    }

    return { username, password };
}
