import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get('patient/:patientId')
  async getByPatient(@Param('patientId') patientId: string) {
    return this.alertsService.findLatestByPatient(patientId);
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string) {
    return this.alertsService.resolve(id);
  }
}
