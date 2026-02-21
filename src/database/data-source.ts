import { DataSource } from 'typeorm';
import { AppConfig } from '../config/schema';
import { User } from '../entities/user';
import { RefreshToken } from '../entities/refresh-token';
import { CreateUser1740000000000 } from '../migrations/1740000000000-CreateUser';
import { CreateRefreshTokensTable1740100000000 } from '../migrations/1740100000000-CreateRefreshTokensTable';

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
        entities: [User, RefreshToken],
        migrations: [CreateUser1740000000000, CreateRefreshTokensTable1740100000000],
    });
}
