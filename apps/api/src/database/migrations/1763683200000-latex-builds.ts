import { MigrationInterface, QueryRunner } from 'typeorm';

export class LatexBuilds1763683200000 implements MigrationInterface {
  name = 'LatexBuilds1763683200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE latex_builds (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      project_id BIGINT UNSIGNED NOT NULL,
      status ENUM('queued','compiling','success','failed','cancelled') NOT NULL DEFAULT 'queued',
      compiler ENUM('pdflatex','xelatex','lualatex') NOT NULL,
      source_snapshot MEDIUMTEXT NOT NULL,
      source_sha256 CHAR(64) NOT NULL,
      pdf_path VARCHAR(255) NULL,
      compile_log MEDIUMTEXT NULL,
      error_message VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      KEY idx_latex_builds_project_created (project_id, created_at),
      CONSTRAINT fk_latex_builds_project FOREIGN KEY (project_id) REFERENCES latex_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE latex_builds');
  }
}
