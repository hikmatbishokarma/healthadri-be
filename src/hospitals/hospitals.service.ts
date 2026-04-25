import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Hospital, HospitalDocument } from './hospital.schema';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Injectable()
export class HospitalsService {
  constructor(
    @InjectModel(Hospital.name)
    private hospitalModel: Model<HospitalDocument>,
  ) {}

  async findAll() {
    return this.hospitalModel.find();
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
