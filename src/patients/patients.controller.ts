import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InviteCodeService } from '../invite-code/invite-code.service';
import { SymptomEntryService } from '../symptom-entry/symptom-entry.service';
import { UsersService } from '../users/users.service';

@Controller('patients')
export class PatientsController {
  constructor(
    private usersService: UsersService,
    private symptomEntryService: SymptomEntryService,
    private inviteCodeService: InviteCodeService,
    private jwtService: JwtService,
  ) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const patient = await this.usersService.findById(id);
    if (!patient) throw new NotFoundException(`Patient ${id} not found`);

    const [latestEntry, history] = await Promise.all([
      this.symptomEntryService.findLatestByPatient(id),
      this.symptomEntryService.findLastNByPatient(id, 5),
    ]);

    return { patient, latestEntry, history };
  }

  @Post('invite')
  async generateInvite(@Headers('authorization') authHeader?: string) {
    const patientId = this.patientIdFromHeader(authHeader);
    const code = await this.inviteCodeService.generate(patientId);
    return { code };
  }

  private patientIdFromHeader(authHeader?: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<{ sub: string; role: string }>(token);
      if (payload.role !== 'patient') {
        throw new UnauthorizedException('Only patients can generate invite codes');
      }
      return payload.sub;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
