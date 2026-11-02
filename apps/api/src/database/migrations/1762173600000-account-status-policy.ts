import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountStatusPolicy1762173600000 implements MigrationInterface {
  name = 'AccountStatusPolicy1762173600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN username VARCHAR(30) NULL AFTER id');
    await queryRunner.query("UPDATE users SET username = CONCAT('user_', id) WHERE username IS NULL");
    await queryRunner.query(`ALTER TABLE users
      MODIFY username VARCHAR(30) NOT NULL,
      ADD UNIQUE KEY uq_users_username (username)`);
    await queryRunner.query(`ALTER TABLE users
      MODIFY status ENUM('pending_verification', 'active', 'suspended', 'disabled', 'banned') NOT NULL DEFAULT 'active'`);
    await queryRunner.query(`UPDATE users SET status = 'active' WHERE status = 'pending_verification'`);
    await queryRunner.query(`UPDATE users SET status = 'banned' WHERE status = 'disabled'`);
    await queryRunner.query(`ALTER TABLE users
      MODIFY status ENUM('active', 'suspended', 'banned') NOT NULL DEFAULT 'active',
      ADD COLUMN banned_at TIMESTAMP NULL AFTER email_verified_at,
      ADD COLUMN banned_by BIGINT UNSIGNED NULL AFTER banned_at,
      ADD COLUMN ban_reason VARCHAR(500) NULL AFTER banned_by,
      ADD KEY idx_users_banned_by (banned_by),
      ADD CONSTRAINT fk_users_banned_by FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP FOREIGN KEY fk_users_banned_by');
    await queryRunner.query('ALTER TABLE users DROP INDEX idx_users_banned_by');
    await queryRunner.query(`ALTER TABLE users
      MODIFY status ENUM('pending_verification', 'active', 'suspended', 'disabled', 'banned') NOT NULL DEFAULT 'active'`);
    await queryRunner.query(`UPDATE users SET status = 'disabled' WHERE status = 'banned'`);
    await queryRunner.query(`ALTER TABLE users
      DROP COLUMN ban_reason,
      DROP COLUMN banned_by,
      DROP COLUMN banned_at,
      MODIFY status ENUM('pending_verification', 'active', 'suspended', 'disabled') NOT NULL DEFAULT 'active'`);
    await queryRunner.query('ALTER TABLE users DROP INDEX uq_users_username, DROP COLUMN username');
  }
}
