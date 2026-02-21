import { Container } from 'inversify';
import type { DataSource } from 'typeorm';

import './lib/base-controller';
import './controllers/health-check-controller';
import './controllers/user-controller';

import type { AppConfig } from './config/schema';
import { TYPES } from './lib/types';

import {
    PasswordManagerService,
    PasswordManagerServiceImpl,
} from './services';
import type { UserService } from './services/user-service';
import { UserServiceImpl } from './services/user-service';
import { UserRepository, UserRepositoryImpl } from './repositories';

export function createContainer(config: AppConfig, dataSource: DataSource): Container {
    if (config == null) {
        throw new Error('Config is required to create the DI container');
    }

    const container = new Container();

    container.bind<AppConfig>(TYPES.Config).toConstantValue(config);
    container.bind<DataSource>(TYPES.DataSource).toConstantValue(dataSource);

    // bind services
    container.bind<UserService>(TYPES.UserService).to(UserServiceImpl);
    container
        .bind<PasswordManagerService>(TYPES.PasswordManagerService)
        .to(PasswordManagerServiceImpl);

    // bind repositories
    container.bind<UserRepository>(TYPES.UserRepository).to(UserRepositoryImpl);

    return container;
}

// Keep backward-compatible default export for existing code
export const diContainer = new Container();
