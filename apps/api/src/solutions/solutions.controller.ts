import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountRateLimit, AccountThrottleGuard } from '../auth/guards/account-throttle.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { UserRole } from '../database/entities/user.entity';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { FeatureSolutionDto } from './dto/feature-solution.dto';
import { ListSolutionsDto } from './dto/list-solutions.dto';
import { ModerationSolutionsDto } from './dto/moderation-solutions.dto';
import { ReviewSolutionDto } from './dto/review-solution.dto';
import { UpdateSolutionDto } from './dto/update-solution.dto';
import { SolutionsService } from './solutions.service';

@ApiTags('solutions')
@Controller({ path: '', version: '1' })
export class SolutionsController {
  constructor(private readonly solutions: SolutionsService) {}

  @Get('problems/:problemId/solutions')
  @ApiOperation({ summary: 'Danh sách lời giải đã kiểm chứng' })
  publicForProblem(@Param('problemId') problemId: string, @Query() query: ListSolutionsDto) {
    return this.solutions.publicForProblem(problemId, query);
  }

  @Get('problems/:problemId/solutions/mine')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  mineForProblem(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser) {
    return this.solutions.mineForProblem(problemId, user);
  }

  @Post('problems/:problemId/solutions')
  @UseGuards(SessionGuard, AccountThrottleGuard)
  @AccountRateLimit(10, 60 * 60_000)
  @ApiCookieAuth()
  create(@Param('problemId') problemId: string, @CurrentUser() user: PublicUser, @Body() dto: CreateSolutionDto) {
    return this.solutions.create(problemId, user, dto);
  }

  @Get('solutions/mine')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  mine(@CurrentUser() user: PublicUser, @Query() query: ListSolutionsDto) {
    return this.solutions.mine(user, query);
  }

  @Get('solutions/moderation')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.Moderator, UserRole.Admin)
  @ApiCookieAuth()
  moderation(@Query() query: ModerationSolutionsDto) {
    return this.solutions.moderation(query);
  }

  @Get('solutions/:solutionId/history')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  history(@Param('solutionId') solutionId: string, @CurrentUser() user: PublicUser) {
    return this.solutions.history(solutionId, user);
  }

  @Patch('solutions/:solutionId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  update(@Param('solutionId') solutionId: string, @CurrentUser() user: PublicUser, @Body() dto: UpdateSolutionDto) {
    return this.solutions.update(solutionId, user, dto);
  }

  @Delete('solutions/:solutionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  withdraw(@Param('solutionId') solutionId: string, @CurrentUser() user: PublicUser) {
    return this.solutions.withdraw(solutionId, user);
  }

  @Patch('solutions/:solutionId/review')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.Moderator, UserRole.Admin)
  @ApiCookieAuth()
  review(@Param('solutionId') solutionId: string, @CurrentUser() user: PublicUser, @Body() dto: ReviewSolutionDto) {
    return this.solutions.review(solutionId, user, dto);
  }

  @Patch('solutions/:solutionId/featured')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles(UserRole.Moderator, UserRole.Admin)
  @ApiCookieAuth()
  feature(@Param('solutionId') solutionId: string, @CurrentUser() user: PublicUser, @Body() dto: FeatureSolutionDto) {
    return this.solutions.feature(solutionId, user, dto.featured);
  }
}
