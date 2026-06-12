import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Hospital, HospitalDocument } from './hospital.schema';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

export interface HospitalListQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  city?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class HospitalsService {
  constructor(
    @InjectModel(Hospital.name)
    private hospitalModel: Model<HospitalDocument>,
  ) {}

  async findAll(query: HospitalListQuery = {}) {
    const { page = 1, limit = 20, search, type, city, sortBy = 'name', order = 'asc' } = query;

    const filter: Record<string, unknown> = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (type) filter.type = type;
    if (city) filter.city = { $regex: city, $options: 'i' };

    const skip = (page - 1) * limit;
    const sortDir = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.hospitalModel
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      this.hospitalModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const hospital = await this.hospitalModel.findById(id);
    if (!hospital) throw new NotFoundException(`Hospital ${id} not found`);
    return hospital;
  }

  async create(dto: CreateHospitalDto) {
    return this.hospitalModel.create(dto);
  }

  async update(id: string, dto: UpdateHospitalDto) {
    const updated = await this.hospitalModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException(`Hospital ${id} not found`);
    return updated;
  }
}
