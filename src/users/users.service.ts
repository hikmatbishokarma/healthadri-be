import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  hospitalId?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface PatientListQuery extends UserListQuery {
  navigatorId?: string;
  cancerType?: string;
}

// Convert a query-string id into an ObjectId, rejecting malformed values with a
// 400 instead of letting the raw BSONError bubble up as a 500.
function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return new Types.ObjectId(value);
}

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

  async findAllNavigators(query: UserListQuery = {}) {
    const { page = 1, limit = 20, search, hospitalId, sortBy = 'name', order = 'asc' } = query;

    const filter: Record<string, unknown> = { role: 'navigator' };
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (hospitalId) filter.hospitalId = toObjectId(hospitalId, 'hospitalId');

    const skip = (page - 1) * limit;
    const sortDir = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter, { passwordHash: 0 })
        .populate('hospitalId')
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
  }

  async findAllPatients(query: PatientListQuery = {}) {
    const { page = 1, limit = 20, search, hospitalId, navigatorId, cancerType, sortBy = 'name', order = 'asc' } = query;

    const filter: Record<string, unknown> = { role: 'patient' };
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (hospitalId) filter.hospitalId = toObjectId(hospitalId, 'hospitalId');
    if (navigatorId) {
      // 'unassigned' is a sentinel from the admin UI meaning "no navigator yet".
      filter.assignedNavigatorId =
        navigatorId === 'unassigned' ? null : toObjectId(navigatorId, 'navigatorId');
    }
    if (cancerType) filter.cancerType = { $regex: cancerType, $options: 'i' };

    const skip = (page - 1) * limit;
    const sortDir = order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter, { passwordHash: 0 })
        .populate('assignedNavigatorId', 'name phone')
        .populate('hospitalId', 'name')
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, pageCount: Math.ceil(total / limit) };
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
    const { assignedNavigatorId, hospitalId, linkedPatientId, password, ...rest } = dto;
    const payload: Record<string, unknown> = {
      ...rest,
      assignedNavigatorId: assignedNavigatorId ? new Types.ObjectId(assignedNavigatorId) : null,
      hospitalId: hospitalId ? new Types.ObjectId(hospitalId) : null,
      linkedPatientId: linkedPatientId ? new Types.ObjectId(linkedPatientId) : null,
    };
    if (password) {
      payload.passwordHash = await bcrypt.hash(password, 10);
    }
    if (dto.role === 'patient') {
      payload.patientCode = await this.generatePatientCode();
    }
    return this.userModel.create(payload);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const { hospitalId, doctorId, dateOfDiagnosis, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest, profileCompleted: true };
    if (hospitalId !== undefined) {
      patch.hospitalId = hospitalId ? new Types.ObjectId(hospitalId) : null;
    }
    if (doctorId !== undefined) {
      patch.doctorId = doctorId ? new Types.ObjectId(doctorId) : null;
    }
    if (dateOfDiagnosis !== undefined) {
      patch.dateOfDiagnosis = dateOfDiagnosis ? new Date(dateOfDiagnosis) : null;
    }
    const updated = await this.userModel.findByIdAndUpdate(id, patch, { new: true })
      .populate('hospitalId');
    if (!updated) throw new NotFoundException(`User ${id} not found`);
    return updated;
  }

  async update(id: string, dto: UpdateUserDto) {
    const { assignedNavigatorId, hospitalId, linkedPatientId, password, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest };
    if (password) {
      patch.passwordHash = await bcrypt.hash(password, 10);
    }
    if (assignedNavigatorId !== undefined) {
      patch.assignedNavigatorId = assignedNavigatorId
        ? new Types.ObjectId(assignedNavigatorId)
        : null;
    }
    if (hospitalId !== undefined) {
      patch.hospitalId = hospitalId ? new Types.ObjectId(hospitalId) : null;
    }
    if (linkedPatientId !== undefined) {
      patch.linkedPatientId = linkedPatientId ? new Types.ObjectId(linkedPatientId) : null;
    }
    const updated = await this.userModel.findByIdAndUpdate(id, patch, { new: true })
      .populate('hospitalId');
    if (!updated) throw new NotFoundException(`User ${id} not found`);
    return updated;
  }

  async findCaregiverForPatient(patientId: string) {
    return this.userModel.findOne({
      role: 'caregiver',
      linkedPatientId: new Types.ObjectId(patientId),
    });
  }

  async setActiveCarePlan(patientId: string, versionId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(patientId, {
      activeCarePlanVersionId: new Types.ObjectId(versionId),
    });
  }

  async addDeviceToken(userId: string, token: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { pushTokens: token },
    });
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { pushTokens: token },
    });
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
