import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('weekly')
  async weekly(@Query('patientId') patientId: string) {
    return this.reportsService.getWeekly(patientId);
  }
}
