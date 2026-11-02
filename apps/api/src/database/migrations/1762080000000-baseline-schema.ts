import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1762080000000 implements MigrationInterface {
  name = 'BaselineSchema1762080000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('reader', 'editor', 'admin') NOT NULL DEFAULT 'reader',
        status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id), UNIQUE KEY uq_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS categories (
        id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(80) NOT NULL,
        slug VARCHAR(80) NOT NULL,
        PRIMARY KEY (id), UNIQUE KEY uq_categories_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS problems (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        author_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        source VARCHAR(500) NULL,
        difficulty ENUM('Dễ', 'Trung bình', 'Khó', 'Thử thách') NOT NULL DEFAULT 'Trung bình',
        status ENUM('draft', 'pending', 'published', 'rejected') NOT NULL DEFAULT 'pending',
        published_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_problems_author (author_id),
        KEY idx_problems_status_created (status, created_at),
        CONSTRAINT fk_problems_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS problem_categories (
        problem_id BIGINT UNSIGNED NOT NULL,
        category_id SMALLINT UNSIGNED NOT NULL,
        PRIMARY KEY (problem_id, category_id),
        KEY idx_problem_categories_category (category_id),
        CONSTRAINT fk_problem_categories_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
        CONSTRAINT fk_problem_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS solutions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        problem_id BIGINT UNSIGNED NOT NULL,
        author_id BIGINT UNSIGNED NOT NULL,
        content TEXT NOT NULL,
        status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_solutions_problem (problem_id), KEY idx_solutions_author (author_id),
        CONSTRAINT fk_solutions_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
        CONSTRAINT fk_solutions_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS bookmarks (
        user_id BIGINT UNSIGNED NOT NULL,
        problem_id BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, problem_id), KEY idx_bookmarks_problem (problem_id),
        CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_bookmarks_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS videos (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        author_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        topic VARCHAR(80) NOT NULL,
        duration VARCHAR(20) NOT NULL,
        url VARCHAR(1000) NOT NULL,
        status ENUM('pending', 'published', 'rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), KEY idx_videos_author (author_id),
        CONSTRAINT fk_videos_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), UNIQUE KEY uq_newsletter_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS comments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        problem_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        parent_id BIGINT UNSIGNED NULL,
        content VARCHAR(2000) NOT NULL,
        status ENUM('visible', 'hidden') NOT NULL DEFAULT 'visible',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_comments_problem_created (problem_id, created_at),
        KEY idx_comments_user (user_id), KEY idx_comments_parent (parent_id),
        CONSTRAINT fk_comments_problem FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
        CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ];

    for (const statement of statements) await queryRunner.query(statement);

    await queryRunner.query(`INSERT INTO categories (name, slug) VALUES
      ('Số học', 'so-hoc'), ('Hình học', 'hinh-hoc'), ('Đại số', 'dai-so'),
      ('Tổ hợp', 'to-hop'), ('Logic', 'logic'), ('Xác suất', 'xac-suat')
      ON DUPLICATE KEY UPDATE name = VALUES(name)`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Baseline migration không thể tự động revert vì có thể xóa dữ liệu legacy.',
    );
  }
}
