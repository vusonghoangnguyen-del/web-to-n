import { MigrationInterface, QueryRunner } from 'typeorm';

export class EngagementModule1762519200000 implements MigrationInterface {
  name = 'EngagementModule1762519200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE problem_reactions (
      user_id BIGINT UNSIGNED NOT NULL,
      problem_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, problem_id),
      KEY idx_problem_reactions_problem (problem_id),
      CONSTRAINT fk_problem_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_problem_reactions_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    await queryRunner.query(`CREATE TABLE solution_reactions (
      user_id BIGINT UNSIGNED NOT NULL,
      solution_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, solution_id),
      KEY idx_solution_reactions_solution (solution_id),
      CONSTRAINT fk_solution_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_solution_reactions_solution FOREIGN KEY (solution_id) REFERENCES solutions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    await queryRunner.query(`CREATE TABLE problem_follows (
      user_id BIGINT UNSIGNED NOT NULL,
      problem_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, problem_id),
      KEY idx_problem_follows_problem (problem_id),
      CONSTRAINT fk_problem_follows_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_problem_follows_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS problem_follows');
    await queryRunner.query('DROP TABLE IF EXISTS solution_reactions');
    await queryRunner.query('DROP TABLE IF EXISTS problem_reactions');
  }
}
