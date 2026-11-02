import path from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/env.validation';
import { databaseEntities } from './entities';
import { BaselineSchema1762080000000 } from './migrations/1762080000000-baseline-schema';
import { AuthSessionsEmailVerification1762087200000 } from './migrations/1762087200000-auth-sessions-email-verification';

loadEnvironment({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
const environment = validateEnvironment(process.env);

export default new DataSource({
  type: 'mysql',
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  database: environment.DB_NAME,
  username: environment.DB_USER,
  password: environment.DB_PASSWORD,
  charset: 'utf8mb4',
  entities: databaseEntities,
  migrations: [BaselineSchema1762080000000, AuthSessionsEmailVerification1762087200000],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  migrationsRun: false,
  logging: ['error', 'warn'],
});
