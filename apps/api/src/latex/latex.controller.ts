import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountRateLimit, AccountThrottleGuard } from '../auth/guards/account-throttle.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { PublicUser } from '../auth/auth.types';
import { CreateLatexProjectDto } from './dto/create-latex-project.dto';
import { CreateLatexFileDto } from './dto/create-latex-file.dto';
import { UpdateLatexFileDto } from './dto/update-latex-file.dto';
import { UpdateLatexProjectDto } from './dto/update-latex-project.dto';
import { LatexService } from './latex.service';
import { LatexBuildService } from './latex-build.service';

@ApiTags('latex')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller({ path: 'latex/projects', version: '1' })
export class LatexController {
  constructor(private readonly latex: LatexService, private readonly builds: LatexBuildService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách dự án LaTeX của tài khoản' })
  list(@CurrentUser() user: PublicUser) {
    return this.latex.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo dự án với main.tex' })
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateLatexProjectDto) {
    return this.latex.create(user.id, dto);
  }

  @Post('import-zip')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Nhập dự án LaTeX từ ZIP' })
  importZip(@CurrentUser() user: PublicUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Hãy chọn tệp ZIP.');
    return this.latex.importZip(user.id, file.originalname, file.buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Đọc dự án và mã nguồn main.tex' })
  detail(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.latex.detail(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa tên hoặc compiler của dự án' })
  update(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body() dto: UpdateLatexProjectDto) {
    return this.latex.update(user.id, id, dto);
  }

  @Put(':id/files/:fileId')
  @ApiOperation({ summary: 'Lưu main.tex' })
  saveFile(@CurrentUser() user: PublicUser, @Param('id') id: string, @Param('fileId') fileId: string, @Body() dto: UpdateLatexFileDto) {
    return this.latex.saveFile(user.id, id, fileId, dto);
  }

  @Post(':id/files')
  @ApiOperation({ summary: 'Thêm tệp LaTeX dạng văn bản' })
  createFile(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body() dto: CreateLatexFileDto) {
    return this.latex.createFile(user.id, id, dto);
  }

  @Post(':id/files/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Tải ảnh hoặc tệp hỗ trợ vào dự án' })
  uploadFile(@CurrentUser() user: PublicUser, @Param('id') id: string, @Body('path') filePath: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Hãy chọn tệp cần tải lên.');
    return this.latex.uploadFile(user.id, id, filePath || file.originalname, file.buffer);
  }

  @Get(':id/files/:fileId/raw')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Tải tệp của dự án' })
  rawFile(@CurrentUser() user: PublicUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.latex.rawFile(user.id, id, fileId);
  }

  @Delete(':id/files/:fileId')
  @ApiOperation({ summary: 'Xóa tệp phụ trong dự án' })
  deleteFile(@CurrentUser() user: PublicUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.latex.deleteFile(user.id, id, fileId);
  }

  @Get(':id/export')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Xuất toàn bộ dự án thành ZIP' })
  exportZip(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.latex.exportZip(user.id, id);
  }

  @Post(':id/compile')
  @UseGuards(AccountThrottleGuard)
  @AccountRateLimit(10, 60 * 60_000)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Đưa tài liệu LaTeX vào hàng đợi biên dịch PDF' })
  compile(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.builds.compile(user.id, id);
  }

  @Get(':id/builds')
  @ApiOperation({ summary: 'Danh sách bản biên dịch gần đây' })
  listBuilds(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.builds.list(user.id, id);
  }

  @Get(':id/builds/:buildId')
  @ApiOperation({ summary: 'Trạng thái và log bản biên dịch' })
  buildDetail(@CurrentUser() user: PublicUser, @Param('id') id: string, @Param('buildId') buildId: string) {
    return this.builds.detail(user.id, id, buildId);
  }

  @Get(':id/builds/:buildId/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Xem PDF đã biên dịch' })
  pdf(@CurrentUser() user: PublicUser, @Param('id') id: string, @Param('buildId') buildId: string) {
    return this.builds.pdf(user.id, id, buildId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa dự án LaTeX của tài khoản' })
  remove(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.latex.remove(user.id, id);
  }
}
