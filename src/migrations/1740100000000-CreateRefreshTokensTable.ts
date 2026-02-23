import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokensTable1740100000000 implements MigrationInterface {
    name = 'CreateRefreshTokensTable1740100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "refresh_tokens" (
                "id"         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                "token_hash" VARCHAR NOT NULL,
                "user_id"    UUID NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "fk_refresh_tokens_user"
                    FOREIGN KEY ("user_id")
                    REFERENCES "users" ("id")
                    ON DELETE CASCADE
            );

            CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash");
            CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);
    }
}
