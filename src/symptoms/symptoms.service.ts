import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Symptom, SymptomDocument } from './symptom.schema';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

@Injectable()
export class SymptomsService {
  constructor(
    @InjectModel(Symptom.name) private symptomModel: Model<SymptomDocument>,
  ) {}

  async findAll() {
    return this.symptomModel.find();
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
