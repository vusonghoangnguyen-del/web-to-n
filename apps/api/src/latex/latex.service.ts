import { rm } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, ConflictException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { LatexBuildEntity, LatexBuildStatus } from '../database/entities/latex-build.entity';
import { LatexFileEntity } from '../database/entities/latex-file.entity';
import { LatexCompiler, LatexProjectEntity } from '../database/entities/latex-project.entity';
import { CreateLatexProjectDto } from './dto/create-latex-project.dto';
import { CreateLatexFileDto } from './dto/create-latex-file.dto';
import { UpdateLatexFileDto } from './dto/update-latex-file.dto';
import { UpdateLatexProjectDto } from './dto/update-latex-project.dto';
import { latexStorageRoot } from './build-config';
import { checkProjectFiles, cleanProjectPath, isTextPath, projectFileFromBuffer, projectFileFromText, ProjectFile } from './latex-files';
import { readProjectZip, writeProjectZip } from './latex-zip';

const starter = String.raw`\documentclass[12pt]{article}
\usepackage{fontspec}
\setmainfont{TeX Gyre Termes}
\usepackage{amsmath,amssymb}
\title{Bản thảo toán học}
\author{Tờ Toán}
\begin{document}
\maketitle
\section{Giới thiệu}
Một bài toán mới.
\end{document}
`;

@Injectable()
export class LatexService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LatexProjectEntity) private readonly projects: Repository<LatexProjectEntity>,
    @InjectRepository(LatexFileEntity) private readonly files: Repository<LatexFileEntity>,
    @InjectRepository(LatexBuildEntity) private readonly builds: Repository<LatexBuildEntity>,
  ) {}

  async list(ownerId: string) {
    const projects = await this.projects.find({
      where: { ownerId },
      order: { updatedAt: 'DESC', id: 'DESC' },
      take: 100,
    });
    return { projects: projects.map((project) => this.summary(project)) };
  }

  async create(ownerId: string, dto: CreateLatexProjectDto) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Tên dự án không được để trống.');
    const main = projectFileFromText('main.tex', dto.source ?? starter);
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(LatexProjectEntity).save({
        ownerId,
        title,
        compiler: dto.compiler ?? LatexCompiler.XeLatex,
      });
      const file = await manager.getRepository(LatexFileEntity).save(this.fileRecord(project.id, main));
      return { project: this.view(project, file, [file]) };
    });
  }

  async detail(ownerId: string, id: string) {
    const project = await this.ownedProject(ownerId, id);
    const file = await this.mainFile(project.id);
    const files = await this.files.find({ where: { projectId: project.id }, order: { relativePath: 'ASC' } });
    return { project: this.view(project, file, files) };
  }

  async update(ownerId: string, id: string, dto: UpdateLatexProjectDto) {
    const project = await this.ownedProject(ownerId, id);
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('Tên dự án không được để trống.');
      project.title = title;
    }
    if (dto.compiler !== undefined) project.compiler = dto.compiler;
    await this.projects.save(project);
    return this.detail(ownerId, id);
  }

  async saveFile(ownerId: string, id: string, fileId: string, dto: UpdateLatexFileDto) {
    const project = await this.ownedProject(ownerId, id);
    this.validId(fileId);
    const file = await this.files.findOneBy({ id: fileId, projectId: project.id });
    if (!file) throw new NotFoundException('Không tìm thấy tệp.');
    if (!isTextPath(file.relativePath)) throw new BadRequestException('Không thể sửa ảnh hoặc PDF như văn bản.');
    const incoming = projectFileFromText(file.relativePath, dto.content);
    const files = await this.files.findBy({ projectId: project.id });
    checkProjectFiles(files.map((item) => ({ path: item.relativePath, content: '', binary: null, mimeType: item.mimeType, sizeBytes: item.id === file.id ? incoming.sizeBytes : item.sizeBytes })));
    file.content = incoming.content;
    file.sizeBytes = incoming.sizeBytes;
    await this.files.save(file);
    await this.projects.update(project.id, { updatedAt: new Date() });
    return this.detail(ownerId, id);
  }

  async createFile(ownerId: string, id: string, dto: CreateLatexFileDto) {
    const project = await this.ownedProject(ownerId, id);
    const incoming = projectFileFromText(dto.path, dto.content);
    const files = await this.files.findBy({ projectId: project.id });
    checkProjectFiles([...files.map((item) => ({ path: item.relativePath, content: '', binary: null, mimeType: item.mimeType, sizeBytes: item.sizeBytes })), incoming]);
    await this.saveNewFile(project.id, incoming);
    return this.detail(ownerId, id);
  }

  async uploadFile(ownerId: string, id: string, filePath: string, data: Buffer) {
    const project = await this.ownedProject(ownerId, id);
    const incoming = projectFileFromBuffer(filePath, data);
    const files = await this.files.findBy({ projectId: project.id });
    checkProjectFiles([...files.map((item) => ({ path: item.relativePath, content: '', binary: null, mimeType: item.mimeType, sizeBytes: item.sizeBytes })), incoming]);
    await this.saveNewFile(project.id, incoming);
    return this.detail(ownerId, id);
  }

  async deleteFile(ownerId: string, id: string, fileId: string) {
    const project = await this.ownedProject(ownerId, id);
    this.validId(fileId);
    const file = await this.files.findOneBy({ id: fileId, projectId: project.id });
    if (!file) throw new NotFoundException('Không tìm thấy tệp.');
    if (file.relativePath === 'main.tex') throw new BadRequestException('Không thể xóa main.tex.');
    await this.files.delete(file.id);
    await this.projects.update(project.id, { updatedAt: new Date() });
    return this.detail(ownerId, id);
  }

  async rawFile(ownerId: string, id: string, fileId: string) {
    const project = await this.ownedProject(ownerId, id);
    this.validId(fileId);
    const file = await this.files.createQueryBuilder('file').addSelect('file.binaryContent')
      .where('file.id = :fileId AND file.projectId = :projectId', { fileId, projectId: project.id }).getOne();
    if (!file) throw new NotFoundException('Không tìm thấy tệp.');
    const body = file.binaryContent || Buffer.from(file.content, 'utf8');
    const safeName = path.posix.basename(file.relativePath).replaceAll('"', '');
    return new StreamableFile(body, { type: file.mimeType, disposition: `${file.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${safeName}"` });
  }

  async importZip(ownerId: string, filename: string, data: Buffer) {
    const files = await readProjectZip(data);
    const title = path.basename(filename, path.extname(filename)).slice(0, 120) || 'Dự án LaTeX';
    const projectId = await this.dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(LatexProjectEntity).save({ ownerId, title, compiler: LatexCompiler.XeLatex });
      await manager.getRepository(LatexFileEntity).save(files.map((file) => this.fileRecord(project.id, file)));
      return project.id;
    });
    return this.detail(ownerId, projectId);
  }

  async exportZip(ownerId: string, id: string) {
    const project = await this.ownedProject(ownerId, id);
    const files = await this.files.createQueryBuilder('file').addSelect('file.binaryContent')
      .where('file.projectId = :projectId', { projectId: project.id }).orderBy('file.relativePath', 'ASC').getMany();
    const archive = await writeProjectZip(files.map((file) => this.toProjectFile(file)));
    return new StreamableFile(archive, { type: 'application/zip', disposition: `attachment; filename="latex-project-${project.id}.zip"` });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const project = await this.ownedProject(ownerId, id);
    const active = await this.builds.existsBy({ projectId: project.id, status: In([LatexBuildStatus.Queued, LatexBuildStatus.Compiling]) });
    if (active) throw new ConflictException('Hãy chờ biên dịch xong trước khi xóa dự án.');
    await this.projects.delete(project.id);
    await rm(path.join(latexStorageRoot(), project.id), { recursive: true, force: true });
  }

  private async ownedProject(ownerId: string, id: string) {
    this.validId(id);
    const project = await this.projects.findOneBy({ id, ownerId });
    if (!project) throw new NotFoundException('Không tìm thấy dự án LaTeX.');
    return project;
  }

  private async mainFile(projectId: string) {
    const file = await this.files.findOneBy({ projectId, relativePath: 'main.tex' });
    if (!file) throw new NotFoundException('Không tìm thấy main.tex.');
    return file;
  }

  private async saveNewFile(projectId: string, file: ProjectFile) {
    try { await this.files.save(this.files.create(this.fileRecord(projectId, file))); }
    catch (cause) { if (typeof cause === 'object' && cause && 'code' in cause && cause.code === 'ER_DUP_ENTRY') throw new ConflictException('Đường dẫn tệp đã tồn tại.'); throw cause; }
    await this.projects.update(projectId, { updatedAt: new Date() });
  }

  private fileRecord(projectId: string, file: ProjectFile) {
    return { projectId, relativePath: file.path, content: file.content, binaryContent: file.binary, mimeType: file.mimeType, sizeBytes: file.sizeBytes };
  }

  private toProjectFile(file: LatexFileEntity): ProjectFile {
    return { path: cleanProjectPath(file.relativePath), content: file.content, binary: file.binaryContent, mimeType: file.mimeType, sizeBytes: file.sizeBytes };
  }

  private validId(id: string) {
    if (!/^[1-9]\d*$/.test(id)) throw new BadRequestException('ID không hợp lệ.');
  }

  private summary(project: LatexProjectEntity) {
    return {
      id: project.id,
      title: project.title,
      compiler: project.compiler,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private view(project: LatexProjectEntity, file: LatexFileEntity, files: LatexFileEntity[]) {
    return {
      ...this.summary(project),
      mainFile: { id: file.id, path: file.relativePath, content: file.content, updatedAt: file.updatedAt },
      files: files.map((item) => ({ id: item.id, path: item.relativePath, mimeType: item.mimeType, sizeBytes: item.sizeBytes, updatedAt: item.updatedAt })),
    };
  }
}
