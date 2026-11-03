import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProblemsModule1762260000000 implements MigrationInterface {
  name = 'ProblemsModule1762260000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE problems
      ADD COLUMN slug VARCHAR(280) NULL AFTER title,
      ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`);
    await queryRunner.query("UPDATE problems SET slug = CONCAT('bai-toan-', id) WHERE slug IS NULL");
    await queryRunner.query(`ALTER TABLE problems
      MODIFY slug VARCHAR(280) NOT NULL,
      ADD UNIQUE KEY uq_problems_slug (slug),
      ADD KEY idx_problems_public_list (status, deleted_at, published_at)`);

    await queryRunner.query(`CREATE TABLE problem_revisions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      problem_id BIGINT UNSIGNED NOT NULL,
      editor_id BIGINT UNSIGNED NOT NULL,
      version INT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      source VARCHAR(500) NULL,
      difficulty ENUM('Dễ', 'Trung bình', 'Khó', 'Thử thách') NOT NULL,
      status ENUM('draft', 'pending', 'published', 'rejected') NOT NULL,
      category_slugs JSON NOT NULL,
      change_summary VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_problem_revisions_version (problem_id, version),
      KEY idx_problem_revisions_editor (editor_id),
      CONSTRAINT fk_problem_revisions_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
      CONSTRAINT fk_problem_revisions_editor FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    await queryRunner.query(`INSERT INTO problem_revisions
      (problem_id, editor_id, version, title, content, source, difficulty, status, category_slugs, change_summary, created_at)
      SELECT p.id, p.author_id, 1, p.title, p.content, p.source, p.difficulty, p.status,
             COALESCE((SELECT JSON_ARRAYAGG(c.slug)
                         FROM problem_categories pc
                         JOIN categories c ON c.id = pc.category_id
                        WHERE pc.problem_id = p.id), JSON_ARRAY()),
             'Phiên bản được nhập từ dữ liệu hiện có', p.created_at
        FROM problems p`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS problem_revisions');
    await queryRunner.query('ALTER TABLE problems DROP INDEX idx_problems_public_list');
    await queryRunner.query('ALTER TABLE problems DROP INDEX uq_problems_slug');
    await queryRunner.query('ALTER TABLE problems DROP COLUMN deleted_at, DROP COLUMN slug');
  }
}
