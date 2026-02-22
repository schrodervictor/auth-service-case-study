import fs from 'node:fs';

import type { AppConfig } from '../../../src/config/schema';
import { loadSecrets } from '../../../src/config/secrets-loader';
import { makeTestConfig } from '../../helpers/test-config';

jest.mock('node:fs');
jest.mock('@aws-sdk/client-ssm');

const mockedFs = jest.mocked(fs);

const VALID_SECRETS = {
    jwtSecret: 'super-secret-key-256-bits-long',
    databaseUser: 'app_user',
    databasePassword: 'p@ssw0rd!',
};

const BASE_CONFIG = makeTestConfig();

function configWith(overrides: Record<string, unknown>) {
    return { ...BASE_CONFIG, ...overrides };
}

describe('loadSecrets', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.SECRETS_PATH;
    });

    describe('priority logic', () => {
        it('should use SSM backend when both ssm and SECRETS_PATH env var are set', async () => {
            // Import the mocked SSM module so we can set up return values
            const { SSMClient } = await import('@aws-sdk/client-ssm');
            const mockSend = jest.fn().mockResolvedValue({
                Parameters: [
                    { Name: '/app/jwt-secret', Value: VALID_SECRETS.jwtSecret },
                    { Name: '/app/db-user', Value: VALID_SECRETS.databaseUser },
                    {
                        Name: '/app/db-password',
                        Value: VALID_SECRETS.databasePassword,
                    },
                ],
            });
            (SSMClient as jest.Mock).mockImplementation(() => ({
                send: mockSend,
            }));

            process.env.SECRETS_PATH = '/tmp/secrets.json';
            const config = configWith({
                ssm: {
                    region: 'us-east-1',
                    parameters: {
                        jwtSecret: '/app/jwt-secret',
                        databaseUser: '/app/db-user',
                        databasePassword: '/app/db-password',
                    },
                },
            });

            await loadSecrets(config);

            // SSM was used, not file system
            expect(SSMClient).toHaveBeenCalled();
            expect(mockedFs.readFileSync).not.toHaveBeenCalled();
        });

        it('should use file backend when SECRETS_PATH env var is set and no ssm configured', async () => {
            mockedFs.readFileSync.mockReturnValue(
                JSON.stringify(VALID_SECRETS),
            );

            process.env.SECRETS_PATH = '/tmp/secrets.json';
            const config = configWith({});

            await loadSecrets(config);

            expect(mockedFs.readFileSync).toHaveBeenCalledWith(
                '/tmp/secrets.json',
                'utf-8',
            );
        });

        it('should throw when neither ssm nor SECRETS_PATH env var is configured', async () => {
            delete process.env.SECRETS_PATH;
            const config = configWith({
                ssm: undefined,
            });

            await expect(loadSecrets(config)).rejects.toThrow();
        });
    });

    describe('file backend', () => {
        function fileConfig(): AppConfig {
            return configWith({});
        }

        beforeEach(() => {
            process.env.SECRETS_PATH = '/tmp/secrets.json';
        });

        it('should parse valid JSON and return validated AppSecrets', async () => {
            mockedFs.readFileSync.mockReturnValue(
                JSON.stringify(VALID_SECRETS),
            );

            const result = await loadSecrets(fileConfig());

            expect(result).toEqual(VALID_SECRETS);
        });

        it('should read from the path specified in SECRETS_PATH env var', async () => {
            process.env.SECRETS_PATH = '/custom/path/secrets.json';
            mockedFs.readFileSync.mockReturnValue(
                JSON.stringify(VALID_SECRETS),
            );

            await loadSecrets(fileConfig());

            expect(mockedFs.readFileSync).toHaveBeenCalledWith(
                '/custom/path/secrets.json',
                'utf-8',
            );
        });

        it('should return a frozen object', async () => {
            mockedFs.readFileSync.mockReturnValue(
                JSON.stringify(VALID_SECRETS),
            );

            const result = await loadSecrets(fileConfig());

            expect(Object.isFrozen(result)).toBe(true);
        });

        it('should throw when JSON is missing required fields', async () => {
            mockedFs.readFileSync.mockReturnValue(
                JSON.stringify({ jwtSecret: 'only-one-field' }),
            );

            await expect(loadSecrets(fileConfig())).rejects.toThrow();
        });

        it('should throw when values are empty strings', async () => {
            mockedFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    jwtSecret: '',
                    databaseUser: '',
                    databasePassword: '',
                }),
            );

            await expect(loadSecrets(fileConfig())).rejects.toThrow();
        });

        it('should propagate error when file is not found', async () => {
            mockedFs.readFileSync.mockImplementation(() => {
                throw new Error('ENOENT: no such file or directory');
            });

            await expect(loadSecrets(fileConfig())).rejects.toThrow(/ENOENT/);
        });

        it('should throw when file contains malformed JSON', async () => {
            mockedFs.readFileSync.mockReturnValue('{ not valid json !!!');

            await expect(loadSecrets(fileConfig())).rejects.toThrow();
        });
    });

    describe('SSM backend', () => {
        const SSM_PARAMS = {
            jwtSecret: '/app/jwt-secret',
            databaseUser: '/app/db-user',
            databasePassword: '/app/db-password',
        };

        function ssmConfig(region = 'us-east-1'): AppConfig {
            return configWith({
                ssm: { region, parameters: SSM_PARAMS },
            });
        }

        let SSMClient: jest.Mock;
        let GetParametersCommand: jest.Mock;
        let mockSend: jest.Mock;

        beforeEach(async () => {
            const ssmModule = await import('@aws-sdk/client-ssm');
            SSMClient = ssmModule.SSMClient as jest.Mock;
            GetParametersCommand =
                ssmModule.GetParametersCommand as unknown as jest.Mock;

            mockSend = jest.fn();
            SSMClient.mockImplementation(() => ({ send: mockSend }));
            GetParametersCommand.mockImplementation((input: unknown) => input);
        });

        it('should create SSMClient with the correct region from config', async () => {
            mockSend.mockResolvedValue({
                Parameters: [
                    {
                        Name: SSM_PARAMS.jwtSecret,
                        Value: VALID_SECRETS.jwtSecret,
                    },
                    {
                        Name: SSM_PARAMS.databaseUser,
                        Value: VALID_SECRETS.databaseUser,
                    },
                    {
                        Name: SSM_PARAMS.databasePassword,
                        Value: VALID_SECRETS.databasePassword,
                    },
                ],
            });

            await loadSecrets(ssmConfig('eu-west-1'));

            expect(SSMClient).toHaveBeenCalledWith({ region: 'eu-west-1' });
        });

        it('should call GetParametersCommand with WithDecryption: true', async () => {
            mockSend.mockResolvedValue({
                Parameters: [
                    {
                        Name: SSM_PARAMS.jwtSecret,
                        Value: VALID_SECRETS.jwtSecret,
                    },
                    {
                        Name: SSM_PARAMS.databaseUser,
                        Value: VALID_SECRETS.databaseUser,
                    },
                    {
                        Name: SSM_PARAMS.databasePassword,
                        Value: VALID_SECRETS.databasePassword,
                    },
                ],
            });

            await loadSecrets(ssmConfig());

            expect(GetParametersCommand).toHaveBeenCalledWith(
                expect.objectContaining({ WithDecryption: true }),
            );
        });

        it('should map SSM parameter names to AppSecrets keys correctly', async () => {
            mockSend.mockResolvedValue({
                Parameters: [
                    {
                        Name: SSM_PARAMS.jwtSecret,
                        Value: VALID_SECRETS.jwtSecret,
                    },
                    {
                        Name: SSM_PARAMS.databaseUser,
                        Value: VALID_SECRETS.databaseUser,
                    },
                    {
                        Name: SSM_PARAMS.databasePassword,
                        Value: VALID_SECRETS.databasePassword,
                    },
                ],
            });

            const result = await loadSecrets(ssmConfig());

            expect(result).toEqual(VALID_SECRETS);
        });

        it('should return a frozen object', async () => {
            mockSend.mockResolvedValue({
                Parameters: [
                    {
                        Name: SSM_PARAMS.jwtSecret,
                        Value: VALID_SECRETS.jwtSecret,
                    },
                    {
                        Name: SSM_PARAMS.databaseUser,
                        Value: VALID_SECRETS.databaseUser,
                    },
                    {
                        Name: SSM_PARAMS.databasePassword,
                        Value: VALID_SECRETS.databasePassword,
                    },
                ],
            });

            const result = await loadSecrets(ssmConfig());

            expect(Object.isFrozen(result)).toBe(true);
        });

        it('should throw when SSM returns incomplete parameters', async () => {
            mockSend.mockResolvedValue({
                Parameters: [
                    {
                        Name: SSM_PARAMS.jwtSecret,
                        Value: VALID_SECRETS.jwtSecret,
                    },
                    // Missing databaseUser and databasePassword
                ],
            });

            await expect(loadSecrets(ssmConfig())).rejects.toThrow();
        });

        it('should handle multiple keys mapping to the same SSM parameter name', async () => {
            const config = configWith({
                ssm: {
                    region: 'us-east-1',
                    parameters: {
                        jwtSecret: '/shared/secret',
                        databaseUser: '/shared/secret',
                        databasePassword: '/db/pass',
                    },
                },
            });

            mockSend.mockResolvedValue({
                Parameters: [
                    { Name: '/shared/secret', Value: 'shared-value' },
                    { Name: '/db/pass', Value: 'db-pass' },
                ],
            });

            const result = await loadSecrets(config);

            expect(result).toEqual({
                jwtSecret: 'shared-value',
                databaseUser: 'shared-value',
                databasePassword: 'db-pass',
            });
        });

        it('should propagate SSM client errors', async () => {
            mockSend.mockRejectedValue(new Error('SSM access denied'));

            await expect(loadSecrets(ssmConfig())).rejects.toThrow(
                /SSM access denied/,
            );
        });
    });
});
