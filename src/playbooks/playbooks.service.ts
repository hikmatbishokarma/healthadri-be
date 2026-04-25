import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Playbook, PlaybookDocument } from './playbook.schema';
import { CreatePlaybookDto } from './dto/create-playbook.dto';
import { UpdatePlaybookDto } from './dto/update-playbook.dto';

@Injectable()
export class PlaybooksService {
  constructor(
    @InjectModel(Playbook.name)
    private playbookModel: Model<PlaybookDocument>,
  ) {}

  async findAll() {
    return this.playbookModel.find().sort({ triggerType: 1 });
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
