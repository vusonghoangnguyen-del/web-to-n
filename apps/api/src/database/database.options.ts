import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { databaseEntities } from './entities';
import { BaselineSchema1762080000000 } from './migrations/1762080000000-baseline-schema';
import { AuthSessionsEmailVerification1762087200000 } from './migrations/1762087200000-auth-sessions-email-verification';
import { AccountStatusPolicy1762173600000 } from './migrations/1762173600000-account-status-policy';

export function createDatabaseOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    database: config.getOrThrow<string>('DB_NAME'),
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    charset: 'utf8mb4',
    entities: databaseEntities,
    migrations: [BaselineSchema1762080000000, AuthSessionsEmailVerification1762087200000, AccountStatusPolicy1762173600000],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
  };
}
