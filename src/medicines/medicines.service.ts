import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Medicine, MedicineDocument } from './medicine.schema';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

export interface MedicineListQuery {
  page?: number;
  limit?: number;
  search?: string;
  form?: string;
  category?: string;
  cancerType?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class MedicinesService {
  constructor(
    @InjectModel(Medicine.name)
    private medicineModel: Model<MedicineDocument>,
  ) {}

  async findAll(query: MedicineListQuery = {}) {
    const { page = 1, limit = 20, search, form, category, cancerType, sortBy = 'genericName', order = 'asc' } = query;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { genericName: { $regex: search, $options: 'i' } },
        { brandNames: { $elemMatch: { $regex: search, $options: 'i' } } },
      ];
    }
    if (form) filter.form = form;
    if (category) filter.category = category;
    if (cancerType) filter.cancerTypes = { $elemMatch: { $regex: cancerType, $options: 'i' } };

    const skip = (page - 1) * limit;
    const sortDir = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.medicineModel
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      this.medicineModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const medicine = await this.medicineModel.findById(id);
    if (!medicine) throw new NotFoundException(`Medicine ${id} not found`);
    return medicine;
  }

  async create(dto: CreateMedicineDto) {
    return this.medicineModel.create(dto);
  }

  async update(id: string, dto: UpdateMedicineDto) {
    const updated = await this.medicineModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException(`Medicine ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.medicineModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Medicine ${id} not found`);
    return { success: true };
  }

  async getMeta() {
    const [brandNames, manufacturers, cancerTypes] = await Promise.all([
      this.medicineModel.distinct('brandNames'),
      this.medicineModel.distinct('manufacturers'),
      this.medicineModel.distinct('cancerTypes'),
    ]);
    const clean = (arr: unknown[]) =>
      (arr as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return {
      brandNames: clean(brandNames),
      manufacturers: clean(manufacturers),
      cancerTypes: clean(cancerTypes),
    };
  }
}
