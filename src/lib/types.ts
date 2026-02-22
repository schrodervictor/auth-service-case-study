export const TYPES = {
    Config: Symbol.for('Config'),
    DataSource: Symbol.for('DataSource'),

    Producer: Symbol.for('Producer'),

    // // Services
    // ExampleService: Symbol.for('ExampleService'),
    UserService: Symbol.for('UserService'),
    PasswordManagerService: Symbol.for('PasswordManagerService'),

    // Secrets
    Secrets: Symbol.for('Secrets'),

    // Redis
    RedisClient: Symbol.for('RedisClient'),

    // Middleware
    AuthMiddleware: Symbol.for('AuthMiddleware'),
    JsonContentType: Symbol.for('JsonContentType'),
    LoginRateLimiter: Symbol.for('LoginRateLimiter'),
    RefreshRateLimiter: Symbol.for('RefreshRateLimiter'),

    // Repositories
    UserRepository: Symbol.for('UserRepository'),
    RefreshTokenRepository: Symbol.for('RefreshTokenRepository'),
};
