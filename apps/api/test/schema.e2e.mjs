import assert from 'node:assert/strict';

const dataSourceModule = await import('../dist/database/data-source.js');
const dataSource = dataSourceModule.default?.default ?? dataSourceModule.default;

try {
  await dataSource.initialize();

  const expectedTables = [
    'audit_logs',
    'bookmarks',
    'categories',
    'comment_reports',
    'comments',
    'email_verification_tokens',
    'latex_builds',
    'latex_files',
    'latex_projects',
    'newsletter_subscriptions',
    'notifications',
    'problem_categories',
    'problem_follows',
    'problem_reactions',
    'problem_revisions',
    'problems',
    'sessions',
    'solution_reactions',
    'solution_revisions',
    'solutions',
    'users',
    'videos',
  ];
  const mappedTables = dataSource.entityMetadatas
    .map((metadata) => metadata.tableName)
    .sort();
  assert.deepEqual(mappedTables, expectedTables);

  const counts = {};
  for (const metadata of dataSource.entityMetadatas) {
    counts[metadata.tableName] = await dataSource.getRepository(metadata.target).count();
  }

  const migrations = await dataSource.query(
    'SELECT timestamp, name FROM typeorm_migrations ORDER BY id',
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762080000000' &&
        migration.name === 'BaselineSchema1762080000000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762173600000' &&
        migration.name === 'AccountStatusPolicy1762173600000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762087200000' &&
        migration.name === 'AuthSessionsEmailVerification1762087200000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762260000000' &&
        migration.name === 'ProblemsModule1762260000000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762346400000' &&
        migration.name === 'CommentsModule1762346400000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762432800000' &&
        migration.name === 'SolutionsModule1762432800000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762519200000' &&
        migration.name === 'EngagementModule1762519200000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762522800000' &&
        migration.name === 'FollowNotifications1762522800000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1762605600000' &&
        migration.name === 'ModerationAudit1762605600000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1763596800000' &&
        migration.name === 'LatexProjects1763596800000',
    ),
  );
  assert.ok(
    migrations.some(
      (migration) =>
        String(migration.timestamp) === '1763683200000' &&
        migration.name === 'LatexBuilds1763683200000',
    ),
  );

  process.stdout.write(
    `Schema E2E thành công: ${mappedTables.length} Entity; dữ liệu ${JSON.stringify(counts)}.\n`,
  );
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
