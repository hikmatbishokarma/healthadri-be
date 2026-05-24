import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewBatch, ReviewBatchSchema } from './schemas/review-batch.schema';
import { AiExtractedTask, AiExtractedTaskSchema } from './schemas/ai-extracted-task.schema';
import { ReviewQueueService } from './review-queue.service';
import { ReviewQueueController } from './review-queue.controller';
import { UsersModule } from '../users/users.module';
import { CarePlanModule } from '../care-plan/care-plan.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReviewBatch.name, schema: ReviewBatchSchema },
      { name: AiExtractedTask.name, schema: AiExtractedTaskSchema },
    ]),
    UsersModule,
    CarePlanModule,
  ],
  controllers: [ReviewQueueController],
  providers: [ReviewQueueService],
  exports: [ReviewQueueService],
})
export class ReviewQueueModule {}
