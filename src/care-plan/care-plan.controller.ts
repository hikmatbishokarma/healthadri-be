import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CarePlanService } from './care-plan.service';
import { CreateCarePlanTaskDto } from './dto/create-care-plan-task.dto';
import { UpdateCarePlanTaskDto } from './dto/update-care-plan-task.dto';
import { PublishVersionDto } from './dto/publish-version.dto';

@Controller('care-plan')
export class CarePlanController {
  constructor(private readonly carePlanService: CarePlanService) {}

  @Get('navigator/:navigatorId/summary')
  getNavigatorSummary(@Param('navigatorId') navigatorId: string) {
    return this.carePlanService.getNavigatorSummary(navigatorId);
  }

  @Get('navigator/:navigatorId')
  getActiveForNavigator(
    @Param('navigatorId') navigatorId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('tab') tab = 'all',
  ) {
    return this.carePlanService.getActiveCarePlansSummaryList(
      navigatorId,
      parseInt(page, 10),
      parseInt(limit, 10),
      tab,
    );
  }

  @Get('patient/:patientId')
  getVersions(@Param('patientId') patientId: string) {
    return this.carePlanService.getVersionsForPatient(patientId);
  }

  @Get('patient/:patientId/active')
  getActive(@Param('patientId') patientId: string) {
    return this.carePlanService.getActiveForPatient(patientId);
  }

  @Get('patient/:patientId/draft')
  getDraft(@Param('patientId') patientId: string) {
    return this.carePlanService.getDraftForPatient(patientId);
  }

  @Get('version/:versionId')
  getVersion(@Param('versionId') versionId: string) {
    return this.carePlanService.getVersion(versionId);
  }

  @Post('version/:versionId/publish')
  publishVersion(
    @Param('versionId') versionId: string,
    @Body() dto: PublishVersionDto,
  ) {
    return this.carePlanService.publishVersion(versionId, dto);
  }

  @Post('version/:versionId/tasks')
  addTask(
    @Param('versionId') versionId: string,
    @Body() dto: CreateCarePlanTaskDto,
  ) {
    return this.carePlanService.addTask(versionId, dto);
  }

  @Patch('task/:taskId')
  updateTask(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateCarePlanTaskDto,
  ) {
    return this.carePlanService.updateTask(taskId, dto);
  }

  @Delete('task/:taskId')
  removeTask(@Param('taskId') taskId: string) {
    return this.carePlanService.removeTask(taskId);
  }
}
