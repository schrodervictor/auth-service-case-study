/**
 * Integration test example — requires a running database.
 * Run with: npm run test:integration
 *
 * Prerequisites:
 *   docker compose up postgres
 */
describe('Database integration', () => {
    it.todo('connects to PostgreSQL and runs a raw query');

    // Uses TypeORM DataSource against a running postgres:
    //   import { DataSource } from 'typeorm';
    //   let dataSource: DataSource;
    //   beforeAll(async () => {
    //       dataSource = new DataSource({ type: 'postgres', ... });
    //       await dataSource.initialize();
    //   });
    //   afterAll(async () => { await dataSource?.destroy(); });
    //   it('executes a raw SQL query', async () => {
    //       const result = await dataSource.query('SELECT 1 AS value');
    //       expect(result[0].value).toBe(1);
    //   });
});
