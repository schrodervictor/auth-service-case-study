import { Container } from 'inversify';

import './lib/base-controller';
import './controllers/health-check-controller';
// import './controllers';

// import {
//     ExampleService,
//     ExampleServiceImpl,
//     UserService,
//     UserServiceImpl,
//     PasswordManagerService,
//     PasswordManagerServiceImpl,
// } from './services';
// import { UserRepository, UserRepositoryImpl } from './repositories';

// import { TYPES } from './lib';

export const diContainer = new Container();

// // bind services
// diContainer.bind<ExampleService>(TYPES.ExampleService).to(ExampleServiceImpl);
// diContainer.bind<UserService>(TYPES.UserService).to(UserServiceImpl);
// diContainer
//     .bind<PasswordManagerService>(TYPES.PasswordManagerService)
//     .to(PasswordManagerServiceImpl);

// // bind repositories
// diContainer.bind<UserRepository>(TYPES.UserRepository).to(UserRepositoryImpl);
