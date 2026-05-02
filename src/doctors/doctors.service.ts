import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Doctor, DoctorDocument } from './doctor.schema';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectModel(Doctor.name)
    private doctorModel: Model<DoctorDocument>,
  ) {}

  async findAll() {
    return this.doctorModel.find().populate('hospitalId').sort({ name: 1 });
  }

  async findById(id: string) {
    const doctor = await this.doctorModel.findById(id).populate('hospitalId');
    if (!doctor) throw new NotFoundException(`Doctor ${id} not found`);
    return doctor;
  }

  async create(dto: CreateDoctorDto) {
    const { hospitalId, ...rest } = dto;
    return this.doctorModel.create({
      ...rest,
      hospitalId: hospitalId ? new Types.ObjectId(hospitalId) : null,
    });
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const { hospitalId, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest };
    if (hospitalId !== undefined) {
      patch.hospitalId = hospitalId ? new Types.ObjectId(hospitalId) : null;
    }
    const updated = await this.doctorModel
      .findByIdAndUpdate(id, patch, { new: true })
      .populate('hospitalId');
    if (!updated) throw new NotFoundException(`Doctor ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.doctorModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Doctor ${id} not found`);
    return { success: true };
  }
}
