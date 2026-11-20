import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { databaseEntities } from './entities';
import { BaselineSchema1762080000000 } from './migrations/1762080000000-baseline-schema';
import { AuthSessionsEmailVerification1762087200000 } from './migrations/1762087200000-auth-sessions-email-verification';
import { AccountStatusPolicy1762173600000 } from './migrations/1762173600000-account-status-policy';
import { ProblemsModule1762260000000 } from './migrations/1762260000000-problems-module';
import { CommentsModule1762346400000 } from './migrations/1762346400000-comments-module';
import { SolutionsModule1762432800000 } from './migrations/1762432800000-solutions-module';
import { EngagementModule1762519200000 } from './migrations/1762519200000-engagement-module';
import { FollowNotifications1762522800000 } from './migrations/1762522800000-follow-notifications';
import { ModerationAudit1762605600000 } from './migrations/1762605600000-moderation-audit';
import { LatexProjects1763596800000 } from './migrations/1763596800000-latex-projects';
import { LatexBuilds1763683200000 } from './migrations/1763683200000-latex-builds';
import { LatexMultipleFiles1763769600000 } from './migrations/1763769600000-latex-multiple-files';
import { PasswordReset1763856000000 } from './migrations/1763856000000-password-reset';

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
    migrations: [
      BaselineSchema1762080000000,
      AuthSessionsEmailVerification1762087200000,
      AccountStatusPolicy1762173600000,
      ProblemsModule1762260000000,
      CommentsModule1762346400000,
      SolutionsModule1762432800000,
      EngagementModule1762519200000,
      FollowNotifications1762522800000,
      ModerationAudit1762605600000,
      LatexProjects1763596800000,
      LatexBuilds1763683200000,
      LatexMultipleFiles1763769600000,
      PasswordReset1763856000000,
    ],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
  };
}
