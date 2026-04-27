import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  async list(
    @Query('patientId') patientId?: string,
    @Query('navigatorId') navigatorId?: string,
    @Query('sourceDocumentId') sourceDocumentId?: string,
    @Query('status') status?: string,
  ) {
    if (sourceDocumentId) {
      return this.tasksService.findForSource(sourceDocumentId, status);
    }
    if (patientId) {
      return this.tasksService.findForPatient(patientId, status);
    }
    if (navigatorId) {
      return this.tasksService.findForNavigator(navigatorId, status);
    }
    throw new BadRequestException(
      'patientId, navigatorId, or sourceDocumentId is required',
    );
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    return this.tasksService.publish(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
