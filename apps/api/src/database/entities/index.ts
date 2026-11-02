import { BookmarkEntity } from './bookmark.entity';
import { CategoryEntity } from './category.entity';
import { CommentEntity } from './comment.entity';
import { NewsletterSubscriptionEntity } from './newsletter-subscription.entity';
import { ProblemCategoryEntity } from './problem-category.entity';
import { ProblemEntity } from './problem.entity';
import { SolutionEntity } from './solution.entity';
import { UserEntity } from './user.entity';
import { VideoEntity } from './video.entity';
import { SessionEntity } from './session.entity';
import { EmailVerificationTokenEntity } from './email-verification-token.entity';

export const databaseEntities = [
  UserEntity,
  CategoryEntity,
  ProblemEntity,
  ProblemCategoryEntity,
  SolutionEntity,
  CommentEntity,
  BookmarkEntity,
  VideoEntity,
  NewsletterSubscriptionEntity,
  SessionEntity,
  EmailVerificationTokenEntity,
];

export {
  BookmarkEntity,
  CategoryEntity,
  CommentEntity,
  NewsletterSubscriptionEntity,
  ProblemCategoryEntity,
  ProblemEntity,
  SolutionEntity,
  UserEntity,
  VideoEntity,
  SessionEntity,
  EmailVerificationTokenEntity,
};
