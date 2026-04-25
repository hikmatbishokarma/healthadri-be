import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

const STATIC_OTP = '1234';

@Injectable()
export class AuthService {
  private otps = new Map<string, string>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async sendOtp(phone: string) {
    this.otps.set(phone, STATIC_OTP);
    return { success: true, message: 'OTP sent' };
  }

  async verifyOtp(phone: string, otp: string) {
    const expected = this.otps.get(phone) ?? STATIC_OTP;
    if (otp !== expected) {
      throw new UnauthorizedException('Invalid OTP');
    }
    this.otps.delete(phone);

    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.create({
        name: `Patient ${phone.slice(-4)}`,
        phone,
        role: 'patient',
      });
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
}
