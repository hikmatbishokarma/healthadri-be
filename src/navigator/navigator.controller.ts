import { Controller, Get, Param } from '@nestjs/common';
import { NavigatorService } from './navigator.service';

@Controller('navigator')
export class NavigatorController {
  constructor(private navigatorService: NavigatorService) {}

  @Get('dashboard/:navigatorId')
  async getDashboard(@Param('navigatorId') navigatorId: string) {
    return this.navigatorService.getDashboard(navigatorId);
  }
}
