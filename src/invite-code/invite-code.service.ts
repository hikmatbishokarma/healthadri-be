import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InviteCode, InviteCodeDocument } from './invite-code.schema';

@Injectable()
export class InviteCodeService {
  constructor(
    @InjectModel(InviteCode.name) private inviteCodeModel: Model<InviteCodeDocument>,
  ) {}

  async generate(patientId: string): Promise<string> {
    // invalidate any existing pending codes for this patient
    await this.inviteCodeModel.updateMany(
      { patientId: new Types.ObjectId(patientId), status: 'pending' },
      { status: 'used' },
    );

    const code = this.makeCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.inviteCodeModel.create({
      code,
      patientId: new Types.ObjectId(patientId),
      status: 'pending',
      expiresAt,
    });
    return code;
  }

  async consume(code: string): Promise<Types.ObjectId> {
    const invite = await this.inviteCodeModel.findOne({ code });
    if (!invite) throw new BadRequestException('Invalid invite code');
    if (invite.status === 'used') throw new BadRequestException('Invite code already used');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite code has expired');

    invite.status = 'used';
    await invite.save();
    return invite.patientId;
  }

  private makeCode(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '0123456789';
    const prefix = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    const suffix = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
    return `${prefix}-${suffix}`;
  }
}
