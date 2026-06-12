import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Symptom, SymptomDocument } from './symptom.schema';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

export interface SymptomListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class SymptomsService {
  constructor(
    @InjectModel(Symptom.name) private symptomModel: Model<SymptomDocument>,
  ) {}

  async findAll(query: SymptomListQuery = {}) {
    const { page = 1, limit = 50, search, sortBy = 'name', order = 'asc' } = query;

    const filter: Record<string, unknown> = {};
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (page - 1) * limit;
    const sortDir = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.symptomModel
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      this.symptomModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    return this.symptomModel.findById(id);
  }

  async create(dto: CreateSymptomDto) {
    return this.symptomModel.create(dto);
  }

  async update(id: string, dto: UpdateSymptomDto) {
    const updated = await this.symptomModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException(`Symptom ${id} not found`);
    return updated;
  }
}
