import { Controller, Get, Param } from '@nestjs/common';
import { NavigatorService } from './navigator.service';

@Controller('navigator')
export class NavigatorController {
  constructor(private navigatorService: NavigatorService) {}

  @Get('dashboard/:navigatorId')
  async getDashboard(@Param('navigatorId') navigatorId: string) {
    return this.navigatorService.getDashboard(navigatorId);
  }

  @Get('patients/:navigatorId')
  async getPatientsList(@Param('navigatorId') navigatorId: string) {
    return this.navigatorService.getPatientsList(navigatorId);
  }

  @Get('playbook-run/:patientId')
  async getPlaybookRun(@Param('patientId') patientId: string) {
    return this.navigatorService.getPlaybookRun(patientId);
  }
}
