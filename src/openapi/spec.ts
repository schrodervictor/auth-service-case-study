interface OpenApiOperation {
    tags: string[];
    summary: string;
    description: string;
    operationId: string;
    security?: Array<Record<string, string[]>>;
    requestBody?: object;
    responses: Record<string, object>;
    [key: string]: unknown;
}

interface OpenApiSpec {
    openapi: string;
    info: { title: string; version: string; description: string };
    servers: Array<{ url: string }>;
    tags: Array<{ name: string; description: string }>;
    paths: Record<string, Record<string, OpenApiOperation>>;
    components: {
        schemas: Record<string, object>;
        securitySchemes: Record<string, Record<string, string>>;
    };
}

export const openApiSpec: OpenApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'User Authentication Service',
        version: '1.0.0',
        description:
            'A RESTful authentication service providing user registration, login, token refresh, and profile management.',
    },
    servers: [{ url: '/partner-app/api' }],
    tags: [
        { name: 'Health', description: 'Service health checks' },
        { name: 'Auth', description: 'Authentication and token management' },
        { name: 'Profile', description: 'User profile operations' },
    ],
    paths: {
        '/health-check': {
            get: {
                tags: ['Health'],
                summary: 'Health check',
                description: 'Returns the service health status.',
                operationId: 'healthCheck',
                responses: {
                    '200': {
                        description: 'Service is healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string', example: 'Service is up and running' },
                                    },
                                    required: ['message'],
                                },
                            },
                        },
                    },
                },
            },
        },
        '/users/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new user',
                description: 'Creates a new user account with the provided details.',
                operationId: 'register',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RegisterRequest' },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'User registered successfully',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UserResponse' },
                            },
                        },
                    },
                    '400': {
                        description: 'Missing required fields',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '409': {
                        description: 'Email already registered',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '422': {
                        description: 'Validation failed',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/users/login': {
            post: {
                tags: ['Auth'],
                summary: 'Log in',
                description:
                    'Authenticates a user and returns access and refresh tokens. Rate-limited to 5 attempts per 15 minutes per IP.',
                operationId: 'login',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LoginRequest' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/AuthResponse' },
                            },
                        },
                    },
                    '400': {
                        description: 'Missing required fields',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '401': {
                        description: 'Invalid email or password',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '429': {
                        description: 'Too many requests',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                        headers: {
                            'Retry-After': {
                                description: 'Seconds until the rate limit resets',
                                schema: { type: 'integer' },
                            },
                        },
                    },
                },
            },
        },
        '/users/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh access token',
                description:
                    'Exchanges a valid refresh token for a new access/refresh token pair. Rate-limited to 10 attempts per 15 minutes per IP.',
                operationId: 'refresh',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RefreshRequest' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Token refreshed successfully',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/AuthResponse' },
                            },
                        },
                    },
                    '400': {
                        description: 'Missing required fields',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '401': {
                        description: 'Invalid or expired refresh token',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '429': {
                        description: 'Too many requests',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                        headers: {
                            'Retry-After': {
                                description: 'Seconds until the rate limit resets',
                                schema: { type: 'integer' },
                            },
                        },
                    },
                },
            },
        },
        '/users/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Log out',
                description: 'Revokes the refresh token for the authenticated user.',
                operationId: 'logout',
                security: [{ bearerAuth: [] }],
                responses: {
                    '204': {
                        description: 'Logged out successfully',
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/users/profile': {
            get: {
                tags: ['Profile'],
                summary: 'Get user profile',
                description: 'Returns the profile of the authenticated user.',
                operationId: 'getProfile',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': {
                        description: 'Profile retrieved successfully',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UserResponse' },
                            },
                        },
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            put: {
                tags: ['Profile'],
                summary: 'Update user profile',
                description:
                    'Updates the profile of the authenticated user. At least one field must be provided.',
                operationId: 'updateProfile',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UpdateProfileRequest' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Profile updated successfully',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UserResponse' },
                            },
                        },
                    },
                    '400': {
                        description: 'At least one field is required',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '422': {
                        description: 'Validation failed',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            UserResponse: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    firstName: { type: 'string', example: 'John' },
                    lastName: { type: 'string', example: 'Doe' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
                required: ['id', 'email', 'firstName', 'lastName', 'createdAt', 'updatedAt'],
            },
            AuthResponse: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    refreshToken: { type: 'string', example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...' },
                },
                required: ['accessToken', 'refreshToken'],
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string', example: 'Error description' },
                },
                required: ['message'],
            },
            ValidationErrorResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string', example: 'Validation failed' },
                    errors: {
                        type: 'object',
                        additionalProperties: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        example: { email: ['must be a valid email address'] },
                    },
                },
                required: ['message', 'errors'],
            },
            RegisterRequest: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    password: { type: 'string', format: 'password', example: 'SecureP@ss1' },
                    firstName: { type: 'string', example: 'John' },
                    lastName: { type: 'string', example: 'Doe' },
                },
                required: ['email', 'password', 'firstName', 'lastName'],
            },
            LoginRequest: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    password: { type: 'string', format: 'password', example: 'SecureP@ss1' },
                },
                required: ['email', 'password'],
            },
            RefreshRequest: {
                type: 'object',
                properties: {
                    refreshToken: { type: 'string', example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...' },
                },
                required: ['refreshToken'],
            },
            UpdateProfileRequest: {
                type: 'object',
                properties: {
                    firstName: { type: 'string', example: 'Jane' },
                    lastName: { type: 'string', example: 'Smith' },
                },
            },
        },
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
    },
};
