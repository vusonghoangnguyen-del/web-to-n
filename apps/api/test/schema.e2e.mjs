import assert from 'node:assert/strict';

const dataSourceModule = await import('../dist/database/data-source.js');
const dataSource = dataSourceModule.default?.default ?? dataSourceModule.default;

try {
  await dataSource.initialize();

  const expectedTables = [
    'bookmarks',
    'categories',
    'comments',
    'newsletter_subscriptions',
    'problem_categories',
    'problems',
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

  process.stdout.write(
    `Schema E2E thành công: ${mappedTables.length} Entity; dữ liệu ${JSON.stringify(counts)}.\n`,
  );
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
