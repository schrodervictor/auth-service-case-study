/**
 * Integration test example — requires a running database.
 * Run with: npm run test:integration
 *
 * Prerequisites:
 *   docker compose up postgres
 */
import { DataSource } from 'typeorm';

describe('Database integration', () => {
    it.todo('connects to PostgreSQL and runs a raw query');

    // Uncomment and adapt once entities exist:
    //
    // let dataSource: DataSource;
    //
    // beforeAll(async () => {
    //     dataSource = new DataSource({
    //         type: 'postgres',
    //         host: process.env.DB_HOST ?? 'localhost',
    //         port: Number(process.env.DB_PORT ?? 5432),
    //         username: process.env.DB_USER ?? 'postgres',
    //         password: process.env.DB_PASSWORD ?? 'postgres',
    //         database: process.env.DB_NAME ?? 'test',
    //         synchronize: false,
    //     });
    //     await dataSource.initialize();
    // });
    //
    // afterAll(async () => {
    //     await dataSource?.destroy();
    // });
    //
    // it('executes a raw SQL query', async () => {
    //     const result = await dataSource.query('SELECT 1 AS value');
    //     expect(result[0].value).toBe(1);
    // });
});
