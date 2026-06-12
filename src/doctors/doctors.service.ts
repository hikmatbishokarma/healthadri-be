import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Doctor, DoctorDocument } from './doctor.schema';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

export interface DoctorListQuery {
  page?: number;
  limit?: number;
  search?: string;
  hospitalId?: string;
  specialty?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class DoctorsService {
  constructor(
    @InjectModel(Doctor.name)
    private doctorModel: Model<DoctorDocument>,
  ) {}

  async findAll(query: DoctorListQuery = {}) {
    const { page = 1, limit = 20, search, hospitalId, specialty, sortBy = 'name', order = 'asc' } = query;

    const filter: Record<string, unknown> = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (hospitalId) filter.hospitalId = new Types.ObjectId(hospitalId);
    if (specialty) filter.primarySpecialty = { $regex: specialty, $options: 'i' };

    const skip = (page - 1) * limit;
    const sortDir = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.doctorModel
        .find(filter)
        .populate('hospitalId')
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      this.doctorModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
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
