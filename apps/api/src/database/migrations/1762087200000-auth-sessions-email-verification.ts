import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSessionsEmailVerification1762087200000 implements MigrationInterface {
  name = 'AuthSessionsEmailVerification1762087200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // db:setup from the legacy app already creates these objects. Treat that
    // schema as applied so a fresh Windows installation can continue forward.
    if (await queryRunner.hasColumn('users', 'email_verified_at')
      && await queryRunner.hasTable('sessions')
      && await queryRunner.hasTable('email_verification_tokens')) return;
    await queryRunner.query(`ALTER TABLE users
      MODIFY role ENUM('reader', 'editor', 'moderator', 'admin') NOT NULL DEFAULT 'reader',
      MODIFY status ENUM('pending_verification', 'active', 'suspended', 'disabled') NOT NULL DEFAULT 'active',
      ADD COLUMN email_verified_at TIMESTAMP NULL AFTER status`);

    await queryRunner.query(`UPDATE users
      SET email_verified_at = created_at
      WHERE status = 'active' AND email_verified_at IS NULL`);

    await queryRunner.query(`CREATE TABLE sessions (
      id CHAR(36) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(500) NULL,
      revoked_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sessions_token_hash (token_hash),
      KEY idx_sessions_user_expires (user_id, expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    await queryRunner.query(`CREATE TABLE email_verification_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      consumed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_email_verification_token_hash (token_hash),
      KEY idx_email_verification_user_expires (user_id, expires_at),
      CONSTRAINT fk_email_verification_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS email_verification_tokens');
    await queryRunner.query('DROP TABLE IF EXISTS sessions');
    await queryRunner.query(`UPDATE users SET status = 'disabled'
      WHERE status IN ('pending_verification', 'suspended')`);
    await queryRunner.query('ALTER TABLE users DROP COLUMN email_verified_at');
    await queryRunner.query(`ALTER TABLE users
      MODIFY role ENUM('reader', 'editor', 'admin') NOT NULL DEFAULT 'reader',
      MODIFY status ENUM('active', 'disabled') NOT NULL DEFAULT 'active'`);
  }
}
