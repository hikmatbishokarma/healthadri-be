import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './task.schema';
import { UsersService } from '../users/users.service';
import { UpdateTaskDto } from './dto/update-task.dto';

interface DraftInput {
  type: 'visit' | 'test';
  title: string;
  date: Date | string;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private usersService: UsersService,
  ) {}

  async createDrafts(
    patientId: string,
    sourceDocumentId: string | null,
    drafts: DraftInput[],
  ) {
    if (drafts.length === 0) return [];
    const docs = drafts.map((t) => ({
      patientId: new Types.ObjectId(patientId),
      type: t.type,
      title: t.title,
      date: new Date(t.date),
      status: 'draft',
      sourceDocumentId: sourceDocumentId
        ? new Types.ObjectId(sourceDocumentId)
        : null,
    }));
    return this.taskModel.insertMany(docs);
  }

  async findForPatient(patientId: string, status?: string) {
    if (!Types.ObjectId.isValid(patientId)) {
      throw new BadRequestException('valid patientId is required');
    }
    const query: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientId),
    };
    if (status) query.status = status;
    return this.taskModel.find(query).sort({ date: 1 });
  }

  async findForSource(sourceDocumentId: string, status?: string) {
    if (!Types.ObjectId.isValid(sourceDocumentId)) {
      throw new BadRequestException('valid sourceDocumentId is required');
    }
    const query: Record<string, unknown> = {
      sourceDocumentId: new Types.ObjectId(sourceDocumentId),
    };
    if (status) query.status = status;
    return this.taskModel
      .find(query)
      .populate('patientId', 'name patientCode phone')
      .populate('sourceDocumentId', 'fileName category mimeType createdAt')
      .sort({ date: 1 });
  }

  async findForNavigator(navigatorId: string, status?: string) {
    if (!Types.ObjectId.isValid(navigatorId)) {
      throw new BadRequestException('valid navigatorId is required');
    }
    const patients = await this.usersService.findPatientsByNavigator(navigatorId);
    const patientIds = patients.map((p) => p._id);
    if (patientIds.length === 0) return [];

    const query: Record<string, unknown> = { patientId: { $in: patientIds } };
    if (status) query.status = status;

    return this.taskModel
      .find(query)
      .populate('patientId', 'name patientCode phone')
      .populate('sourceDocumentId', 'fileName category mimeType createdAt')
      .sort({ createdAt: -1 });
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('valid task id is required');
    }
    const task = await this.taskModel
      .findById(id)
      .populate('patientId', 'name patientCode phone')
      .populate('sourceDocumentId', 'fileName category mimeType createdAt');
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async update(id: string, dto: UpdateTaskDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('valid task id is required');
    }
    const patch: Record<string, unknown> = {};
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.date !== undefined) patch.date = new Date(dto.date);

    const updated = await this.taskModel.findByIdAndUpdate(id, patch, {
      new: true,
    });
    if (!updated) throw new NotFoundException(`Task ${id} not found`);
    return updated;
  }

  async publish(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('valid task id is required');
    }
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    if (task.status !== 'draft') {
      throw new BadRequestException(
        `Task ${id} is already ${task.status}, cannot publish`,
      );
    }
    task.status = 'active';
    await task.save();
    return task;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('valid task id is required');
    }
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    if (task.status !== 'draft') {
      throw new BadRequestException(
        `Only draft tasks can be deleted; this task is ${task.status}`,
      );
    }
    await this.taskModel.findByIdAndDelete(id);
    return { ok: true };
  }
}
