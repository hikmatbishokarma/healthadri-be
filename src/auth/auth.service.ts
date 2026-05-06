import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { InviteCodeService } from '../invite-code/invite-code.service';
import { UsersService } from '../users/users.service';

const STATIC_OTP = '1234';

@Injectable()
export class AuthService {
  private otps = new Map<string, string>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private inviteCodeService: InviteCodeService,
  ) {}

  async sendOtp(phone: string) {
    this.otps.set(phone, STATIC_OTP);
    return { success: true, message: 'OTP sent' };
  }

  async verifyOtp(
    phone: string,
    otp: string,
    role?: 'patient' | 'caregiver',
    inviteCode?: string,
  ) {
    const expected = this.otps.get(phone) ?? STATIC_OTP;
    if (otp !== expected) {
      throw new UnauthorizedException('Invalid OTP');
    }
    this.otps.delete(phone);

    let user = await this.usersService.findByPhone(phone);

    if (!user) {
      if (role === 'caregiver') {
        if (!inviteCode) {
          throw new BadRequestException('Invite code is required to register as a caregiver');
        }
        const patientId = await this.inviteCodeService.consume(inviteCode);
        user = await this.usersService.create({
          name: `Caregiver ${phone.slice(-4)}`,
          phone,
          role: 'caregiver',
          linkedPatientId: patientId.toString(),
        });
      } else {
        const navigator = await this.usersService.findFirstNavigator();
        user = await this.usersService.create({
          name: `Patient ${phone.slice(-4)}`,
          phone,
          role: 'patient',
          assignedNavigatorId: navigator?._id?.toString(),
        });
      }
    }

    const token = this.jwtService.sign({
      sub: user._id.toString(),
      phone: user.phone,
      role: user.role,
    });

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async adminLogin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.role !== 'super-admin' || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
