import { Controller, Delete, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { EngagementService } from './engagement.service';

@ApiTags('engagement')
@Controller({ path: '', version: '1' })
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get('bookmarks')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  bookmarks(@CurrentUser() user: PublicUser) {
    return this.engagement.listBookmarks(user);
  }

  @Put('bookmarks/:problemId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  bookmark(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setBookmark(problemId, user, true);
  }

  @Delete('bookmarks/:problemId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  unbookmark(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setBookmark(problemId, user, false);
  }

  @Get('follows')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  follows(@CurrentUser() user: PublicUser) {
    return this.engagement.listFollows(user);
  }

  @Get('notifications')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  notifications(@CurrentUser() user: PublicUser) {
    return this.engagement.listNotifications(user);
  }

  @Patch('notifications/read')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  readNotifications(@CurrentUser() user: PublicUser) {
    return this.engagement.readNotifications(user);
  }

  @Put('follows/problems/:problemId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  follow(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setFollow(problemId, user, true);
  }

  @Delete('follows/problems/:problemId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  unfollow(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setFollow(problemId, user, false);
  }

  @Get('problems/:problemId/engagement')
  summary(@Param('problemId') problemId: string) {
    return this.engagement.summary(problemId);
  }

  @Get('problems/:problemId/engagement/mine')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  mine(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.mine(problemId, user);
  }

  @Put('problems/:problemId/reaction')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  likeProblem(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setProblemReaction(problemId, user, true);
  }

  @Delete('problems/:problemId/reaction')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  unlikeProblem(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setProblemReaction(problemId, user, false);
  }

  @Put('solutions/:solutionId/reaction')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  likeSolution(@Param('solutionId') solutionId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setSolutionReaction(solutionId, user, true);
  }

  @Delete('solutions/:solutionId/reaction')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  unlikeSolution(@Param('solutionId') solutionId: string, @CurrentUser() user: PublicUser) {
    return this.engagement.setSolutionReaction(solutionId, user, false);
  }
}
