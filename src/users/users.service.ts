import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findById(id: string) {
    return this.userModel.findById(id).populate('hospitalId');
  }

  async findByPhone(phone: string) {
    return this.userModel.findOne({ phone });
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() });
  }

  async findFirstNavigator() {
    return this.userModel.findOne({ role: 'navigator' }).sort({ createdAt: 1 });
  }

  async findAllNavigators() {
    return this.userModel
      .find({ role: 'navigator' }, { passwordHash: 0 })
      .populate('hospitalId')
      .sort({ name: 1 });
  }

  async findAllPatients() {
    return this.userModel
      .find({ role: 'patient' }, { passwordHash: 0 })
      .populate('assignedNavigatorId', 'name phone')
      .populate('hospitalId', 'name')
      .sort({ name: 1 });
  }

  async remove(id: string) {
    const deleted = await this.userModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException(`User ${id} not found`);
    return { deleted: true };
  }

  async findPatientsByNavigator(navigatorId: string) {
    return this.userModel.find({
      role: 'patient',
      assignedNavigatorId: new Types.ObjectId(navigatorId),
    });
  }

  async create(dto: CreateUserDto) {
    const { assignedNavigatorId, hospitalId, ...rest } = dto;
    const payload: Record<string, unknown> = {
      ...rest,
      assignedNavigatorId: assignedNavigatorId ? new Types.ObjectId(assignedNavigatorId) : null,
      hospitalId: hospitalId ? new Types.ObjectId(hospitalId) : null,
    };
    if (dto.role === 'patient') {
      payload.patientCode = await this.generatePatientCode();
    }
    return this.userModel.create(payload);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const { hospitalId, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest, profileCompleted: true };
    if (hospitalId !== undefined) {
      patch.hospitalId = hospitalId ? new Types.ObjectId(hospitalId) : null;
    }
    const updated = await this.userModel.findByIdAndUpdate(id, patch, { new: true })
      .populate('hospitalId');
    if (!updated) throw new NotFoundException(`User ${id} not found`);
    return updated;
  }

  async update(id: string, dto: UpdateUserDto) {
    const { assignedNavigatorId, hospitalId, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest };
    if (assignedNavigatorId !== undefined) {
      patch.assignedNavigatorId = assignedNavigatorId
        ? new Types.ObjectId(assignedNavigatorId)
        : null;
    }
    if (hospitalId !== undefined) {
      patch.hospitalId = hospitalId ? new Types.ObjectId(hospitalId) : null;
    }
    const updated = await this.userModel.findByIdAndUpdate(id, patch, { new: true })
      .populate('hospitalId');
    if (!updated) throw new NotFoundException(`User ${id} not found`);
    return updated;
  }

  private async generatePatientCode(): Promise<string> {
    const year = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      const digits = Math.floor(100000 + Math.random() * 900000);
      const code = `HA-${year}-${digits}`;
      const exists = await this.userModel.exists({ patientCode: code });
      if (!exists) return code;
    }
    throw new InternalServerErrorException('Could not generate unique patientCode');
  }
}
