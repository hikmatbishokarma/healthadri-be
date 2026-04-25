import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from './appointment.schema';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
  ) {}

  async create(dto: CreateAppointmentDto) {
    return this.appointmentModel.create({
      ...dto,
      patientId: new Types.ObjectId(dto.patientId),
      scheduledAt: new Date(dto.scheduledAt),
      createdByUserId: dto.createdByUserId
        ? new Types.ObjectId(dto.createdByUserId)
        : null,
    });
  }

  async findByPatient(patientId: string) {
    return this.appointmentModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ scheduledAt: 1 });
  }

  async findById(id: string) {
    const found = await this.appointmentModel.findById(id);
    if (!found) throw new NotFoundException(`Appointment ${id} not found`);
    return found;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.scheduledAt) patch.scheduledAt = new Date(dto.scheduledAt);
    const updated = await this.appointmentModel.findByIdAndUpdate(id, patch, {
      new: true,
    });
    if (!updated) throw new NotFoundException(`Appointment ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const removed = await this.appointmentModel.findByIdAndDelete(id);
    if (!removed) throw new NotFoundException(`Appointment ${id} not found`);
    return { ok: true };
  }
}
