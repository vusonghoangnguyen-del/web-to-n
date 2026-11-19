import { MigrationInterface, QueryRunner } from 'typeorm';

export class LatexMultipleFiles1763769600000 implements MigrationInterface {
  name = 'LatexMultipleFiles1763769600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE latex_files ADD binary_content MEDIUMBLOB NULL, ADD mime_type VARCHAR(80) NOT NULL DEFAULT 'text/x-tex', ADD size_bytes INT UNSIGNED NOT NULL DEFAULT 0");
    await queryRunner.query('UPDATE latex_files SET size_bytes = OCTET_LENGTH(content)');
    await queryRunner.query('ALTER TABLE latex_builds ADD source_archive LONGBLOB NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE latex_builds DROP COLUMN source_archive');
    await queryRunner.query('ALTER TABLE latex_files DROP COLUMN size_bytes, DROP COLUMN mime_type, DROP COLUMN binary_content');
  }
}
