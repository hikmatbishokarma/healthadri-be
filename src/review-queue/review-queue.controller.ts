import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReviewQueueService } from './review-queue.service';
import { EditTaskDto, VerifyTaskDto, RejectTaskDto, PublishBatchDto } from './dto/review-task.dto';

@Controller('review-queue')
export class ReviewQueueController {
  constructor(private readonly reviewQueueService: ReviewQueueService) {}

  @Get('navigator/:navigatorId/metrics')
  getMetrics(@Param('navigatorId') navigatorId: string) {
    return this.reviewQueueService.getMetrics(navigatorId);
  }

  @Get('navigator/:navigatorId/summary')
  getSummary(
    @Param('navigatorId') navigatorId: string,
    @Query('filter') filter = 'all',
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.reviewQueueService.getSummaryList(
      navigatorId,
      filter,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('navigator/:navigatorId')
  getPending(@Param('navigatorId') navigatorId: string) {
    return this.reviewQueueService.getPendingBatches(navigatorId);
  }

  @Get('navigator/:navigatorId/all')
  getAll(@Param('navigatorId') navigatorId: string) {
    return this.reviewQueueService.getAllBatches(navigatorId);
  }

  @Get('batch/:batchId')
  getBatch(@Param('batchId') batchId: string) {
    return this.reviewQueueService.getBatch(batchId);
  }

  @Patch('task/:taskId/verify')
  verify(@Param('taskId') taskId: string, @Body() dto: VerifyTaskDto) {
    return this.reviewQueueService.verifyTask(taskId, dto.navigatorId);
  }

  @Patch('task/:taskId/edit')
  edit(@Param('taskId') taskId: string, @Body() dto: EditTaskDto) {
    return this.reviewQueueService.editTask(taskId, dto.navigatorId, dto.edits);
  }

  @Patch('task/:taskId/reject')
  reject(@Param('taskId') taskId: string, @Body() dto: RejectTaskDto) {
    return this.reviewQueueService.rejectTask(taskId, dto.navigatorId);
  }

  @Post('batch/:batchId/publish')
  publishBatch(@Param('batchId') batchId: string, @Body() dto: PublishBatchDto) {
    return this.reviewQueueService.publishBatch(batchId, dto.navigatorId);
  }

  @Patch('batch/:batchId/in-review')
  markInReview(@Param('batchId') batchId: string) {
    return this.reviewQueueService.markBatchInReview(batchId);
  }
}
