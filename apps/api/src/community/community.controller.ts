import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunityService } from './community.service';

@ApiTags('community')
@Controller({ path: 'community', version: '1' })
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('videos')
  @ApiOperation({ summary: 'Video bài giảng đã xuất bản' })
  videos() {
    return this.community.videos();
  }

  @Get('featured-solutions')
  @ApiOperation({ summary: 'Lời giải nổi bật đã kiểm chứng' })
  featuredSolutions() {
    return this.community.featuredSolutions();
  }

  @Post('newsletter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký nhận bản tin' })
  subscribe(@Body() body: { email?: unknown }) {
    return this.community.subscribe(body?.email);
  }
}
