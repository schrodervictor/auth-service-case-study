import { openApiSpec } from '../../../src/openapi';

describe('OpenAPI Spec', () => {
    describe('required top-level fields', () => {
        it('should have openapi version 3.0.3', () => {
            expect(openApiSpec.openapi).toBe('3.0.3');
        });

        it('should have info with title and version', () => {
            expect(openApiSpec.info).toBeDefined();
            expect(openApiSpec.info.title).toBe('User Authentication Service');
            expect(openApiSpec.info.version).toBe('1.0.0');
        });

        it('should have a paths object', () => {
            expect(openApiSpec.paths).toBeDefined();
            expect(typeof openApiSpec.paths).toBe('object');
        });
    });

    describe('servers', () => {
        it('should define the base server URL', () => {
            expect(openApiSpec.servers).toBeDefined();
            expect(openApiSpec.servers).toContainEqual(
                expect.objectContaining({ url: '/partner-app/api' }),
            );
        });
    });

    describe('endpoint paths', () => {
        const expectedPaths = [
            '/health-check',
            '/users/register',
            '/users/login',
            '/users/refresh',
            '/users/logout',
            '/users/profile',
        ];

        it.each(expectedPaths)('should define path %s', (path) => {
            expect(openApiSpec.paths[path]).toBeDefined();
        });

        it('should not have extraneous paths', () => {
            const actualPaths = Object.keys(openApiSpec.paths);
            expect(actualPaths.sort()).toEqual([...expectedPaths].sort());
        });
    });

    describe('HTTP methods', () => {
        it('should define GET for /health-check', () => {
            expect(openApiSpec.paths['/health-check'].get).toBeDefined();
        });

        it('should define POST for /users/register', () => {
            expect(openApiSpec.paths['/users/register'].post).toBeDefined();
        });

        it('should define POST for /users/login', () => {
            expect(openApiSpec.paths['/users/login'].post).toBeDefined();
        });

        it('should define POST for /users/refresh', () => {
            expect(openApiSpec.paths['/users/refresh'].post).toBeDefined();
        });

        it('should define POST for /users/logout', () => {
            expect(openApiSpec.paths['/users/logout'].post).toBeDefined();
        });

        it('should define GET for /users/profile', () => {
            expect(openApiSpec.paths['/users/profile'].get).toBeDefined();
        });

        it('should define PUT for /users/profile', () => {
            expect(openApiSpec.paths['/users/profile'].put).toBeDefined();
        });
    });

    describe('security annotations', () => {
        describe('protected endpoints should require bearerAuth', () => {
            it('should require bearerAuth for POST /users/logout', () => {
                expect(openApiSpec.paths['/users/logout'].post.security).toEqual([
                    { bearerAuth: [] },
                ]);
            });

            it('should require bearerAuth for GET /users/profile', () => {
                expect(openApiSpec.paths['/users/profile'].get.security).toEqual([
                    { bearerAuth: [] },
                ]);
            });

            it('should require bearerAuth for PUT /users/profile', () => {
                expect(openApiSpec.paths['/users/profile'].put.security).toEqual([
                    { bearerAuth: [] },
                ]);
            });
        });

        describe('public endpoints should NOT have security', () => {
            it('should not have security on GET /health-check', () => {
                expect(
                    openApiSpec.paths['/health-check'].get.security,
                ).toBeUndefined();
            });

            it('should not have security on POST /users/register', () => {
                expect(
                    openApiSpec.paths['/users/register'].post.security,
                ).toBeUndefined();
            });

            it('should not have security on POST /users/login', () => {
                expect(
                    openApiSpec.paths['/users/login'].post.security,
                ).toBeUndefined();
            });

            it('should not have security on POST /users/refresh', () => {
                expect(
                    openApiSpec.paths['/users/refresh'].post.security,
                ).toBeUndefined();
            });
        });
    });

    describe('response status codes', () => {
        it('should define 200 for GET /health-check', () => {
            const responses = openApiSpec.paths['/health-check'].get.responses;
            expect(responses['200']).toBeDefined();
        });

        it('should define 201, 409, 415, 422 for POST /users/register', () => {
            const responses = openApiSpec.paths['/users/register'].post.responses;
            expect(responses['201']).toBeDefined();
            expect(responses['409']).toBeDefined();
            expect(responses['415']).toBeDefined();
            expect(responses['422']).toBeDefined();
        });

        it('should define 200, 401, 415, 422, 429 for POST /users/login', () => {
            const responses = openApiSpec.paths['/users/login'].post.responses;
            expect(responses['200']).toBeDefined();
            expect(responses['401']).toBeDefined();
            expect(responses['415']).toBeDefined();
            expect(responses['422']).toBeDefined();
            expect(responses['429']).toBeDefined();
        });

        it('should define 200, 401, 415, 422, 429 for POST /users/refresh', () => {
            const responses = openApiSpec.paths['/users/refresh'].post.responses;
            expect(responses['200']).toBeDefined();
            expect(responses['401']).toBeDefined();
            expect(responses['415']).toBeDefined();
            expect(responses['422']).toBeDefined();
            expect(responses['429']).toBeDefined();
        });

        it('should define 204, 401 for POST /users/logout', () => {
            const responses = openApiSpec.paths['/users/logout'].post.responses;
            expect(responses['204']).toBeDefined();
            expect(responses['401']).toBeDefined();
        });

        it('should define 200, 401 for GET /users/profile', () => {
            const responses = openApiSpec.paths['/users/profile'].get.responses;
            expect(responses['200']).toBeDefined();
            expect(responses['401']).toBeDefined();
        });

        it('should define 200, 400, 401, 415, 422 for PUT /users/profile', () => {
            const responses = openApiSpec.paths['/users/profile'].put.responses;
            expect(responses['200']).toBeDefined();
            expect(responses['400']).toBeDefined();
            expect(responses['401']).toBeDefined();
            expect(responses['415']).toBeDefined();
            expect(responses['422']).toBeDefined();
        });
    });

    describe('component schemas', () => {
        const expectedSchemas = [
            'UserResponse',
            'AuthResponse',
            'ErrorResponse',
            'ValidationErrorResponse',
            'RegisterRequest',
            'LoginRequest',
            'RefreshRequest',
            'UpdateProfileRequest',
        ];

        it.each(expectedSchemas)('should define %s schema', (schemaName) => {
            expect(openApiSpec.components.schemas[schemaName]).toBeDefined();
        });
    });

    describe('security schemes', () => {
        it('should define bearerAuth security scheme', () => {
            const bearerAuth = openApiSpec.components.securitySchemes?.bearerAuth;
            expect(bearerAuth).toBeDefined();
            expect(bearerAuth.type).toBe('http');
            expect(bearerAuth.scheme).toBe('bearer');
            expect(bearerAuth.bearerFormat).toBe('JWT');
        });
    });
});
