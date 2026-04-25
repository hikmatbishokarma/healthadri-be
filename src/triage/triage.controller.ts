import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { TriageService } from './triage.service';

@Controller('triage')
export class TriageController {
  constructor(private triageService: TriageService) {}

  @Get('latest')
  async latest(@Query('patientId') patientId: string) {
    if (!patientId) throw new BadRequestException('patientId query param is required');
    return this.triageService.findLatestForPatient(patientId);
  }
}
