import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsDto } from './dto/list-comments.dto';
import { ReportCommentDto } from './dto/report-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@Controller({ path: '', version: '1' })
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('problems/:problemId/comments')
  @ApiOperation({ summary: 'Danh sách bình luận có phân trang' })
  list(@Param('problemId') problemId: string, @Query() query: ListCommentsDto) {
    return this.comments.list(problemId, query);
  }

  @Post('problems/:problemId/comments')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Bình luận hoặc trả lời bài toán' })
  create(
    @Param('problemId') problemId: string,
    @CurrentUser() user: PublicUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(problemId, user, dto);
  }

  @Patch('comments/:commentId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Sửa bình luận của chính mình' })
  update(
    @Param('commentId') commentId: string,
    @CurrentUser() user: PublicUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(commentId, user, dto);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Xóa mềm bình luận' })
  remove(@Param('commentId') commentId: string, @CurrentUser() user: PublicUser) {
    return this.comments.softDelete(commentId, user);
  }

  @Post('comments/:commentId/reports')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Báo cáo bình luận' })
  report(
    @Param('commentId') commentId: string,
    @CurrentUser() user: PublicUser,
    @Body() dto: ReportCommentDto,
  ) {
    return this.comments.report(commentId, user, dto);
  }
}
