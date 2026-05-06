import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CaregiverService } from './caregiver.service';

@Controller('caregiver')
export class CaregiverController {
  constructor(
    private caregiverService: CaregiverService,
    private jwtService: JwtService,
  ) {}

  @Get('patient')
  async getPatientStatus(@Headers('authorization') authHeader?: string) {
    const caregiverId = this.caregiverIdFromHeader(authHeader);
    return this.caregiverService.getPatientStatus(caregiverId);
  }

  private caregiverIdFromHeader(authHeader?: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<{ sub: string; role: string }>(token);
      if (payload.role !== 'caregiver') {
        throw new UnauthorizedException('Only caregivers can access this endpoint');
      }
      return payload.sub;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
