import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visit, VisitDocument } from './visit.schema';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';

@Injectable()
export class VisitsService {
  constructor(@InjectModel(Visit.name) private visitModel: Model<VisitDocument>) {}

  async create(dto: CreateVisitDto): Promise<Visit> {
    const visit = new this.visitModel({
      ...dto,
      patientId: new Types.ObjectId(dto.patientId),
      visitDate: new Date(dto.visitDate),
      appointmentId: dto.appointmentId ? new Types.ObjectId(dto.appointmentId) : null,
    });
    return visit.save();
  }

  async findByPatient(patientId: string): Promise<Visit[]> {
    return this.visitModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ visitDate: -1 })
      .lean();
  }

  async findById(id: string): Promise<Visit> {
    const visit = await this.visitModel.findById(id).lean();
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  async update(id: string, dto: UpdateVisitDto): Promise<Visit> {
    const update: Record<string, unknown> = { ...dto };
    if (dto.patientId) update.patientId = new Types.ObjectId(dto.patientId);
    if (dto.visitDate) update.visitDate = new Date(dto.visitDate);
    if (dto.appointmentId) update.appointmentId = new Types.ObjectId(dto.appointmentId);

    const updated = await this.visitModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) throw new NotFoundException('Visit not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.visitModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Visit not found');
  }
}
