export const TYPES = {
    Config: Symbol.for('Config'),
    DataSource: Symbol.for('DataSource'),

    // DB: Symbol.for('DB'),
    // producer: Symbol.for('producer'),

    // // Services
    // ExampleService: Symbol.for('ExampleService'),
    UserService: Symbol.for('UserService'),
    PasswordManagerService: Symbol.for('PasswordManagerService'),

    // Secrets
    Secrets: Symbol.for('Secrets'),

    // Middleware
    AuthMiddleware: Symbol.for('AuthMiddleware'),

    // Repositories
    UserRepository: Symbol.for('UserRepository'),
    RefreshTokenRepository: Symbol.for('RefreshTokenRepository'),
};
