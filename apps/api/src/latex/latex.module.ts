import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LatexFileEntity } from '../database/entities/latex-file.entity';
import { LatexProjectEntity } from '../database/entities/latex-project.entity';
import { LatexBuildEntity } from '../database/entities/latex-build.entity';
import { LatexBuildService } from './latex-build.service';
import { LatexQueueService } from './latex-queue.service';
import { LatexController } from './latex.controller';
import { LatexService } from './latex.service';

@Module({
  imports: [TypeOrmModule.forFeature([LatexProjectEntity, LatexFileEntity, LatexBuildEntity]), AuthModule],
  controllers: [LatexController],
  providers: [LatexService, LatexBuildService, LatexQueueService],
})
export class LatexModule {}
