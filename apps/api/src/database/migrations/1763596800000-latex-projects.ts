import { MigrationInterface, QueryRunner } from 'typeorm';

export class LatexProjects1763596800000 implements MigrationInterface {
  name = 'LatexProjects1763596800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE latex_projects (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      owner_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(120) NOT NULL,
      compiler ENUM('pdflatex','xelatex','lualatex') NOT NULL DEFAULT 'pdflatex',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_latex_projects_owner_updated (owner_id, updated_at),
      CONSTRAINT fk_latex_projects_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    await queryRunner.query(`CREATE TABLE latex_files (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      project_id BIGINT UNSIGNED NOT NULL,
      relative_path VARCHAR(255) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_latex_files_project_path (project_id, relative_path),
      CONSTRAINT fk_latex_files_project FOREIGN KEY (project_id) REFERENCES latex_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE latex_files');
    await queryRunner.query('DROP TABLE latex_projects');
  }
}
