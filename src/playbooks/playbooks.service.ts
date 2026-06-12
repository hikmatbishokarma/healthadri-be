import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Playbook, PlaybookDocument } from './playbook.schema';
import { CreatePlaybookDto } from './dto/create-playbook.dto';
import { UpdatePlaybookDto } from './dto/update-playbook.dto';

export interface PlaybookListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class PlaybooksService {
  constructor(
    @InjectModel(Playbook.name)
    private playbookModel: Model<PlaybookDocument>,
  ) {}

  async findAll(query: PlaybookListQuery = {}) {
    const { page = 1, limit = 20, search, sortBy = 'triggerType', order = 'asc' } = query;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { triggerType: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortDir = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.playbookModel
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      this.playbookModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const playbook = await this.playbookModel.findById(id);
    if (!playbook) throw new NotFoundException(`Playbook ${id} not found`);
    return playbook;
  }

  async findByTriggerType(triggerType: string) {
    return this.playbookModel.findOne({ triggerType });
  }

  async create(dto: CreatePlaybookDto) {
    const exists = await this.playbookModel.findOne({ triggerType: dto.triggerType });
    if (exists) {
      throw new ConflictException(`Playbook for ${dto.triggerType} already exists`);
    }
    return this.playbookModel.create(dto);
  }

  async update(id: string, dto: UpdatePlaybookDto) {
    const updated = await this.playbookModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException(`Playbook ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.playbookModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Playbook ${id} not found`);
    return { success: true };
  }
}
