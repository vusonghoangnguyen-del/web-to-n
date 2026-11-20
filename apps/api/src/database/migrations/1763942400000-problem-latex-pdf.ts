import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProblemLatexPdf1763942400000 implements MigrationInterface {
  name = 'ProblemLatexPdf1763942400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE problems
      ADD COLUMN latex_build_id BIGINT UNSIGNED NULL,
      ADD KEY idx_problems_latex_build (latex_build_id),
      ADD CONSTRAINT fk_problems_latex_build FOREIGN KEY (latex_build_id) REFERENCES latex_builds(id) ON DELETE RESTRICT`);
    await queryRunner.query('ALTER TABLE problem_revisions ADD COLUMN latex_build_id BIGINT UNSIGNED NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE problem_revisions DROP COLUMN latex_build_id');
    await queryRunner.query('ALTER TABLE problems DROP FOREIGN KEY fk_problems_latex_build');
    await queryRunner.query('ALTER TABLE problems DROP INDEX idx_problems_latex_build');
    await queryRunner.query('ALTER TABLE problems DROP COLUMN latex_build_id');
  }
}
