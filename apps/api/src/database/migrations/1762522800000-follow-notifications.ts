import { MigrationInterface, QueryRunner } from 'typeorm';

export class FollowNotifications1762522800000 implements MigrationInterface {
  name = 'FollowNotifications1762522800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      actor_id BIGINT UNSIGNED NULL,
      problem_id BIGINT UNSIGNED NOT NULL,
      type ENUM('new_comment', 'verified_solution') NOT NULL,
      message VARCHAR(300) NOT NULL,
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notifications_user_unread (user_id, read_at, created_at),
      KEY idx_notifications_problem (problem_id),
      KEY idx_notifications_actor (actor_id),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_notifications_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS notifications');
  }
}
