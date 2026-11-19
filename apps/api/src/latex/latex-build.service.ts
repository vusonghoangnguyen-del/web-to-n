import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LatexBuildEntity, LatexBuildStatus } from '../database/entities/latex-build.entity';
import { LatexFileEntity } from '../database/entities/latex-file.entity';
import { LatexProjectEntity } from '../database/entities/latex-project.entity';
import { latexStorageRoot } from './build-config';
import { LatexQueueService } from './latex-queue.service';
import { checkProjectFiles, ProjectFile } from './latex-files';
import { writeProjectZip } from './latex-zip';

@Injectable()
export class LatexBuildService {
  constructor(
    @InjectRepository(LatexProjectEntity) private readonly projects: Repository<LatexProjectEntity>,
    @InjectRepository(LatexFileEntity) private readonly files: Repository<LatexFileEntity>,
    @InjectRepository(LatexBuildEntity) private readonly builds: Repository<LatexBuildEntity>,
    private readonly queue: LatexQueueService,
  ) {}

  async compile(ownerId: string, projectId: string) {
    const project = await this.ownedProject(ownerId, projectId);
    const existing = await this.builds.findOne({
      where: { projectId, status: In([LatexBuildStatus.Queued, LatexBuildStatus.Compiling]) },
      order: { id: 'DESC' },
    });
    if (existing) throw new ConflictException('Dự án đang có bản biên dịch chưa xong.');
    const projectFiles = await this.files.createQueryBuilder('file').addSelect('file.binaryContent')
      .where('file.projectId = :projectId', { projectId }).orderBy('file.relativePath', 'ASC').getMany();
    const file = projectFiles.find((item) => item.relativePath === 'main.tex');
    if (!file) throw new NotFoundException('Không tìm thấy main.tex.');
    const snapshot: ProjectFile[] = projectFiles.map((item) => ({
      path: item.relativePath, content: item.content, binary: item.binaryContent,
      mimeType: item.mimeType, sizeBytes: item.sizeBytes,
    }));
    checkProjectFiles(snapshot);
    const archive = await writeProjectZip(snapshot);
    const build = await this.builds.save(this.builds.create({
      projectId,
      status: LatexBuildStatus.Queued,
      compiler: project.compiler,
      sourceSnapshot: file.content,
      sourceArchive: archive,
      sourceSha256: createHash('sha256').update(archive).digest('hex'),
    }));
    try {
      await this.queue.enqueue(build.id);
    } catch {
      await this.builds.update(build.id, {
        status: LatexBuildStatus.Failed,
        errorMessage: 'Không kết nối được Redis. Hãy khởi động hàng đợi LaTeX rồi thử lại.',
        completedAt: new Date(),
      });
      throw new ServiceUnavailableException('Không kết nối được Redis. Hãy khởi động hàng đợi LaTeX rồi thử lại.');
    }
    return { build: this.summary(build) };
  }

  async list(ownerId: string, projectId: string) {
    await this.ownedProject(ownerId, projectId);
    const builds = await this.builds.find({ where: { projectId }, order: { id: 'DESC' }, take: 20 });
    return { builds: builds.map((build) => this.summary(build)) };
  }

  async detail(ownerId: string, projectId: string, buildId: string) {
    const build = await this.ownedBuild(ownerId, projectId, buildId, true);
    return { build: { ...this.summary(build), log: build.compileLog || '' } };
  }

  async pdf(ownerId: string, projectId: string, buildId: string) {
    const build = await this.ownedBuild(ownerId, projectId, buildId);
    if (build.status !== LatexBuildStatus.Success || !build.pdfPath) throw new NotFoundException('Chưa có PDF cho bản biên dịch này.');
    const absolute = path.resolve(latexStorageRoot(), build.pdfPath);
    const root = latexStorageRoot();
    if (!absolute.startsWith(root + path.sep)) throw new NotFoundException('Đường dẫn PDF không hợp lệ.');
    try {
      const file = await stat(absolute);
      if (!file.isFile()) throw new Error('Not a file');
    } catch { throw new NotFoundException('Không tìm thấy PDF trên ổ lưu trữ.'); }
    return new StreamableFile(createReadStream(absolute), {
      type: 'application/pdf',
      disposition: `inline; filename="latex-${build.id}.pdf"`,
    });
  }

  private async ownedProject(ownerId: string, id: string) {
    this.validId(id);
    const project = await this.projects.findOneBy({ id, ownerId });
    if (!project) throw new NotFoundException('Không tìm thấy dự án LaTeX.');
    return project;
  }

  private async ownedBuild(ownerId: string, projectId: string, buildId: string, withLog = false) {
    await this.ownedProject(ownerId, projectId);
    this.validId(buildId);
    const query = this.builds.createQueryBuilder('build')
      .where('build.id = :buildId AND build.projectId = :projectId', { buildId, projectId });
    if (withLog) query.addSelect('build.compileLog');
    const build = await query.getOne();
    if (!build) throw new NotFoundException('Không tìm thấy bản biên dịch.');
    return build;
  }

  private validId(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id)) throw new BadRequestException('ID không hợp lệ.');
  }

  private summary(build: LatexBuildEntity) {
    return {
      id: build.id,
      projectId: build.projectId,
      status: build.status,
      compiler: build.compiler,
      sourceSha256: build.sourceSha256,
      errorMessage: build.errorMessage,
      createdAt: build.createdAt,
      startedAt: build.startedAt,
      completedAt: build.completedAt,
      pdfUrl: build.status === LatexBuildStatus.Success && build.pdfPath
        ? `/api/v1/latex/projects/${build.projectId}/builds/${build.id}/pdf`
        : null,
    };
  }
}
