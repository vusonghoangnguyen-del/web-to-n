import { AuditLogEntity } from './audit-log.entity';
import { BookmarkEntity } from './bookmark.entity';
import { CategoryEntity } from './category.entity';
import { CommentEntity } from './comment.entity';
import { CommentReportEntity } from './comment-report.entity';
import { NewsletterSubscriptionEntity } from './newsletter-subscription.entity';
import { NotificationEntity } from './notification.entity';
import { ProblemCategoryEntity } from './problem-category.entity';
import { ProblemEntity } from './problem.entity';
import { ProblemFollowEntity } from './problem-follow.entity';
import { ProblemReactionEntity } from './problem-reaction.entity';
import { ProblemRevisionEntity } from './problem-revision.entity';
import { SolutionEntity } from './solution.entity';
import { SolutionReactionEntity } from './solution-reaction.entity';
import { SolutionRevisionEntity } from './solution-revision.entity';
import { UserEntity } from './user.entity';
import { VideoEntity } from './video.entity';
import { SessionEntity } from './session.entity';
import { EmailVerificationTokenEntity } from './email-verification-token.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { LatexProjectEntity } from './latex-project.entity';
import { LatexFileEntity } from './latex-file.entity';
import { LatexBuildEntity } from './latex-build.entity';

export const databaseEntities = [
  AuditLogEntity,
  UserEntity,
  CategoryEntity,
  ProblemEntity,
  ProblemFollowEntity,
  ProblemReactionEntity,
  ProblemRevisionEntity,
  ProblemCategoryEntity,
  SolutionEntity,
  SolutionReactionEntity,
  SolutionRevisionEntity,
  CommentEntity,
  CommentReportEntity,
  BookmarkEntity,
  VideoEntity,
  NewsletterSubscriptionEntity,
  NotificationEntity,
  SessionEntity,
  EmailVerificationTokenEntity,
  PasswordResetTokenEntity,
  LatexProjectEntity,
  LatexFileEntity,
  LatexBuildEntity,
];

export {
  AuditLogEntity,
  BookmarkEntity,
  CategoryEntity,
  CommentEntity,
  CommentReportEntity,
  NewsletterSubscriptionEntity,
  NotificationEntity,
  ProblemCategoryEntity,
  ProblemEntity,
  ProblemFollowEntity,
  ProblemReactionEntity,
  ProblemRevisionEntity,
  SolutionEntity,
  SolutionReactionEntity,
  SolutionRevisionEntity,
  UserEntity,
  VideoEntity,
  SessionEntity,
  EmailVerificationTokenEntity,
  PasswordResetTokenEntity,
  LatexProjectEntity,
  LatexFileEntity,
  LatexBuildEntity,
};
