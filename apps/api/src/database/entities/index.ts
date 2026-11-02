import { BookmarkEntity } from './bookmark.entity';
import { CategoryEntity } from './category.entity';
import { CommentEntity } from './comment.entity';
import { NewsletterSubscriptionEntity } from './newsletter-subscription.entity';
import { ProblemCategoryEntity } from './problem-category.entity';
import { ProblemEntity } from './problem.entity';
import { SolutionEntity } from './solution.entity';
import { UserEntity } from './user.entity';
import { VideoEntity } from './video.entity';

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
};
