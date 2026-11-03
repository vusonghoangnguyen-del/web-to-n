import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModerationAudit1762605600000 implements MigrationInterface {
  name = 'ModerationAudit1762605600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE comment_reports
      ADD COLUMN resolution_note VARCHAR(500) NULL AFTER reviewed_by,
      ADD KEY idx_comment_reports_reviewed_by (reviewed_by),
      ADD CONSTRAINT fk_comment_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE TABLE audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_id BIGINT UNSIGNED NULL,
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(64) NOT NULL,
      details JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_audit_logs_actor_created (actor_id, created_at),
      KEY idx_audit_logs_target (target_type, target_id),
      CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS audit_logs');
    await queryRunner.query(`ALTER TABLE comment_reports
      DROP FOREIGN KEY fk_comment_reports_reviewer,
      DROP INDEX idx_comment_reports_reviewed_by,
      DROP COLUMN resolution_note`);
  }
}
