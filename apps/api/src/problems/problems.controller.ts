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
import { AccountRateLimit, AccountThrottleGuard } from '../auth/guards/account-throttle.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { CreateProblemDto } from './dto/create-problem.dto';
import { ListProblemsDto } from './dto/list-problems.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ProblemsService } from './problems.service';

@ApiTags('problems')
@Controller({ path: 'problems', version: '1' })
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bài toán đã xuất bản' })
  list(@Query() query: ListProblemsDto) {
    return this.problems.list(query);
  }

  @Get('mine')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Danh sách bài toán của tài khoản hiện tại' })
  mine(@CurrentUser() user: PublicUser, @Query() query: ListProblemsDto) {
    return this.problems.mine(user, query);
  }

  @Get(':identifier/history')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Lịch sử phiên bản của bài toán' })
  history(@Param('identifier') identifier: string, @CurrentUser() user: PublicUser) {
    return this.problems.history(identifier, user);
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Chi tiết bài toán theo ID hoặc slug' })
  detail(@Param('identifier') identifier: string) {
    return this.problems.detail(identifier);
  }

  @Post()
  @UseGuards(SessionGuard, AccountThrottleGuard)
  @AccountRateLimit(10, 60 * 60_000)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Tạo bản nháp hoặc gửi bài toán để duyệt' })
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateProblemDto) {
    return this.problems.create(user, dto);
  }

  @Patch(':identifier')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Sửa bài toán và tạo phiên bản lịch sử' })
  update(
    @Param('identifier') identifier: string,
    @CurrentUser() user: PublicUser,
    @Body() dto: UpdateProblemDto,
  ) {
    return this.problems.update(identifier, user, dto);
  }

  @Delete(':identifier')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Xóa mềm bài toán' })
  remove(@Param('identifier') identifier: string, @CurrentUser() user: PublicUser) {
    return this.problems.softDelete(identifier, user);
  }
}
