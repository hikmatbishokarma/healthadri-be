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

  async findAll(search?: string) {
    const filter = search ? { name: { $regex: search, $options: 'i' } } : {};
    return this.doctorModel.find(filter).populate('hospitalId').sort({ name: 1 }).limit(20);
  }

  async findById(id: string) {
    const doctor = await this.doctorModel.findById(id).populate('hospitalId');
    if (!doctor) throw new NotFoundException(`Doctor ${id} not found`);
    return doctor;
  }

  async create(dto: CreateDoctorDto) {
    const { hospitalId, affiliations, ...rest } = dto;
    return this.doctorModel.create({
      ...rest,
      hospitalId: hospitalId ? new Types.ObjectId(hospitalId) : null,
      affiliations: this.mapAffiliations(affiliations),
    });
  }

  async update(id: string, dto: UpdateDoctorDto) {
    const { hospitalId, affiliations, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest };
    if (hospitalId !== undefined) {
      patch.hospitalId = hospitalId ? new Types.ObjectId(hospitalId) : null;
    }
    if (affiliations !== undefined) {
      patch.affiliations = this.mapAffiliations(affiliations);
    }
    const updated = await this.doctorModel
      .findByIdAndUpdate(id, patch, { new: true })
      .populate('hospitalId');
    if (!updated) throw new NotFoundException(`Doctor ${id} not found`);
    return updated;
  }

  private mapAffiliations(affiliations?: Array<{ hospitalId?: string; consultationDays?: string[]; consultationHoursStart?: string; consultationHoursEnd?: string; appointmentNumber?: string }>) {
    return (affiliations ?? []).map(({ hospitalId, ...rest }) => ({
      ...rest,
      hospitalId: hospitalId ? new Types.ObjectId(hospitalId) : null,
    }));
  }

  async remove(id: string) {
    const deleted = await this.doctorModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`Doctor ${id} not found`);
    return { success: true };
  }
}
