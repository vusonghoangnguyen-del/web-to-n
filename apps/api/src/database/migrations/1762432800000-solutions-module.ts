import { MigrationInterface, QueryRunner } from 'typeorm';

export class SolutionsModule1762432800000 implements MigrationInterface {
  name = 'SolutionsModule1762432800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE solutions
      MODIFY status ENUM('pending', 'verified', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
      ADD COLUMN edited_at TIMESTAMP NULL AFTER updated_at,
      ADD COLUMN withdrawn_at TIMESTAMP NULL AFTER edited_at,
      ADD COLUMN reviewed_at TIMESTAMP NULL AFTER withdrawn_at,
      ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER reviewed_at,
      ADD COLUMN review_note VARCHAR(500) NULL AFTER reviewed_by,
      ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER review_note,
      ADD COLUMN featured_at TIMESTAMP NULL AFTER is_featured,
      ADD COLUMN featured_by BIGINT UNSIGNED NULL AFTER featured_at,
      ADD KEY idx_solutions_public (problem_id, status, is_featured, created_at),
      ADD KEY idx_solutions_reviewed_by (reviewed_by),
      ADD KEY idx_solutions_featured_by (featured_by),
      ADD CONSTRAINT fk_solutions_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_solutions_featured_by FOREIGN KEY (featured_by) REFERENCES users(id) ON DELETE SET NULL`);

    await queryRunner.query(`UPDATE solutions
      SET reviewed_at = updated_at
      WHERE status IN ('verified', 'rejected') AND reviewed_at IS NULL`);

    await queryRunner.query(`CREATE TABLE solution_revisions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      solution_id BIGINT UNSIGNED NOT NULL,
      editor_id BIGINT UNSIGNED NOT NULL,
      version INT UNSIGNED NOT NULL,
      content TEXT NOT NULL,
      status ENUM('pending', 'verified', 'rejected', 'withdrawn') NOT NULL,
      change_summary VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_solution_revisions_version (solution_id, version),
      KEY idx_solution_revisions_editor (editor_id),
      CONSTRAINT fk_solution_revisions_solution FOREIGN KEY (solution_id) REFERENCES solutions(id) ON DELETE CASCADE,
      CONSTRAINT fk_solution_revisions_editor FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    await queryRunner.query(`INSERT INTO solution_revisions
      (solution_id, editor_id, version, content, status, change_summary, created_at)
      SELECT id, author_id, 1, content, status, 'Phiên bản được nhập từ dữ liệu hiện có', created_at
        FROM solutions`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS solution_revisions');
    await queryRunner.query("UPDATE solutions SET status = 'rejected' WHERE status = 'withdrawn'");
    await queryRunner.query('ALTER TABLE solutions DROP FOREIGN KEY fk_solutions_featured_by');
    await queryRunner.query('ALTER TABLE solutions DROP FOREIGN KEY fk_solutions_reviewed_by');
    await queryRunner.query('ALTER TABLE solutions DROP INDEX idx_solutions_featured_by');
    await queryRunner.query('ALTER TABLE solutions DROP INDEX idx_solutions_reviewed_by');
    await queryRunner.query('ALTER TABLE solutions DROP INDEX idx_solutions_public');
    await queryRunner.query(`ALTER TABLE solutions
      DROP COLUMN featured_by, DROP COLUMN featured_at, DROP COLUMN is_featured,
      DROP COLUMN review_note, DROP COLUMN reviewed_by, DROP COLUMN reviewed_at,
      DROP COLUMN withdrawn_at, DROP COLUMN edited_at,
      MODIFY status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending'`);
  }
}
