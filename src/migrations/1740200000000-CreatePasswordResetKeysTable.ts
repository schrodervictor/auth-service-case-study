import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetKeysTable1740200000000 implements MigrationInterface {
    name = 'CreatePasswordResetKeysTable1740200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "password_reset_keys" (
                "id"         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                "user_id"    UUID NOT NULL,
                "key_hash"   VARCHAR NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "fk_password_reset_keys_user"
                    FOREIGN KEY ("user_id")
                    REFERENCES "users" ("id")
                    ON DELETE CASCADE
            );

            CREATE INDEX "idx_password_reset_keys_key_hash" ON "password_reset_keys" ("key_hash");
            CREATE INDEX "idx_password_reset_keys_user_id" ON "password_reset_keys" ("user_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_keys";`);
    }
}
