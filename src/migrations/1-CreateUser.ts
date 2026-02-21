import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUser1 implements MigrationInterface {
    name = 'CreateUser1';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

            CREATE TABLE "users" (
                "id"         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                "email"      VARCHAR NOT NULL UNIQUE,
                "password"   VARCHAR NOT NULL,
                "first_name" VARCHAR NOT NULL,
                "last_name"  VARCHAR NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    }
}
