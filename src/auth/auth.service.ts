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
    role?: 'patient' | 'caregiver' | 'navigator',
  ) {
    const expected = this.otps.get(phone) ?? STATIC_OTP;
    if (otp !== expected) {
      throw new UnauthorizedException('Invalid OTP');
    }
    this.otps.delete(phone);

    if (role === 'navigator') {
      const navigator = await this.usersService.findByPhone(phone);
      if (!navigator || navigator.role !== 'navigator') {
        throw new UnauthorizedException('This number is not registered as a navigator');
      }
      const token = this.jwtService.sign({
        sub: navigator._id.toString(),
        phone: navigator.phone,
        role: navigator.role,
      });
      return {
        token,
        user: {
          _id: navigator._id,
          name: navigator.name,
          phone: navigator.phone,
          role: navigator.role,
        },
      };
    }

    if (role === 'caregiver') {
      const existingCaregiver = await this.usersService.findByPhone(phone);

      if (existingCaregiver && existingCaregiver.role !== 'caregiver') {
        throw new BadRequestException(
          `This number is already registered as a ${existingCaregiver.role}`,
        );
      }

      if (existingCaregiver && existingCaregiver.role === 'caregiver' && existingCaregiver.linkedPatientId) {
        // Returning caregiver — already linked
        const token = this.jwtService.sign({
          sub: existingCaregiver._id.toString(),
          phone: existingCaregiver.phone,
          role: existingCaregiver.role,
        });
        return {
          token,
          user: {
            _id: existingCaregiver._id,
            name: existingCaregiver.name,
            phone: existingCaregiver.phone,
            role: existingCaregiver.role,
            linkedPatientId: existingCaregiver.linkedPatientId,
          },
        };
      }

      // New caregiver — needs invite code; issue a short-lived temp token
      const userId = existingCaregiver
        ? existingCaregiver._id.toString()
        : null;

      const tempToken = this.jwtService.sign(
        { sub: userId, phone, role: 'caregiver', purpose: 'caregiver-link' },
        { expiresIn: '15m' },
      );

      return { requiresInviteCode: true, tempToken };
    }

    // Patient (default)
    let user = await this.usersService.findByPhone(phone);
    if (user && user.role !== 'patient') {
      throw new BadRequestException(
        `This number is already registered as a ${user.role}`,
      );
    }
    if (!user) {
      const navigator = await this.usersService.findFirstNavigator();
      user = await this.usersService.create({
        name: `Patient ${phone.slice(-4)}`,
        phone,
        role: 'patient',
        assignedNavigatorId: navigator?._id?.toString(),
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

  async caregiverLink(tempToken: string, inviteCode: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Temp token expired or invalid');
    }

    if (payload.purpose !== 'caregiver-link' || payload.role !== 'caregiver') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const patientId = await this.inviteCodeService.consume(inviteCode);

    let user = await this.usersService.findByPhone(payload.phone);
    if (user && user.role !== 'caregiver') {
      throw new BadRequestException(
        `This number is already registered as a ${user.role}`,
      );
    }
    if (!user) {
      user = await this.usersService.create({
        name: `Caregiver ${payload.phone.slice(-4)}`,
        phone: payload.phone,
        role: 'caregiver',
        linkedPatientId: patientId.toString(),
      });
    } else {
      await this.usersService.update(user._id.toString(), {
        linkedPatientId: patientId.toString(),
      });
      user = await this.usersService.findByPhone(payload.phone);
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
        linkedPatientId: user.linkedPatientId ?? null,
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

  async webLogin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !['super-admin', 'navigator'].includes(user.role) || !user.passwordHash) {
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
        phone: user.phone,
        role: user.role,
      },
    };
  }
}
