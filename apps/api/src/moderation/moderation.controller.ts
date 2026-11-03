import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { UserRole } from '../database/entities/user.entity';
import { CommentVisibilityDto, ModerationListDto, ResolveReportDto, ReviewProblemDto } from './moderation.dto';
import { ModerationService } from './moderation.service';

@ApiTags('moderation')
@ApiCookieAuth()
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.Moderator, UserRole.Admin)
@Controller({ path: 'moderation', version: '1' })
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}
  @Get('stats') stats() { return this.moderation.stats(); }
  @Get('problems') problems(@Query() query: ModerationListDto) { return this.moderation.listProblems(query); }
  @Patch('problems/:id') reviewProblem(@Param('id') id: string, @CurrentUser() user: PublicUser, @Body() dto: ReviewProblemDto) { return this.moderation.reviewProblem(id, user, dto); }
  @Get('comments') comments(@Query() query: ModerationListDto) { return this.moderation.listComments(query); }
  @Patch('comments/:id/visibility') visibility(@Param('id') id: string, @CurrentUser() user: PublicUser, @Body() dto: CommentVisibilityDto) { return this.moderation.setCommentVisibility(id, user, dto); }
  @Get('reports') reports(@Query() query: ModerationListDto) { return this.moderation.listReports(query); }
  @Patch('reports/:id') resolveReport(@Param('id') id: string, @CurrentUser() user: PublicUser, @Body() dto: ResolveReportDto) { return this.moderation.resolveReport(id, user, dto); }
  @Get('audit-logs') auditLogs(@Query() query: ModerationListDto) { return this.moderation.listAuditLogs(query); }
}
