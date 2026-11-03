import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentsModule1762346400000 implements MigrationInterface {
  name = 'CommentsModule1762346400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE comments
      ADD COLUMN edited_at TIMESTAMP NULL AFTER updated_at,
      ADD COLUMN deleted_at TIMESTAMP NULL AFTER edited_at,
      ADD COLUMN deleted_by BIGINT UNSIGNED NULL AFTER deleted_at,
      ADD KEY idx_comments_visible_page (problem_id, status, deleted_at, created_at),
      ADD KEY idx_comments_deleted_by (deleted_by),
      ADD CONSTRAINT fk_comments_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL`);

    await queryRunner.query(`CREATE TABLE comment_reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      comment_id BIGINT UNSIGNED NOT NULL,
      reporter_id BIGINT UNSIGNED NOT NULL,
      reason ENUM('spam', 'harassment', 'inappropriate', 'misinformation', 'other') NOT NULL,
      details VARCHAR(500) NULL,
      status ENUM('pending', 'reviewed', 'dismissed') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP NULL,
      reviewed_by BIGINT UNSIGNED NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_comment_reports_reporter (comment_id, reporter_id),
      KEY idx_comment_reports_status_created (status, created_at),
      CONSTRAINT fk_comment_reports_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      CONSTRAINT fk_comment_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS comment_reports');
    await queryRunner.query('ALTER TABLE comments DROP FOREIGN KEY fk_comments_deleted_by');
    await queryRunner.query('ALTER TABLE comments DROP INDEX idx_comments_deleted_by');
    await queryRunner.query('ALTER TABLE comments DROP INDEX idx_comments_visible_page');
    await queryRunner.query('ALTER TABLE comments DROP COLUMN deleted_by, DROP COLUMN deleted_at, DROP COLUMN edited_at');
  }
}
