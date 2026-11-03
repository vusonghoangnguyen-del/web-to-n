import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProblemEntity } from '../database/entities/problem.entity';
import { SolutionRevisionEntity } from '../database/entities/solution-revision.entity';
import { SolutionEntity } from '../database/entities/solution.entity';
import { SolutionsController } from './solutions.controller';
import { SolutionsService } from './solutions.service';

@Module({
  imports: [TypeOrmModule.forFeature([SolutionEntity, SolutionRevisionEntity, ProblemEntity]), AuthModule],
  controllers: [SolutionsController],
  providers: [SolutionsService],
})
export class SolutionsModule {}
